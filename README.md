# Grudge Character Creator

Modular 3D race character editor with equipment toggling, bone weapon attachment, stat allocation, combat simulation, and persistent saves. Built for [Grudge Studio](https://grudge-studio.com) by Racalvin The Pirate King.

**Live:** [grudge-character-creator.vercel.app](https://grudge-character-creator.vercel.app)  
**Manifest API:** [models.grudge-studio.com](https://models.grudge-studio.com/health) (v2.0.0)

## Features

- **6 Faction Races** — Human (WK_), Barbarian (BRB_), Elf (ELF_), Dwarf (DWF_), Orc (ORC_), Undead (UD_)
- **42 Equipment Slots Per Race** — Armor (body×5, arms×4, legs×3, head×9, shoulders×2), weapons, shields, utility
- **Equipment Resolution** — D1 manifest maps equipment state → mesh names → R2 GLB URLs, identical to the Unity game
- **Bone Weapon Editor** — Attach any weapon FBX/GLB to any bone with live transform sliders, quick-equip presets for 22 weapon types (sword, pistol, rifle, crossbow, dual wield, etc.), save configs to D1
- **15 Weapon Model Packs** — Swords, Axes, Daggers, Hammers, Staffs, Bows, Crossbows, Shields, Fantasy, Medieval (340+ weapons)
- **8-Attribute Stats** — STR/DEX/INT/VIT/WIS/LCK/CHA/END with diminishing returns and 37 derived stats
- **14 Animation Packs** — 1H Sword+Shield, 2H Melee, Longbow, Magic, Great Sword, Rifle, and 8 more
- **Combat Simulation** — 8-step pipeline with crit, block, dodge, reflect, absorb
- **Persistent Saves** — Grudge UUID auth via api.grudge-studio.com (guest + Discord + Google)
- **Class & Profession Trees** — Warrior, Ranger, Mage, Worge with skill trees and 5 harvesting professions

## Architecture

```
┌─────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│   Vercel    │─────▷│  Cloudflare Worker (D1 API)  │      │   Cloudflare R2  │
│  (Frontend) │      │  models.grudge-studio.com     │      │  assets.grudge-  │
│  Vite SPA   │      │  /api/manifest → D1 query    │      │  studio.com      │
│             │      │  /api/weapon-attachments CRUD │      │                  │
└──────┬──────┘      └──────────────────────────────┘      └────────┬────────┘
       │                                                            │
       │  Equipment state + bone attachments             GLB/FBX    │
       │  (faction + race + slot + variant)               models    │
       │         │                                     served via   │
       │         ▼                                     CDN URL      │
       │  EquipmentManager.js + BoneWeaponEditor.js         │
       │  mesh toggle + weapon-to-bone attachment  ◁────────┘
       │
       └──────▷ api.grudge-studio.com
                (Grudge backend — auth + character CRUD)
```

## Quick Start (Local Dev)

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`. FBX models are served from the parent directory via the Vite plugin in `vite.config.js`. No R2/D1 needed — the app falls back to bundled `FactionRegistry.js` data.

## Project Structure

```
grudge-character-creator/
├── d1/                    # Cloudflare D1 schema + seed data
│   ├── schema.sql         # Tables: models, equipment_slots, animation_packs,
│   │                      #   weapon_model_packs, weapon_bone_attachments
│   └── seed.sql           # Generated: 6 models, 252 equipment slots, 14 anim packs,
│                           #   15 weapon model packs, 19 bone attachment presets
├── worker/
│   └── index.js           # Cloudflare Worker — D1 manifest + weapon attachment CRUD
├── scripts/
│   ├── convert-models.mjs # FBX → GLB pipeline (preserves mesh hierarchy)
│   ├── upload-r2.mjs      # Upload GLBs to R2 CDN
│   ├── gen-seed-sql.mjs   # Generate d1/seed.sql (models + equip + anims + weapons + presets)
│   └── seed-d1.mjs        # Direct D1 seeder via wrangler CLI
├── src/
│   ├── main.js            # App entry — scene, UI, boot sequence
│   └── modules/
│       ├── AssetConfig.js      # R2 URL builder (VITE_R2_BASE_URL)
│       ├── ApiClient.js        # Puter auth + D1 bone attachment CRUD
│       ├── GrudgeAuth.js       # Grudge backend auth (guest + Discord + Google)
│       ├── CharacterStore.js   # Character CRUD via GrudgeAuth
│       ├── EquipmentManager.js # Prefix-based mesh toggle (WK_Units_Body_A)
│       ├── FactionRegistry.js  # Fetches D1 manifest, falls back to bundled data
│       ├── SmartLoader.js      # Auto-detect FBX/GLTF/OBJ/DAE/STL/USDZ loader
│       ├── StatsEngine.js      # 8 attrs → 37 derived stats + combat sim
│       ├── GameData.js         # Classes, skills, professions, 17 weapon types
│       ├── WeaponLibrary.js    # 22 weapon-type → bone presets (pos/rot/scale)
│       ├── BoneWeaponEditor.js # UI: quick equip, bone picker, transform sliders, D1 save
│       ├── BoneAttachment.js   # Skeleton-aware weapon attach/detach with alias system
│       ├── WeaponAnimController.js # Weapon ↔ animation pack binding + combat FSM
│       ├── ForgePanel.js       # Drag-drop model inspector with hierarchy tree
│       ├── PostFX.js           # Bloom, tone mapping post-processing
│       ├── VFXManager.js       # Particle effects
│       ├── BossFight.js        # Boss arena mode
│       ├── TextureResolver.js  # Auto-resolve toon/PBR textures
│       └── AssetCache.js       # Asset preloading
├── wrangler.toml          # Cloudflare Worker + D1 config
├── vercel.json            # Vercel deployment + API rewrites
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

The Cloudflare Worker at `models.grudge-studio.com` serves the model manifest and weapon attachment CRUD from D1 at edge.

| Endpoint | Method | Description |
|---|---|---|
| `/api/manifest` | GET | Full manifest (factions + equipment + animations + weapon packs) |
| `/api/models` | GET | All 6 race models |
| `/api/models/:id` | GET | Single model with equipment slots |
| `/api/models/:id/equip` | GET | Equipment slots for a model |
| `/api/animations` | GET | All animation packs |
| `/api/weapons` | GET | All 15 weapon model packs |
| `/api/weapon-attachments/:modelId` | GET | Bone attachment presets for a model |
| `/api/weapon-attachments` | POST | Create a new bone attachment |
| `/api/weapon-attachments/:id` | PUT | Update attachment transforms |
| `/api/weapon-attachments/:id` | DELETE | Remove a bone attachment |
| `/health` | GET | Health check (v2.0.0) |

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

## Bone Weapon Editor

The bottom-panel **Bone Weapon Editor** provides:

- **Quick Equip Grid** — 22 weapon type presets (1H sword, dagger, pistol, rifle, crossbow, dual swords, dual daggers, etc.) that auto-select the correct bone + transform offsets
- **Bone Picker** — Dropdown of all skeleton bones + quick-slot buttons (R Hand, L Hand, Shield, Back, Head, Hips)
- **Live Transform Sliders** — Position XYZ, Rotation XYZ, Scale with real-time 3D preview
- **Dual Wield** — Preset types like Dual Swords/Daggers/Axes load both main + offhand weapons simultaneously
- **D1 Persistence** — Save/load/delete attachment configs via the Worker API
- **Reset** — Snap sliders back to preset defaults without detaching

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

## Tech Stack

- **Frontend:** Vanilla JS + Three.js, Vite
- **3D:** FBXLoader + GLTFLoader + OBJ/DAE/STL/USDZ (SmartLoader), EquipmentManager mesh toggling, BoneAttachment weapon-to-bone system
- **Backend:** Grudge API (api.grudge-studio.com) — Express, PostgreSQL, Drizzle ORM
- **Model Manifest:** Cloudflare D1 (SQLite at edge) + Worker API (models.grudge-studio.com)
- **Asset CDN:** Cloudflare R2 (assets.grudge-studio.com)
- **Hosting:** Vercel (grudge-character-creator.vercel.app)
- **Auth:** Grudge UUID + Discord/Google OAuth via backend
- **Weapon Library:** 15 packs (340+ models), 22 bone presets, D1 CRUD for custom attachments
