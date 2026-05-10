import crypto from 'crypto';
import fs from 'fs';

const uid = () => crypto.randomUUID();
const R2 = 'https://assets.grudge-studio.com';

const FACTIONS = {
  crusade: { name: 'Crusade', color: '#c9a04e', races: {
    human:     { name: 'Human (WK)',     prefix: 'WK_',  glb: 'human.glb' },
    barbarian: { name: 'Barbarian (BRB)', prefix: 'BRB_', glb: 'barbarian.glb' },
  }},
  fabled: { name: 'Fabled', color: '#7ec8e3', races: {
    elf:   { name: 'Elf (ELF)',   prefix: 'ELF_', glb: 'elf.glb' },
    dwarf: { name: 'Dwarf (DWF)', prefix: 'DWF_', glb: 'dwarf.glb' },
  }},
  legion: { name: 'Legion', color: '#8b2020', races: {
    orc:    { name: 'Orc (ORC)',    prefix: 'ORC_', glb: 'orc.glb' },
    undead: { name: 'Undead (UD)',  prefix: 'UD_',  glb: 'undead.glb' },
  }},
};

const EQ = [
  { s: 'body',      g: 'armor',    vs: ['A','B','C','D','E'],                     t: 'Units_Body_{V}' },
  { s: 'arms',      g: 'armor',    vs: ['A','B','C','D'],                         t: 'Units_Arms_{V}' },
  { s: 'legs',      g: 'armor',    vs: ['A','B','C'],                             t: 'Units_Legs_{V}' },
  { s: 'head',      g: 'armor',    vs: ['A','B','C','D','E','F','G','H','I'],     t: 'Units_head_{V}' },
  { s: 'shoulders', g: 'armor',    vs: ['A','B'],                                 t: 'Units_shoulderpads_{V}' },
  { s: 'sword',     g: 'weapon_r', vs: ['A','B'], t: 'Units_sword_{V}',  b: 'R_hand_container' },
  { s: 'axe',       g: 'weapon_r', vs: ['A','B'], t: 'Units_axe_{V}',    b: 'R_hand_container' },
  { s: 'hammer',    g: 'weapon_r', vs: ['A','B'], t: 'Units_hammer_{V}', b: 'R_hand_container' },
  { s: 'pick',      g: 'weapon_r', vs: ['_default'], t: 'Units_pick',    b: 'R_hand_container' },
  { s: 'spear',     g: 'weapon_r', vs: ['_default'], t: 'Units_spear',   b: 'R_hand_container' },
  { s: 'bow',       g: 'weapon_l', vs: ['_default'], t: 'Units_Bow',     b: 'L_hand_container' },
  { s: 'staff',     g: 'weapon_l', vs: ['A','B','C'], t: 'Units_staff_{V}', b: 'L_hand_container' },
  { s: 'shield',    g: 'shield',   vs: ['A','B','C','D'], t: 'Units_shield_{V}', b: 'L_shield_container' },
  { s: 'bag',       g: 'utility',  vs: ['_default'], t: 'Xtra_bag',    b: 'Bone_bag' },
  { s: 'wood',      g: 'utility',  vs: ['_default'], t: 'Xtra_wood',   b: 'Bone_wood' },
  { s: 'quiver',    g: 'utility',  vs: ['_default'], t: 'Xtra_quiver', b: 'Quiver_container' },
];

const ANIM_PACKS = {
  '1h_sword_shield':  '1H Sword and Shield',
  '2h_melee':         '2H Melee',
  'longbow':          'Longbow',
  'magic':            'Magic Staff',
  'rifle_crossbow':   'Rifle Crossbow',
  'advanced_gun':     'Advanced Gun 8-Dir',
  'pro_sword_shield': 'Pro Sword and Shield',
  'pro_longbow':      'Pro Longbow',
  'pro_magic':        'Pro Magic',
  'pro_melee_axe':    'Pro Melee Axe',
  'great_sword':      'Great Sword',
  'magic_locomotion': 'Magic Locomotion',
  'male_injured':     'Male Injured',
  'male_locomotion':  'Male Locomotion',
};

const q = (s) => s.replace(/'/g, "''");
const sql = [];

for (const [fid, f] of Object.entries(FACTIONS)) {
  for (const [rid, r] of Object.entries(f.races)) {
    const mid = `${fid}_${rid}`;
    const url = `${R2}/models/characters/${r.glb}`;
    sql.push(`INSERT OR REPLACE INTO models(id,faction_id,race_id,name,prefix,faction_name,faction_color,r2_url,skeleton_type,format) VALUES('${mid}','${fid}','${rid}','${q(r.name)}','${r.prefix}','${q(f.name)}','${f.color}','${url}','bip001','glb');`);

    let si = 0;
    for (const eq of EQ) {
      for (const v of eq.vs) {
        const mn = v === '_default'
          ? `${r.prefix}${eq.t}`
          : `${r.prefix}${eq.t.replace('{V}', v)}`;
        const bone = eq.b ? `'${eq.b}'` : 'NULL';
        sql.push(`INSERT OR REPLACE INTO equipment_slots(id,model_id,slot,variant,mesh_name,slot_group,bone_container,sort_order) VALUES('${uid()}','${mid}','${eq.s}','${v}','${mn}','${eq.g}',${bone},${si++});`);
      }
    }
  }
}

for (const [k, n] of Object.entries(ANIM_PACKS)) {
  sql.push(`INSERT OR REPLACE INTO animation_packs(id,pack_key,name,r2_base_url,files) VALUES('${uid()}','${k}','${q(n)}','${R2}/animations/${k}/','[]');`);
}

fs.writeFileSync('d1/seed.sql', sql.join('\n'));
console.log(`Generated ${sql.length} statements to d1/seed.sql`);
