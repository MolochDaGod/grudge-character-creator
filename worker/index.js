/**
 * Cloudflare Worker — Model Manifest API
 *
 * Queries D1 (grudge-models) and returns model/equipment/animation data.
 * Deploy: npx wrangler deploy (uses wrangler.toml at project root)
 *
 * Endpoints:
 *   GET /api/manifest           — full manifest (all models + equipment + anims)
 *   GET /api/models             — list all race models
 *   GET /api/models/:id         — single model with equipment slots
 *   GET /api/models/:id/equip   — equipment slots for a model
 *   GET /api/animations         — all animation packs
 *   GET /api/weapons            — all weapon model packs
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Full manifest (primary endpoint for frontend) ──
      if (path === '/api/manifest') {
        return await getFullManifest(env.DB);
      }

      // ── Models ──
      if (path === '/api/models') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM models ORDER BY faction_id, race_id'
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
          'SELECT * FROM equipment_slots WHERE model_id = ? ORDER BY sort_order'
        ).bind(equipMatch[1]).all();
        return json({ slots: results });
      }

      // ── Animation packs ──
      if (path === '/api/animations') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM animation_packs ORDER BY name'
        ).all();
        return json({ packs: results.map(p => ({ ...p, files: JSON.parse(p.files || '[]') })) });
      }

      // ── Weapon model packs ──
      if (path === '/api/weapons') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM weapon_model_packs ORDER BY name'
        ).all();
        return json({ packs: results });
      }

      // ── Health check ──
      if (path === '/health' || path === '/') {
        return json({ status: 'ok', service: 'grudge-models', version: '1.0.0' });
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error', message: err.message }, 500);
    }
  },
};

/**
 * Build the full manifest — the single payload the frontend needs
 * to initialize FactionRegistry, EquipmentManager, and animation packs.
 */
async function getFullManifest(db) {
  const [modelsRes, slotsRes, animsRes, weaponsRes] = await Promise.all([
    db.prepare('SELECT * FROM models ORDER BY faction_id, race_id').all(),
    db.prepare('SELECT * FROM equipment_slots ORDER BY model_id, sort_order').all(),
    db.prepare('SELECT * FROM animation_packs ORDER BY name').all(),
    db.prepare('SELECT * FROM weapon_model_packs ORDER BY name').all(),
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
      model: model.r2_url,
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
      files: JSON.parse(pack.files || '[]'),
      extra: JSON.parse(pack.extra || '{}'),
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
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    factions,
    animationPacks,
    weaponModelPacks,
  });
}

async function getModelWithEquipment(db, modelId) {
  const model = await db.prepare('SELECT * FROM models WHERE id = ?').bind(modelId).first();
  if (!model) return json({ error: 'Model not found' }, 404);

  const { results: slots } = await db.prepare(
    'SELECT * FROM equipment_slots WHERE model_id = ? ORDER BY sort_order'
  ).bind(modelId).all();

  return json({ model, equipment: slots });
}
