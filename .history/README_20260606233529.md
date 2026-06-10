# Grudge Character Creator

Modular 3D race character editor with equipment toggling, stat allocation, combat simulation, and persistent saves. Built for [Grudge Studio](https://grudge-studio.com) by Racalvin The Pirate King.

**Live:** [playground-teal-zeta.vercel.app](https://playground-teal-zeta.vercel.app)  
**Manifest API:** [grudge-models-worker.grudge.workers.dev](https://grudge-models-worker.grudge.workers.dev/health)

## Features

- **6 Faction Races** — Human (WK_), Barbarian (BRB_), Elf (ELF_), Dwarf (DWF_), Orc (ORC_), Undead (UD_)
- **42 Equipment Slots Per Race** — Armor (body×5, arms×4, legs×3, head×9, shoulders×2), weapons, shields, utility
- **Equipment Resolution** — D1 manifest maps equipment state → mesh names → R2 GLB URLs, identical to the Unity game
- **8-Attribute Stats** — STR/DEX/INT/VIT/WIS/LCK/CHA/END with diminishing returns and 37 derived stats
- **14 Animation Packs** — 1H Sword+Shield, 2H Melee, Longbow, Magic, Great Sword, Rifle, and 8 more
- **Combat Simulation** — 8-step pipeline with crit, block, dodge, reflect, absorb
- **Persistent Saves** — Grudge UUID auth via api.grudge-studio.com (guest + Discord + Google)
- **Class & Profession Trees** — Warrior, Ranger, Mage, Worge with skill trees and 5 harvesting professions

## Architecture

```
┌─────────────┐      ┌────────────────────────────────────┐      ┌─────────────────┐
│   Vercel    │─────▷│  Cloudflare Worker                 │      │   Cloudflare R2 │
│  (Frontend) │      │  models.grudge-studio.com          │      │  assets.grudge- │
│  Vite SPA   │      │  /api/manifest → D1 query          │      │  studio.com     │
└──────┬──────┘      │  /api/events   → Pipelines stream  │      └────────┬────────┘
       │             └─────────────┬──────────────────────┘               │
       │                           │                                       │
       │  Equipment state          ▼ env.GRUDGE_EVENTS_STREAM.send()       │
       │                  ┌───────────────────────────┐                    │
       │                  │  grudge_events pipeline   │                    │
       │                  │   stream → SQL → sink     │                    │
       │                  └─────────────┬─────────────┘                    │
       │                                ▼                                  │
       │                  ┌───────────────────────────┐    GLB models      │
       │                  │  r2://grudge-events       │    served via      │
       │                  │  parquet+zstd, partitioned│    CDN URL         │
       │                  └───────────────────────────┘                    │
       │         ▼                                                         │
       │  EquipmentManager.js                                              │
       │  toggles child mesh visibility                                    │
       │  by name (e.g. WK_Units_Body_A)  ◁────────────────────────────────┘
       │
       └──────▷ api.grudge-studio.com
                (Grudge backend — auth + character CRUD)
```

Two services live behind a single Worker (`models.grudge-studio.com`):

1. **Manifest API** — read-only D1 queries that tell the SPA which meshes exist for each race.
2. **Events ingest** — batched POSTs from the SPA forwarded to the `grudge_events` Cloudflare Pipelines stream, which lands them in R2 as Parquet for downstream analytics.

## Quick Start (Local Dev)

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`. FBX models are served from the parent directory via the Vite plugin in `vite.config.js`. No R2/D1 needed — the app falls back to bundled `FactionRegistry.js` data.

## Project Structure

```
playground/
├── d1/                    # Cloudflare D1 schema + seed data
│   ├── schema.sql         # Tables: models, equipment_slots, animation_packs, weapon_model_packs
│   └── seed.sql           # Generated: 6 models, 252 equipment slots, 14 animation packs
├── worker/
│   └── index.js           # Cloudflare Worker — D1 manifest API
├── scripts/
│   ├── convert-models.mjs # FBX → GLB pipeline (preserves mesh hierarchy)
│   ├── upload-r2.mjs      # Upload GLBs to R2 CDN
│   └── gen-seed-sql.mjs   # Generate d1/seed.sql from faction data
├── src/
│   ├── main.js            # App entry — scene, UI, boot sequence
│   └── modules/
│       ├── AssetConfig.js      # R2 URL builder (VITE_R2_BASE_URL)
│       ├── GrudgeAuth.js       # Grudge backend auth (guest + Discord + Google)
│       ├── CharacterStore.js   # Character CRUD via GrudgeAuth
│       ├── EquipmentManager.js # Prefix-based mesh toggle (WK_Units_Body_A)
│       ├── FactionRegistry.js  # Fetches D1 manifest, falls back to bundled data
│       ├── SmartLoader.js      # Auto-detect FBX/GLTF loader
│       ├── StatsEngine.js      # 8 attrs → 37 derived stats + combat sim
│       ├── GameData.js         # Classes, skills, professions, weapon types
│       ├── WeaponAnimController.js # Weapon ↔ animation pack binding
│       ├── BoneAttachment.js   # Attach weapons to bone containers
│       ├── PostFX.js           # Bloom, tone mapping post-processing
│       ├── VFXManager.js       # Particle effects
│       ├── BossFight.js        # Boss arena mode
│       ├── AssetCache.js       # Asset preloading
│       └── Telemetry.js        # Event batcher → /api/events → Pipelines → R2
├── d1/pipelines/
│   └── grudge-events.schema.json # Source-of-truth schema for the events stream
├── wrangler.toml          # Cloudflare Worker + D1 + Pipelines config
├── vercel.json            # Vercel deployment config
├── vite.config.js         # Vite + local asset serving plugin
├── server.js              # Express server for local production testing
└── index.html             # Single-page app shell
```

## Deployment

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated with Cloudflare
- [Vercel CLI](https://vercel.com/docs/cli) linked to the project
- FBX source models (Toon_RTS pack) for GLB conversion

### 1. D1 Database (already done)

```bash
# Create database (one-time)
npx wrangler d1 create grudge-models
# → Put the database_id in wrangler.toml

# Apply schema
npx wrangler d1 execute grudge-models --remote --file=d1/schema.sql

# Seed data
node scripts/gen-seed-sql.mjs
npx wrangler d1 execute grudge-models --remote --file=d1/seed.sql
```

### 2. Worker Deployment (already done)

```bash
npx wrangler deploy
# → https://grudge-models-worker.grudge.workers.dev
```

### 3. Model Pipeline (FBX → GLB → R2)

```bash
# Convert FBX models to optimized GLB (preserves mesh hierarchy)
npm run convert
# → Output: dist-models/*.glb

# Upload to R2 CDN
npm run upload
# → https://assets.grudge-studio.com/models/characters/*.glb
```

**Critical:** The conversion skips `gltf-transform join` and `flatten` to preserve per-mesh toggleability. All child mesh names (e.g. `WK_Units_Body_A`) and bone containers (`R_hand_container`, `L_shield_container`) must survive intact.

### 4. Vercel Deployment (already done)

Env vars (set via `vercel env add` or Vercel dashboard):

- `VITE_R2_BASE_URL` = `https://assets.grudge-studio.com`
- `VITE_MANIFEST_API` = `https://grudge-models-worker.grudge.workers.dev`
- `VITE_GRUDGE_API` = `https://api.grudge-studio.com`

```bash
npx vercel --prod
```

## D1 Manifest API

The Cloudflare Worker serves the model manifest from D1 at edge, so the frontend knows which meshes to toggle for each equipment combination.

| Endpoint | Description |
|---|---|
| `GET /api/manifest` | Full manifest (factions + equipment + animations) |
| `GET /api/models` | All 6 race models |
| `GET /api/models/:id` | Single model with equipment slots |
| `GET /api/models/:id/equip` | Equipment slots for a model |
| `GET /api/animations` | All animation packs |
| `GET /api/weapons` | Weapon model packs |
| `GET /health` | Health check |

## Equipment Slot Architecture

All 6 race models share identical mesh naming with race-specific prefixes:

| Slot | Group | Variants | Mesh Name Pattern | Bone Container |
|---|---|---|---|---|
| body | armor | A–E | `{PREFIX}Units_Body_{V}` | — |
| arms | armor | A–D | `{PREFIX}Units_Arms_{V}` | — |
| legs | armor | A–C | `{PREFIX}Units_Legs_{V}` | — |
| head | armor | A–I | `{PREFIX}Units_head_{V}` | — |
| shoulders | armor | A–B | `{PREFIX}Units_shoulderpads_{V}` | — |
| sword | weapon_r | A–B | `{PREFIX}Units_sword_{V}` | R_hand_container |
| axe | weapon_r | A–B | `{PREFIX}Units_axe_{V}` | R_hand_container |
| hammer | weapon_r | A–B | `{PREFIX}Units_hammer_{V}` | R_hand_container |
| pick | weapon_r | — | `{PREFIX}Units_pick` | R_hand_container |
| spear | weapon_r | — | `{PREFIX}Units_spear` | R_hand_container |
| bow | weapon_l | — | `{PREFIX}Units_Bow` | L_hand_container |
| staff | weapon_l | A–C | `{PREFIX}Units_staff_{V}` | L_hand_container |
| shield | shield | A–D | `{PREFIX}Units_shield_{V}` | L_shield_container |
| bag | utility | — | `{PREFIX}Xtra_bag` | Bone_bag |
| wood | utility | — | `{PREFIX}Xtra_wood` | Bone_wood |
| quiver | utility | — | `{PREFIX}Xtra_quiver` | Quiver_container |

**Prefixes:** WK_ (Human), BRB_ (Barbarian), ELF_ (Elf), DWF_ (Dwarf), ORC_ (Orc), UD_ (Undead)

## Auth

Authentication is handled by `GrudgeAuth.js` which connects to `api.grudge-studio.com`:

- **Guest Login** — Auto-creates a Grudge UUID, returns JWT
- **Discord OAuth** — Redirects to backend `/auth/discord`, returns with token
- **Google OAuth** — Redirects to backend `/auth/google`
- **Session** — Token stored in sessionStorage, restored on page load

Character CRUD (create/read/update/delete) goes through the Grudge backend, not local storage.

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (localhost:3000) |
| `npm run build` | Build for production |
| `npm run serve` | Build + run Express server (localhost:4010) |
| `npm run convert` | FBX → GLB conversion |
| `npm run upload` | Upload GLBs to R2 |
| `npm run seed` | Seed D1 (uses old script) |
| `npm run d1:init` | Apply D1 schema (remote) |
| `npm run worker:dev` | Run Worker locally |
| `npm run worker:deploy` | Deploy Worker to Cloudflare |

## Controls & Hotkeys

The viewport listens for `keydown` on `document.body` only — focus an input first and hotkeys are suppressed so you can type freely.

| Key | Action | Module |
|---|---|---|
| `1`–`4` | Trigger hotbar slot 1–4 (weapon-specific action) | `WeaponAnimController.triggerAction('slotN')` |
| `Q` (hold) | Block stance — releases on `keyup` | `triggerAction('block')` / `releaseBlock()` |
| `E` | Dodge | `triggerAction('dodge')` |
| `Z` | Battle Cry — alias for slot 4 with status banner | `triggerAction('slot4')` |
| `Tab` | Toggle Combat / Harvest mode (rebinds hotbar) | `toggleMode()` |
| `X` | Sheath current weapon (returns to unarmed pack) | `sheathWeapon()` |

The on-screen hotbar (`#hotbarDisplay`) re-renders via `buildHotbarUI()` every time `WeaponAnimController` emits `change`, so the labels track the currently-equipped weapon type.

Pointer controls are `OrbitControls` (left = rotate, right = pan, wheel = zoom) bound in `initScene()`.

## Edit UI

The right-hand panel is a tabbed editor wired up in `setupTabs()`. Each tab is populated by a dedicated builder so panels are independent:

| Tab | Builder | Purpose |
|---|---|---|
| Equipment | `buildEquipmentUI(slots)` | Per-slot variant buttons grouped by `EquipmentManager.getGroupedSlots()`. Clicking a button calls `equipMgr.equip()` (armor) or `equipMgr.equipWeapon()` + `WeaponAnimController.equipWeapon()` (weapons/shields). The ✕ button calls `unequip(slot)`. |
| Animations | `buildAnimationUI()` | `weaponPackSelect` dropdown drives `loadAnimation(packKey, fileName)`. |
| Stats | `buildStatsPanel()` | 8 attribute sliders → `recalcStats()` → `calculateDerivedStats()`. |
| Classes | `buildClassSelector()` | Class skill tree, no scene impact. |
| Weapon Skills | `buildWeaponTypeGrid()` | Weapon mastery picker. |
| Professions | `buildProfessionsPanel()` | T0–T8 profession tiers from `PROFESSIONS`. |
| Weapon Mastery | `buildMasteryPanel()` | Simulated mastery XP per weapon. |
| Saved Characters | `buildSavedCharactersList()` | `CharacterStore` CRUD with Save / Update / Load / Delete. |

The status line at `#statusText` is updated by `updateStatus(msg)` after every model load, equipment change, save, and combat action.

## Telemetry Pipeline

User actions are batched in the browser by `src/modules/Telemetry.js` and POSTed to `models.grudge-studio.com/api/events`. The Worker validates the batch, stamps server-side `ts`, and forwards rows to the `grudge_events` Cloudflare Pipelines stream, which lands them in R2 as zstd-compressed Parquet partitioned by date/hour.

### Event types

| Event | Trigger | Top-level fields | Payload keys |
|---|---|---|---|
| `session_start` | `telemetry.init()` | — | `ua`, `lang` |
| `session_end` | `pagehide` (sendBeacon) | — | — |
| `asset_load` | Race model finishes loading | `faction_id`, `race_id` | `meshCount`, `animationCount`, `result` |
| `equipment_change` | Armor slot button click | `faction_id`, `race_id`, `slot`, `variant` | `action` (`equip`/`unequip`) |
| `weapon_equip` | Weapon/shield slot button click | `faction_id`, `race_id`, `slot`, `variant` | `animPack` |
| `combat_action` | Combat hotkey pressed | `faction_id`, `race_id` | `action`, `weapon`, `mode` |
| `character_save` | Save button | `faction_id`, `race_id` | `level`, `slots` |
| `character_update` | Update button | `faction_id`, `race_id` | `level`, `slots` |

Every row also gets `session_id` (random 16-hex per tab), `grudge_id` (set after sign-in), and the authoritative server `ts`. Anything not in the schema is dropped silently by Pipelines, so add new top-level columns by recreating the stream — do **not** stuff arbitrary fields outside `payload`.

### Pipeline resources

| Resource | Name | ID |
|---|---|---|
| R2 bucket | `grudge-events` | — |
| Stream | `grudge_events_stream` | `074935299dc44ef089b448fdf065768f` |
| Sink | `grudge_events_sink` | `2267fbbde5984e5591a3d003ba0b22e1` |
| Pipeline | `grudge_events` | `d4de2ebbe8c04fa89a1e13f3bb3e9a97` |

Schema source of truth: `d1/pipelines/grudge-events.schema.json`. Worker binding: `GRUDGE_EVENTS_STREAM` (see `wrangler.toml`).

Smoke test the Worker endpoint:

```powershell
$body = '{"events":[{"event_type":"pipeline_smoke_test","payload":{"source":"local"}}]}'
Invoke-RestMethod -Uri 'https://models.grudge-studio.com/api/events' -Method Post `
  -ContentType 'application/json' -Body $body
```

## Dependencies

Runtime (browser):

- **three** — WebGL renderer, scene graph, loaders (FBX/GLTF/OBJ/STL/Collada/USDZ), `AnimationMixer`, `OrbitControls`.
- **postprocessing** — Used by `PostFX.js` for bloom + tone mapping.
- Native browser APIs only for telemetry — no analytics SDK.

Build / tooling:

- **vite** — Dev server + production bundler.
- **wrangler** — Cloudflare Worker deploy + D1 + Pipelines management.
- **@gltf-transform/cli** (via `npm run convert`) — FBX → GLB pipeline.

Backend (separate repos, consumed only via HTTP):

- **api.grudge-studio.com** — Grudge backend (Express + PostgreSQL + Drizzle ORM). Issues JWTs, owns character CRUD.
- **models.grudge-studio.com** — This repo's Worker. Owns D1 manifest and events ingest.
- **assets.grudge-studio.com** — R2 CDN. Static GLB + animation FBX bucket.

## Tech Stack

- **Frontend:** Vanilla JS + Three.js, Vite
- **3D:** FBXLoader + GLTFLoader (SmartLoader auto-detects), EquipmentManager mesh toggling
- **Backend:** Grudge API (api.grudge-studio.com) — Express, PostgreSQL, Drizzle ORM
- **Model Manifest:** Cloudflare D1 (SQLite at edge) + Worker API
- **Events Pipeline:** Cloudflare Pipelines (stream → SQL → sink) → R2 Parquet+zstd
- **Asset CDN:** Cloudflare R2 (assets.grudge-studio.com)
- **Hosting:** Vercel (SPA deployment)
- **Auth:** Grudge UUID + Discord/Google OAuth via backend
