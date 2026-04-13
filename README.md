# Grudge Character Creator

Modular 3D race character editor with persistent user accounts. Built for [Grudge Studio](https://grudge-studio.com) by Racalvin The Pirate King.

## Features

- **6 Faction Races** — Human, Barbarian, Elf, Dwarf, Orc, Undead with full equipment toggle
- **Equipment System** — Armor (body/arms/legs/head/shoulders), weapons (sword/axe/hammer/spear/bow/staff), shields, utility
- **8-Attribute Stats** — STR/DEX/INT/VIT/WIS/LCK/CHA/END with diminishing returns and 37 derived stats
- **Animation Packs** — 1H Sword+Shield, 2H Melee, Longbow, Magic, Rifle/Crossbow, Advanced Gun 8-dir
- **Combat Simulation** — 8-step combat pipeline with crit, block, dodge, reflect, absorb
- **Persistent Saves** — Guest auth with JWT, character builds saved to Vercel KV

## Quick Start

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`. FBX assets are served from the parent directory via Vite's `fs.allow`.

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables (see `.env.example`):
   - `VITE_ASSET_BASE_URL` — URL where FBX models are hosted (e.g. object storage)
   - `JWT_SECRET` — Secret for JWT signing
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Vercel KV credentials
4. Deploy

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/guest` | Create guest account, get JWT |
| GET | `/api/characters` | List user's characters |
| POST | `/api/characters` | Save new character build |
| PUT | `/api/characters` | Update character build |
| DELETE | `/api/characters` | Delete character |

## Tech Stack

- **Frontend**: Vanilla JS + Three.js (CDN), Vite
- **Backend**: Vercel Serverless Functions (Node.js)
- **Storage**: Vercel KV (Redis) — in-memory fallback for dev
- **Auth**: JWT guest tokens, future Grudge ID / Puter linkage
