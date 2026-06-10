-- Grudge Character Creator — D1 Schema
-- Database: grudge-models
-- Stores model manifest, equipment mesh registry, and animation pack metadata.
-- Equipment resolution: character equipment state → mesh names → R2 URLs

-- ── Race/faction character models ──────────────────────────
CREATE TABLE IF NOT EXISTS models (
  id            TEXT PRIMARY KEY,
  faction_id    TEXT NOT NULL,
  race_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL DEFAULT '',
  faction_name  TEXT NOT NULL,
  faction_color TEXT NOT NULL DEFAULT '#888888',
  r2_url        TEXT NOT NULL,
  skeleton_type TEXT NOT NULL DEFAULT 'bip001',
  format        TEXT NOT NULL DEFAULT 'glb',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_models_faction_race
  ON models(faction_id, race_id);

-- ── Equipment slots (every toggleable mesh per model) ──────
CREATE TABLE IF NOT EXISTS equipment_slots (
  id              TEXT PRIMARY KEY,
  model_id        TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  slot            TEXT NOT NULL,
  variant         TEXT NOT NULL DEFAULT '_default',
  mesh_name       TEXT NOT NULL,
  slot_group      TEXT NOT NULL CHECK(slot_group IN ('armor','weapon_r','weapon_l','shield','utility')),
  bone_container  TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_equip_model ON equipment_slots(model_id);
CREATE INDEX IF NOT EXISTS idx_equip_slot  ON equipment_slots(model_id, slot);

-- ── Weapon animation packs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS animation_packs (
  id          TEXT PRIMARY KEY,
  pack_key    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  r2_base_url TEXT NOT NULL,
  files       TEXT NOT NULL DEFAULT '[]',
  extra       TEXT DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Custom bone weapon attachments (user-defined) ──────────
CREATE TABLE IF NOT EXISTS weapon_bone_attachments (
  id            TEXT PRIMARY KEY,
  model_id      TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  bone_name     TEXT NOT NULL,
  weapon_url    TEXT NOT NULL,
  weapon_name   TEXT NOT NULL DEFAULT '',
  slot_label    TEXT NOT NULL DEFAULT 'custom',
  pos_x         REAL NOT NULL DEFAULT 0,
  pos_y         REAL NOT NULL DEFAULT 0,
  pos_z         REAL NOT NULL DEFAULT 0,
  rot_x         REAL NOT NULL DEFAULT 0,
  rot_y         REAL NOT NULL DEFAULT 0,
  rot_z         REAL NOT NULL DEFAULT 0,
  scale         REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bone_attach_model ON weapon_bone_attachments(model_id);

-- ── Weapon model packs (standalone weapon FBX/GLB) ─────────
CREATE TABLE IF NOT EXISTS weapon_model_packs (
  id          TEXT PRIMARY KEY,
  pack_key    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  r2_base_url TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  prefix      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
