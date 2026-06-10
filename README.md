# Grudge Character Creator

R3F + Rapier 3D game client for [Grudge Studio](https://grudge-studio.com) — character creation, equipment loadouts, class/weapon skill trees, crafting, combat, and 3D world gameplay. Built by Racalvin The Pirate King.

**Live:** [grudge-character-creator.vercel.app/game/](https://grudge-character-creator.vercel.app/game/)
**Manifest API:** [models.grudge-studio.com](https://models.grudge-studio.com/health)
**Assets CDN:** [assets.grudge-studio.com](https://assets.grudge-studio.com)

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Wouter (SPA routing)
- **3D Engine:** React Three Fiber (R3F), @react-three/drei, @react-three/rapier (WASM physics)
- **State:** Zustand (persisted stores), TanStack React Query
- **UI Kit:** Radix UI primitives, Lucide icons, Framer Motion
- **Monorepo:** pnpm workspaces — `@workspace/character-kit`, `@workspace/game-content`, `@workspace/api-client-react`
- **Backend:** Grudge API (api.grudge-studio.com) — auth, character CRUD, game data
- **Model Manifest:** Cloudflare D1 + Worker (models.grudge-studio.com)
- **Asset CDN:** Cloudflare R2 (assets.grudge-studio.com)
- **Hosting:** Vercel (pre-built static deploy, `/game/` base path)

## Routes

All routes live under `/game/` base path:

| Route | Page | Description |
|---|---|---|
| `/game/` | Overview | Codex home — faction races, classes, game systems |
| `/game/world` | WorldPage | **3D world** — R3F canvas, Rapier physics, character controller, combat |
| `/game/panel` | Panel | **Main game panel** — equipment, attributes, derived stats, class skills, weapon mastery, crafting, quests, guild |
| `/game/foundry` | Foundry | Full crafting workbench — T0-T8 recipes, profession tiers |
| `/game/classes` | Classes | Class browser — Warrior, Ranger, Mage, Worge |
| `/game/weapons` | Weapons | Weapon type codex — 17 types, skill grids |
| `/game/animations` | Animations | Animation pack browser |
| `/game/controller` | Controller | Character controller reference |
| `/game/harvest` | Harvest | Harvesting professions — Mining, Foresting, Mystic, Chef, Engineer |
| `/game/hud` | GameHud | In-game HUD layout |
| `/game/character` | CharacterWindow | Character sheet overlay |
| `/game/spellbook` | SpellBook | Spell/ability book |
| `/game/inventory` | InventoryQuest | Inventory + quest tracker |

## Architecture

```
grudge-character-creator.vercel.app
  /              redirect -> /game/
  /game/*        R3F React SPA (Vite pre-built, static)
  /game/world    3D World (Three.js + Rapier WASM, lazy-loaded)
  /game/panel    Main Panel (equipment, stats, skills, crafting)
  /api/*         Vercel rewrites to grudge-studio.com backend
    /api/auth/*              -> id.grudge-studio.com
    /api/characters/*        -> api.grudge-studio.com
    /api/weapon-attachments  -> models.grudge-studio.com (D1)
    /api/manifest            -> models.grudge-studio.com (D1)
    /api/weapons             -> models.grudge-studio.com (D1)

models.grudge-studio.com (Cloudflare Worker + D1)
  /api/manifest              Full faction/equipment/animation/weapon manifest
  /api/weapon-attachments    Bone attachment CRUD
  /api/ai/chat               Workers AI (Llama 3.1)
  /api/events                Telemetry pipeline -> R2 (parquet)

assets.grudge-studio.com (Cloudflare R2)
  Character models, animations, textures, weapon packs
```

## Game Systems

### Panel (`/game/panel`)

The main game panel is the player's command center with 9 tabs:

- **Equipment** — 12-slot canonical loadout (mainhand, offhand, helm, shoulder, chest, hands, back, neck, legs, feet, ring, relic) with drag-equip, set bonuses, and rarity tiers
- **Attributes** — 8 attributes (STR/INT/VIT/DEX/END/WIS/AGI/TAC) with 160 distributable points, illustrated icons, and real-time stat preview
- **Derived Stats** — 37 combat stats computed from attributes with diminishing returns, combat power rating (S-F), and build tier
- **Class Skills** — Per-class skill tree (Warrior/Ranger/Mage/Worge) with tiered unlocks gated by character level
- **Weapon Mastery** — Per-weapon-type skill trees (sword, axe, bow, staff, etc.) with rank progression
- **Crafting** — Inline T0-T1 crafting station with profession workbenches, material checking, and links to full Foundry
- **Quests** — Quest tracker with progress bars, reward claiming, and tracking toggles
- **Upgrades** — Equipment upgrade cards with per-level scaling
- **Guild** — Guild roster with search, online filter, rank/level/name sorting

### 3D World (`/game/world`)

- R3F Canvas with Rapier physics (WASM)
- Character controller with camera rig
- Training course, dummies, skill VFX
- Weapon attachment panel (bone presets, live transforms)
- Race selection synced with panel loadout

### Character System

- **6 Faction Races** — Human (WK), Barbarian (BRB), Elf (ELF), Dwarf (DWF), Orc (ORC), Undead (UD)
- **4 Classes** — Warrior, Ranger, Mage, Worge — each with unique skill trees and roles
- **17 Weapon Types** — Sword, Axe, Hammer, Mace, Staff, Bow, Spear, Dagger, Shield, Pick, etc.
- **Combat Loadout** — Class-locked combat set with 9 skill slots fed from weapon skill API
- **Harvest Loadout** — Non-combat gathering set with profession tools

### Data Sources

- **ObjectStore CDN** — `molochdagod.github.io/ObjectStore` — icons for weapons, armor, potions, materials
- **Grudge Weapon Skills API** — Live weapon type skill grids with damage, cooldown, cast time, range, effects
- **`@workspace/game-content`** — Static game data: classes, weapon skill trees, tier definitions
- **`@workspace/character-kit`** — Race IDs, race assets, character presets, asset base URL management

## D1 Manifest API

| Endpoint | Method | Description |
|---|---|---|
| `/api/manifest` | GET | Full manifest (factions + equipment + animations + weapon packs) |
| `/api/weapon-attachments/:modelId` | GET | Bone attachment presets |
| `/api/weapon-attachments` | POST | Create bone attachment |
| `/api/weapon-attachments/:id` | PUT/DELETE | Update/remove attachment |
| `/api/ai/chat` | POST | AI assistant (Workers AI) |
| `/api/events` | POST | Telemetry events |
| `/health` | GET | Health check |

## Auth

Authentication via `api.grudge-studio.com`:

- **Guest Login** — Auto-creates Grudge UUID, returns JWT
- **Discord OAuth** — Redirect flow via backend
- **Google OAuth** — Redirect flow via backend
- **Puter Bridge** — Optional puter ID linking for cloud storage

Character CRUD goes through the Grudge backend — no local storage for player data.

## Deployment

Pre-built static files (no build step on Vercel):

```json
{
  "buildCommand": "",
  "outputDirectory": "dist",
  "framework": null
}
```

- `/` redirects to `/game/`
- `/game/*` SPA fallback to `/game/index.html`
- `/api/*` proxied to grudge-studio.com services

### Deploy commands

```bash
npx wrangler deploy          # Worker -> models.grudge-studio.com
npx vercel --prod            # Frontend -> grudge-character-creator.vercel.app
```

## Source Structure (gametest artifact)

```
artifacts/gametest/src/
  main.tsx                    Entry — React root, asset base config
  App.tsx                     Router (wouter), lazy route splitting
  pages/
    Overview.tsx              Codex home
    Panel.tsx                 Main game panel (9 tabs)
    PanelData.ts              Entity data, attributes, stats, slots
    Classes.tsx               Class browser
    Weapons.tsx               Weapon codex
    Harvest.tsx               Harvesting professions
    Foundry.tsx               Crafting workbench
    foundry/                  Foundry sub-pages
    game/                     In-game UI (HUD, character, spellbook, inventory)
    world/                    3D world (R3F scene, physics, controller, VFX)
  components/                 Shared UI (kit system, layout, equipment loadout)
  lib/                        Utilities (stats, icons, emblems, equipment slots)
  state/                      Zustand stores (auth, panel, world)
  styles/                     CSS (kit.css, mainpanel.css)
```
