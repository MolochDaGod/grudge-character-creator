#!/usr/bin/env node
/**
 * seed-d1.mjs — Populate the Cloudflare D1 grudge-models database
 * from the existing FactionRegistry.js data.
 *
 * Usage:
 *   # Local D1 (dev):
 *   npx wrangler d1 execute grudge-models --local --file=d1/schema.sql
 *   node scripts/seed-d1.mjs --local
 *
 *   # Remote D1 (production):
 *   npx wrangler d1 execute grudge-models --file=d1/schema.sql
 *   node scripts/seed-d1.mjs
 *
 * Requires: wrangler CLI configured with Cloudflare account.
 */

import { execSync } from 'child_process';
import crypto from 'crypto';

const R2_BASE = process.env.R2_BASE_URL || 'https://assets.grudge-studio.com';
const isLocal = process.argv.includes('--local');
const flag = isLocal ? '--local' : '';

// ── Model data (mirrored from FactionRegistry.js) ──────────
const FACTIONS = {
  crusade: {
    name: 'Crusade', color: '#c9a04e',
    races: {
      human:     { name: 'Human (WK)',       prefix: 'WK_',  glb: 'human.glb' },
      barbarian: { name: 'Barbarian (BRB)',   prefix: 'BRB_', glb: 'barbarian.glb' },
    },
  },
  fabled: {
    name: 'Fabled', color: '#7ec8e3',
    races: {
      elf:   { name: 'Elf (ELF)',     prefix: 'ELF_',  glb: 'elf.glb' },
      dwarf: { name: 'Dwarf (DWF)',   prefix: 'DWF_',  glb: 'dwarf.glb' },
    },
  },
  legion: {
    name: 'Legion', color: '#8b2020',
    races: {
      orc:    { name: 'Orc (ORC)',     prefix: 'ORC_',  glb: 'orc.glb' },
      undead: { name: 'Undead (UD)',    prefix: 'UD_',   glb: 'undead.glb' },
    },
  },
};

// Equipment meshes per race (common structure — all 6 share these slots)
const EQUIPMENT_TEMPLATE = [
  // Armor
  { slot: 'body',      group: 'armor',    variants: ['A','B','C','D','E'], tpl: 'Units_Body_{V}' },
  { slot: 'arms',      group: 'armor',    variants: ['A','B','C','D'],     tpl: 'Units_Arms_{V}' },
  { slot: 'legs',      group: 'armor',    variants: ['A','B','C'],         tpl: 'Units_Legs_{V}' },
  { slot: 'head',      group: 'armor',    variants: ['A','B','C','D','E','F','G','H','I'], tpl: 'Units_head_{V}' },
  { slot: 'shoulders', group: 'armor',    variants: ['A','B'],             tpl: 'Units_shoulderpads_{V}' },
  // Weapons — right hand
  { slot: 'sword',     group: 'weapon_r', variants: ['A','B'],             tpl: 'Units_sword_{V}',  bone: 'R_hand_container' },
  { slot: 'axe',       group: 'weapon_r', variants: ['A','B'],             tpl: 'Units_axe_{V}',    bone: 'R_hand_container' },
  { slot: 'hammer',    group: 'weapon_r', variants: ['A','B'],             tpl: 'Units_hammer_{V}', bone: 'R_hand_container' },
  { slot: 'pick',      group: 'weapon_r', variants: ['_default'],          tpl: 'Units_pick',       bone: 'R_hand_container' },
  { slot: 'spear',     group: 'weapon_r', variants: ['_default'],          tpl: 'Units_spear',      bone: 'R_hand_container' },
  // Weapons — left hand
  { slot: 'bow',       group: 'weapon_l', variants: ['_default'],          tpl: 'Units_Bow',        bone: 'L_hand_container' },
  { slot: 'staff',     group: 'weapon_l', variants: ['A','B','C'],         tpl: 'Units_staff_{V}',  bone: 'L_hand_container' },
  // Shields
  { slot: 'shield',    group: 'shield',   variants: ['A','B','C','D'],     tpl: 'Units_shield_{V}', bone: 'L_shield_container' },
  // Utility
  { slot: 'bag',       group: 'utility',  variants: ['_default'],          tpl: 'Xtra_bag',         bone: 'Bone_bag' },
  { slot: 'wood',      group: 'utility',  variants: ['_default'],          tpl: 'Xtra_wood',        bone: 'Bone_wood' },
  { slot: 'quiver',    group: 'utility',  variants: ['_default'],          tpl: 'Xtra_quiver',      bone: 'Quiver_container' },
];

// Animation packs
const ANIMATION_PACKS = {
  '1h_sword_shield':  { name: '1H Sword & Shield',      files: 18 },
  '2h_melee':         { name: '2H Melee (Axe/Hammer)',   files: 23 },
  'longbow':          { name: 'Longbow',                 files: 22 },
  'magic':            { name: 'Magic Staff',             files: 14 },
  'rifle_crossbow':   { name: 'Rifle / Crossbow',        files: 15 },
  'advanced_gun':     { name: 'Advanced Gun (8-Dir)',     files: 18 },
  'pro_sword_shield': { name: 'Pro Sword & Shield (51)', files: 42 },
  'pro_longbow':      { name: 'Pro Longbow (39)',        files: 33 },
  'pro_magic':        { name: 'Pro Magic (56)',          files: 20 },
  'pro_melee_axe':    { name: 'Pro Melee Axe (47)',      files: 20 },
  'great_sword':      { name: 'Great Sword (52)',        files: 50 },
  'magic_locomotion': { name: 'Magic Locomotion (16)',   files: 16 },
  'male_injured':     { name: 'Male Injured (20)',       files: 20 },
  'male_locomotion':  { name: 'Male Locomotion (11)',    files: 11 },
};

function uid() { return crypto.randomUUID(); }

function sql(query) {
  // Escape single quotes for shell
  const escaped = query.replace(/'/g, "''");
  const cmd = `npx wrangler d1 execute grudge-models ${flag} --command="${query}"`;
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
  } catch (err) {
    console.error(`SQL failed: ${query.slice(0, 80)}...`);
    console.error(err.stderr?.slice(0, 200));
  }
}

function batchSql(statements) {
  // Write to temp file and execute as batch
  const fs = await import('fs');
  const tmpFile = 'd1/_seed_batch.sql';
  fs.writeFileSync(tmpFile, statements.join('\n'));
  const cmd = `npx wrangler d1 execute grudge-models ${flag} --file=${tmpFile}`;
  try {
    execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });
  } catch (err) {
    console.error('Batch SQL failed');
  }
  fs.unlinkSync(tmpFile);
}

// ── Main ────────────────────────────────────────────────────
console.log(`\n⚔️  Seeding D1 grudge-models (${isLocal ? 'LOCAL' : 'REMOTE'})...\n`);

const statements = [];

// Insert models + equipment slots
for (const [factionId, faction] of Object.entries(FACTIONS)) {
  for (const [raceId, race] of Object.entries(faction.races)) {
    const modelId = `${factionId}_${raceId}`;
    const r2Url = `${R2_BASE}/models/characters/${race.glb}`;

    statements.push(
      `INSERT OR REPLACE INTO models (id, faction_id, race_id, name, prefix, faction_name, faction_color, r2_url, skeleton_type, format)`
      + ` VALUES ('${modelId}', '${factionId}', '${raceId}', '${race.name}', '${race.prefix}', '${faction.name}', '${faction.color}', '${r2Url}', 'bip001', 'glb');`
    );

    // Equipment slots for this race
    let sortIdx = 0;
    for (const eq of EQUIPMENT_TEMPLATE) {
      for (const v of eq.variants) {
        const meshName = v === '_default'
          ? `${race.prefix}${eq.tpl}`
          : `${race.prefix}${eq.tpl.replace('{V}', v)}`;
        const slotId = uid();
        const bone = eq.bone ? `'${eq.bone}'` : 'NULL';

        statements.push(
          `INSERT OR REPLACE INTO equipment_slots (id, model_id, slot, variant, mesh_name, slot_group, bone_container, sort_order)`
          + ` VALUES ('${slotId}', '${modelId}', '${eq.slot}', '${v}', '${meshName}', '${eq.group}', ${bone}, ${sortIdx});`
        );
        sortIdx++;
      }
    }
  }
}

// Insert animation packs
for (const [key, pack] of Object.entries(ANIMATION_PACKS)) {
  const packId = uid();
  const r2Base = `${R2_BASE}/animations/${key}/`;
  statements.push(
    `INSERT OR REPLACE INTO animation_packs (id, pack_key, name, r2_base_url, files)`
    + ` VALUES ('${packId}', '${key}', '${pack.name}', '${r2Base}', '[]');`
  );
}

// Write and execute
import fs from 'fs';
const tmpFile = 'd1/_seed_batch.sql';
fs.mkdirSync('d1', { recursive: true });
fs.writeFileSync(tmpFile, statements.join('\n'));

console.log(`  Generated ${statements.length} SQL statements`);
console.log(`  Executing via wrangler...\n`);

try {
  execSync(`npx wrangler d1 execute grudge-models ${flag} --file=${tmpFile}`, {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  console.log('\n✅ D1 seeded successfully');
} catch (err) {
  console.error('\n❌ Seed failed — make sure wrangler is configured');
  console.error('   Run: npx wrangler d1 create grudge-models');
  console.error('   Then: npx wrangler d1 execute grudge-models --file=d1/schema.sql');
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
