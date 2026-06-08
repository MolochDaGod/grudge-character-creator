/**
 * Cloudflare Worker — Model Manifest + Telemetry API
 *
 * Queries D1 (grudge-models) and returns model/equipment/animation data.
 * Accepts telemetry event batches and forwards them to the Pipelines stream.
 * Deploy: npx wrangler deploy (uses wrangler.toml at project root)
 *
 * Endpoints:
 *   GET  /api/manifest           — full manifest (models + equipment + anims)
 *   GET  /api/models             — list all race models
 *   GET  /api/models/:id         — single model with equipment slots
 *   GET  /api/models/:id/equip   — equipment slots for a model
 *   GET  /api/animations         — all animation packs
 *   GET  /api/weapons            — all weapon model packs
 *   POST /api/events             — telemetry batch → GRUDGE_EVENTS_STREAM → R2
 *   POST /api/ai/chat            — editor AI assistant (Workers AI llama-3.1-8b)
 *   GET  /api/prefab/:uuid       — resolved character prefab for external games
 */

const ASSET_VERSION = 'v2';  // Bump when re-uploading textures to bust CDN cache

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, max-age=300",
};

// No-cache variant for mutating endpoints (events ingest)
const CORS_NOCACHE = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

function json(data, status = 200, headers = CORS_HEADERS) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function safeParseJson(str, fallback) {
  if (str == null) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Hard cap on a single event's payload to keep Pipelines rows bounded.
const MAX_PAYLOAD_BYTES = 64 * 1024;
function capPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_PAYLOAD_BYTES) return payload;
  return {
    payload_truncated: true,
    preview: serialized.slice(0, MAX_PAYLOAD_BYTES),
  };
}

// Allowed event_type values — keep in sync with d1/pipelines/grudge-events.schema.json
const ALLOWED_EVENT_TYPES = new Set([
  "character_save",
  "character_update",
  "character_delete",
  "character_active",
  "equipment_change",
  "weapon_equip",
  "combat_action",
  "asset_load",
  "session_start",
  "session_end",
  "pipeline_smoke_test",
]);
const MAX_BATCH = 50;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Full manifest (primary endpoint for frontend) ──
      if (path === "/api/manifest") {
        return await getFullManifest(env.DB);
      }

      // ── Models ──
      if (path === "/api/models") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM models ORDER BY faction_id, race_id",
        ).all();
        return json({ models: results });
      }

      // ── Single model with equipment ──
      const modelMatch = path.match(/^\/api\/models\/([^/]+)$/);
      if (modelMatch) {
        return await getModelWithEquipment(env.DB, modelMatch[1]);
      }

      // ── Equipment for model ──
      const equipMatch = path.match(/^\/api\/models\/([^/]+)\/equip$/);
      if (equipMatch) {
        const { results } = await env.DB.prepare(
          "SELECT * FROM equipment_slots WHERE model_id = ? ORDER BY sort_order",
        )
          .bind(equipMatch[1])
          .all();
        return json({ slots: results });
      }

      // ── Animation packs ──
      if (path === "/api/animations") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM animation_packs ORDER BY name",
        ).all();
        return json({
          packs: results.map((p) => ({
            ...p,
            files: JSON.parse(p.files || "[]"),
          })),
        });
      }

      // ── Weapon model packs ──
      if (path === "/api/weapons") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM weapon_model_packs ORDER BY name",
        ).all();
        return json({ packs: results });
      }

      // ── Events ingest (forwards to Cloudflare Pipelines stream) ──
      if (path === "/api/events" && request.method === "POST") {
        return await ingestEvents(request, env);
      }

      // ── AI chat (editor assistant) ──
      if (path === "/api/ai/chat" && request.method === "POST") {
        return await aiChat(request, env);
      }

      // ── Public character prefab by UUID (for external games) ──
      const prefabMatch = path.match(/^\/api\/prefab\/([a-zA-Z0-9_-]+)$/);
      if (prefabMatch) {
        return await getPrefab(env, prefabMatch[1]);
      }

      // ── Health check ──
      if (path === "/health" || path === "/") {
        return json({
          status: "ok",
          service: "grudge-models",
          version: "1.0.0",
        });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return json(
        { error: "Internal server error", message: err.message },
        500,
      );
    }
  },
};

/**
 * Build the full manifest — the single payload the frontend needs
 * to initialize FactionRegistry, EquipmentManager, and animation packs.
 */
async function getFullManifest(db) {
  const [modelsRes, slotsRes, animsRes, weaponsRes] = await Promise.all([
    db.prepare("SELECT * FROM models ORDER BY faction_id, race_id").all(),
    db
      .prepare("SELECT * FROM equipment_slots ORDER BY model_id, sort_order")
      .all(),
    db.prepare("SELECT * FROM animation_packs ORDER BY name").all(),
    db.prepare("SELECT * FROM weapon_model_packs ORDER BY name").all(),
  ]);

  // Group equipment slots by model_id
  const slotsByModel = {};
  for (const slot of slotsRes.results) {
    if (!slotsByModel[slot.model_id]) slotsByModel[slot.model_id] = [];
    slotsByModel[slot.model_id].push(slot);
  }

  // Build faction-grouped model structure (mirrors FactionRegistry.FACTIONS shape)
  const factions = {};
  for (const model of modelsRes.results) {
    if (!factions[model.faction_id]) {
      factions[model.faction_id] = {
        name: model.faction_name,
        color: model.faction_color,
        races: {},
      };
    }
    factions[model.faction_id].races[model.race_id] = {
      name: model.name,
      prefix: model.prefix,
      model: model.r2_url + "?" + ASSET_VERSION,
      format: model.format,
      skeletonType: model.skeleton_type,
      equipment: slotsByModel[model.id] || [],
    };
  }

  // Parse animation pack files JSON
  const animationPacks = {};
  for (const pack of animsRes.results) {
    animationPacks[pack.pack_key] = {
      name: pack.name,
      path: pack.r2_base_url,
      files: JSON.parse(pack.files || "[]"),
      extra: JSON.parse(pack.extra || "{}"),
    };
  }

  // Weapon model packs
  const weaponModelPacks = {};
  for (const pack of weaponsRes.results) {
    weaponModelPacks[pack.pack_key] = {
      name: pack.name,
      path: pack.r2_base_url,
      count: pack.count,
      prefix: pack.prefix,
    };
  }

  return json({
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    factions,
    animationPacks,
    weaponModelPacks,
  });
}

/**
 * POST /api/events — accept a batch of telemetry events and forward to the
 * grudge_events Pipelines stream. Server stamps `ts` authoritatively and
 * drops any field that isn't in the stream schema.
 *
 * Body: { events: [ {event_type, session_id?, grudge_id?, faction_id?, race_id?,
 *                    slot?, variant?, payload?}, ... ] }
 */
async function ingestEvents(request, env) {
  if (!env.GRUDGE_EVENTS_STREAM) {
    return json(
      { error: "Pipeline binding not configured" },
      503,
      CORS_NOCACHE,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, CORS_NOCACHE);
  }

  const events = Array.isArray(body) ? body : body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return json({ error: "events[] required" }, 400, CORS_NOCACHE);
  }
  if (events.length > MAX_BATCH) {
    return json(
      { error: `batch too large (max ${MAX_BATCH})` },
      413,
      CORS_NOCACHE,
    );
  }

  const now = Date.now();
  const rows = [];
  const rejected = [];

  for (const e of events) {
    if (!e || typeof e !== "object") {
      rejected.push("non-object");
      continue;
    }
    if (!ALLOWED_EVENT_TYPES.has(e.event_type)) {
      rejected.push(`bad event_type: ${e.event_type}`);
      continue;
    }
    rows.push({
      event_type: String(e.event_type),
      ts: now,
      session_id: e.session_id ? String(e.session_id).slice(0, 64) : null,
      grudge_id: e.grudge_id ? String(e.grudge_id).slice(0, 64) : null,
      faction_id: e.faction_id ? String(e.faction_id).slice(0, 32) : null,
      race_id: e.race_id ? String(e.race_id).slice(0, 32) : null,
      slot: e.slot ? String(e.slot).slice(0, 32) : null,
      variant: e.variant ? String(e.variant).slice(0, 64) : null,
      payload: capPayload(e.payload),
    });
  }

  if (rows.length === 0) {
    return json({ error: "no valid events", rejected }, 400, CORS_NOCACHE);
  }

  try {
    await env.GRUDGE_EVENTS_STREAM.send(rows);
  } catch (err) {
    console.error("Pipeline send failed:", err);
    return json(
      { error: "pipeline send failed", message: err.message },
      502,
      CORS_NOCACHE,
    );
  }

  return json(
    { ok: true, accepted: rows.length, rejected: rejected.length },
    200,
    CORS_NOCACHE,
  );
}

async function getModelWithEquipment(db, modelId) {
  const model = await db
    .prepare("SELECT * FROM models WHERE id = ?")
    .bind(modelId)
    .first();
  if (!model) return json({ error: "Model not found" }, 404);

  const { results: slots } = await db
    .prepare(
      "SELECT * FROM equipment_slots WHERE model_id = ? ORDER BY sort_order",
    )
    .bind(modelId)
    .all();

  return json({ model, equipment: slots });
}

// ════════════════════════════════════════════════════════════
// AI Chat — Workers AI (Llama 3.1 8B Instruct)
// ════════════════════════════════════════════════════════════
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const AI_SYSTEM_PROMPT = `You are the in-editor assistant for the Grudge Studio character creator. The user is editing a 3D character; reply briefly and translate their request into a JSON array of editor actions.

Allowed actions (use exactly these names and shapes):
  { "type": "setRace", "factionId": "<id>", "raceId": "<id>" }
  { "type": "equip", "slot": "<slot>", "variant": "<A|B|...>" }
  { "type": "unequip", "slot": "<slot>" }
  { "type": "setAttr", "key": "STR|DEX|INT|VIT|WIS|LCK|CHA|END", "value": <0-80> }
  { "type": "playAnim", "pack": "<packKey>", "file": "<filename>" }
  { "type": "save", "name": "<character name>" }

Slot ids: body, arms, legs, head, shoulders, axe, hammer, sword, pick, spear, bow, staff, shield, bag, wood, quiver.
Always respond with strict JSON: {"reply": "<one short sentence>", "actions": [ ... ]}. No markdown, no code fences.`;

async function aiChat(request, env) {
  if (!env.AI) {
    return json({ error: "AI binding not configured" }, 503, CORS_NOCACHE);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, CORS_NOCACHE);
  }

  const userMsg = (body?.message || "").toString().slice(0, 2000);
  if (!userMsg) return json({ error: "message required" }, 400, CORS_NOCACHE);

  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const context =
    body?.context && typeof body.context === "object" ? body.context : {};
  const contextSummary = JSON.stringify({
    race: context.race || null,
    equipped: context.equipped || {},
    attrs: context.attrs || {},
    availableRaces: (context.availableRaces || []).slice(0, 24),
    availableSlots: context.availableSlots || [],
  }).slice(0, 4000);

  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT },
    { role: "system", content: `Current editor state:\n${contextSummary}` },
    ...history
      .filter((m) => m && m.role && m.content)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content).slice(0, 1000),
      })),
    { role: "user", content: userMsg },
  ];

  let aiResp;
  try {
    aiResp = await env.AI.run(AI_MODEL, {
      messages,
      temperature: 0.3,
      max_tokens: 512,
    });
  } catch (err) {
    return json(
      { error: "ai run failed", message: err.message },
      502,
      CORS_NOCACHE,
    );
  }

  const raw = (aiResp?.response || "").toString().trim();
  let parsed;
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    parsed =
      jsonStart >= 0
        ? JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
        : { reply: raw, actions: [] };
  } catch {
    parsed = { reply: raw || "(no reply)", actions: [] };
  }
  return json(
    {
      reply: String(parsed.reply || "").slice(0, 1000),
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 16) : [],
    },
    200,
    CORS_NOCACHE,
  );
}

// ════════════════════════════════════════════════════════════
// Prefab — resolved character asset bundle for external games
// GET /api/prefab/:uuid returns absolute R2 URLs + the exact list of
// mesh names a game should toggle visible + which bone each weapon
// attaches to + the single matched animation pack with specials.
// ════════════════════════════════════════════════════════════

// Bone container names — identical across all 6 races (see FactionRegistry.js)
const BONE_CONTAINERS = {
  rightHand: "R_hand_container",
  leftHand: "L_hand_container",
  leftShield: "L_shield_container",
  bag: "Bone_bag",
  wood: "Bone_wood",
  quiver: "Quiver_container",
};

// Weapon slot → animation pack + key animation filenames + bone.
// Mirrors src/modules/GameData.js WEAPON_ANIM_MAP. Bone is a BONE_CONTAINERS key.
const WEAPON_ANIM_MAP = {
  sword: {
    pack: "pro_sword_shield",
    idle: "sword and shield idle.fbx",
    draw: "draw sword 1.fbx",
    sheath: "sheath sword 1.fbx",
    bone: "rightHand",
  },
  shield: {
    pack: "pro_sword_shield",
    idle: "sword and shield block idle.fbx",
    draw: null,
    sheath: null,
    bone: "leftShield",
  },
  "2h_sword": {
    pack: "great_sword",
    idle: "great sword idle.fbx",
    draw: "draw a great sword 1.fbx",
    sheath: "draw a great sword 2.fbx",
    bone: "rightHand",
  },
  axe: {
    pack: "pro_melee_axe",
    idle: "standing idle.fbx",
    draw: "standing disarm over shoulder.fbx",
    sheath: "standing disarm underarm.fbx",
    bone: "rightHand",
  },
  "2h_axe": {
    pack: "pro_melee_axe",
    idle: "standing idle.fbx",
    draw: "standing disarm over shoulder.fbx",
    sheath: "standing disarm underarm.fbx",
    bone: "rightHand",
  },
  hammer: {
    pack: "2h_melee",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  "2h_hammer": {
    pack: "2h_melee",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  mace: {
    pack: "2h_melee",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  dagger: {
    pack: "1h_sword_shield",
    idle: "sword and shield idle.fbx",
    draw: "draw sword 1.fbx",
    sheath: "sheath sword 1.fbx",
    bone: "rightHand",
  },
  spear: {
    pack: "2h_melee",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  bow: {
    pack: "pro_longbow",
    idle: "standing idle 01.fbx",
    draw: "standing equip bow.fbx",
    sheath: "standing disarm bow.fbx",
    bone: "leftHand",
  },
  crossbow: {
    pack: "rifle_crossbow",
    idle: "rifle aiming idle.fbx",
    draw: null,
    sheath: null,
    bone: "leftHand",
  },
  gun: {
    pack: "advanced_gun",
    idle: "idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  staff: {
    pack: "pro_magic",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  wand: {
    pack: "magic",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
  tome: {
    pack: "pro_magic",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "leftHand",
  },
  offhand_relic: {
    pack: "pro_magic",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "leftHand",
  },
  pick: {
    pack: "2h_melee",
    idle: "standing idle.fbx",
    draw: null,
    sheath: null,
    bone: "rightHand",
  },
};

// Priority for choosing the primary weapon when multiple weapons are equipped.
// First match wins (e.g. sword + shield → sword's pack, not shield's).
const PRIMARY_WEAPON_PRIORITY = [
  "2h_sword",
  "2h_axe",
  "2h_hammer",
  "bow",
  "crossbow",
  "gun",
  "staff",
  "wand",
  "sword",
  "axe",
  "hammer",
  "mace",
  "dagger",
  "spear",
  "pick",
  "tome",
  "offhand_relic",
  "shield",
];

function joinUrl(base, file) {
  if (!file) return null;
  if (!base) return file;
  return base.endsWith("/") ? base + file : base + "/" + file;
}

/**
 * Resolve equipped state into: list of mesh names to make visible, and
 * list of bone attachments. Each equipment_slots row is one (slot, variant)
 * with a fully-prefixed mesh_name and optional bone_container.
 */
function resolveEquipment(equipped, slotRows) {
  const bySlot = new Map();
  for (const r of slotRows) {
    if (!bySlot.has(r.slot)) bySlot.set(r.slot, []);
    bySlot.get(r.slot).push(r);
  }

  const visibleMeshes = [];
  const attachments = [];
  for (const [slot, variantValue] of Object.entries(equipped || {})) {
    if (variantValue === false || variantValue == null) continue;
    const rows = bySlot.get(slot);
    if (!rows) continue;
    const wanted = variantValue === true ? "_default" : String(variantValue);
    const match =
      rows.find((r) => r.variant === wanted) ||
      (variantValue === true ? rows[0] : null);
    if (!match) continue;
    visibleMeshes.push(match.mesh_name);
    if (match.bone_container) {
      attachments.push({
        slot,
        variant: match.variant,
        meshName: match.mesh_name,
        bone: match.bone_container,
      });
    }
  }

  const slots = [];
  for (const [slot, rows] of bySlot) {
    slots.push({
      slot,
      group: rows[0].slot_group,
      variants: rows.map((r) => ({
        variant: r.variant,
        meshName: r.mesh_name,
        bone: r.bone_container || null,
      })),
    });
  }

  return { visibleMeshes, attachments, slots };
}

/** Pick the primary weapon and resolve its animation pack to absolute URLs. */
function resolveAnimationPack(equipped, animPackRows) {
  let weaponSlot = null;
  for (const candidate of PRIMARY_WEAPON_PRIORITY) {
    if (equipped && equipped[candidate]) {
      weaponSlot = candidate;
      break;
    }
  }
  const mapping = weaponSlot ? WEAPON_ANIM_MAP[weaponSlot] : null;
  if (!mapping) return null;

  const packRow = animPackRows.find((p) => p.pack_key === mapping.pack);
  const baseUrl = packRow?.r2_base_url || null;
  const files = safeParseJson(packRow?.files, []);

  return {
    key: mapping.pack,
    name: packRow?.name || mapping.pack,
    baseUrl,
    files,
    specials: {
      idle: joinUrl(baseUrl, mapping.idle),
      draw: joinUrl(baseUrl, mapping.draw),
      sheath: joinUrl(baseUrl, mapping.sheath),
    },
    weaponSlot,
    bone: BONE_CONTAINERS[mapping.bone] || mapping.bone,
  };
}

async function getPrefab(env, uuid) {
  const apiBase = (
    env.GRUDGE_API_BASE || "https://api.grudge-studio.com"
  ).replace(/\/$/, "");
  let character = null;
  try {
    const res = await fetch(
      `${apiBase}/api/characters/${encodeURIComponent(uuid)}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (res.ok) character = await res.json();
  } catch {
    /* fall through */
  }
  if (!character || !character.factionId || !character.raceId) {
    return json({ error: "character not found", uuid }, 404);
  }

  const modelRow = await env.DB.prepare(
    "SELECT * FROM models WHERE faction_id = ? AND race_id = ?",
  )
    .bind(character.factionId, character.raceId)
    .first();
  if (!modelRow)
    return json(
      {
        error: "model not registered",
        factionId: character.factionId,
        raceId: character.raceId,
      },
      404,
    );

  const { results: slots } = await env.DB.prepare(
    "SELECT * FROM equipment_slots WHERE model_id = ? ORDER BY sort_order",
  )
    .bind(modelRow.id)
    .all();

  const { results: animPacks } = await env.DB.prepare(
    "SELECT pack_key, name, r2_base_url, files, extra FROM animation_packs",
  ).all();

  const equipped = character.equipped || {};
  const resolved = resolveEquipment(equipped, slots);
  const animationPack = resolveAnimationPack(equipped, animPacks);

  return json({
    uuid,
    name: character.name || null,
    grudgeId: character.grudgeId || character.userId || null,
    model: {
      factionId: modelRow.faction_id,
      raceId: modelRow.race_id,
      prefix: modelRow.prefix,
      url: modelRow.r2_url + "?" + ASSET_VERSION,
      format: modelRow.format,
      skeletonType: modelRow.skeleton_type,
      bones: BONE_CONTAINERS,
    },
    // What a game does: load model.url, set child.visible = visibleMeshes.includes(child.name),
    // then for each attachment, find the bone by name and parent the mesh node there.
    visibleMeshes: resolved.visibleMeshes,
    attachments: resolved.attachments,
    animationPack,
    equipment: {
      equipped,
      slots: resolved.slots,
    },
    stats: { attrs: character.attrs || {}, level: character.level || 1 },
    version: "1.1.0",
    generatedAt: new Date().toISOString(),
  });
}
