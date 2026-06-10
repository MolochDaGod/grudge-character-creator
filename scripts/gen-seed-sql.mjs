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

// ── Weapon Model Packs ──────────────────────────────────────
const WEP_PACKS = {
  swords:       { name: 'Swords (24)',              path: 'animationsweapons/3dswords/fbx/',            count: 24, prefix: '_sword_' },
  axes:         { name: 'Axes 2H (24)',             path: 'animationsweapons/2hweapons/fbx/',           count: 24, prefix: '_axe_' },
  staffs:       { name: 'Staffs (24)',              path: 'animationsweapons/staffs/fbx/',              count: 24, prefix: '_cane_' },
  shields:      { name: 'Shields (20)',             path: 'animationsweapons/shields/fbx/',             count: 20, prefix: '_Shield_' },
  bows:         { name: 'Bows (24)',                path: 'animationsweapons/bows/fbx/bow_full/',       count: 24, prefix: '_bow_' },
  axes_1h:      { name: 'Axes 1H (24)',             path: 'animationsweapons/axes_1h/fbx/',             count: 24, prefix: '_axe_' },
  axes_2h:      { name: 'Axes 2H Extra (24)',       path: 'animationsweapons/axes_2h/fbx/',             count: 24, prefix: '_axe_' },
  daggers:      { name: 'Daggers (24)',             path: 'animationsweapons/daggers/fbx/',             count: 24, prefix: '_dagger_' },
  hammers_2h:   { name: 'Hammers 2H (24)',          path: 'animationsweapons/hammers_2h/fbx/',          count: 24, prefix: '_hammer_' },
  magic_staffs: { name: 'Magic Staffs (24)',        path: 'animationsweapons/magic_staffs/fbx/',        count: 24, prefix: '_staff_' },
  crossbows:    { name: 'Crossbows (24)',           path: 'animationsweapons/crossbows/fbx/fbx_full/',  count: 24, prefix: '_crossbow_' },
  swords_extra: { name: 'Swords Extra (24)',        path: 'animationsweapons/swords_extra/fbx/',        count: 24, prefix: '_sword_' },
  staffs_extra: { name: 'Staffs Extra (24)',        path: 'animationsweapons/staffs_extra/fbx/',        count: 24, prefix: '_cane_' },
  fantasy:      { name: 'Fantasy Weapons (58)',     path: 'animationsweapons/fantasy_weapons/',         count: 58, prefix: '' },
  medieval:     { name: 'Medieval Collection (19)', path: 'animationsweapons/medieval_collection/FBX/', count: 19, prefix: '' },
};

for (const [k, p] of Object.entries(WEP_PACKS)) {
  sql.push(`INSERT OR REPLACE INTO weapon_model_packs(id,pack_key,name,r2_base_url,count,prefix) VALUES('${uid()}','${k}','${q(p.name)}','${R2}/${p.path}',${p.count},'${p.prefix}');`);
}

// ── Weapon Bone Attachment Presets (per weapon type → correct bone) ──
const PRESETS = [
  // 1H Melee — R hand
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/3dswords/fbx/_sword_01.fbx',            wname: '1H Sword #1',      slot: 'sword',       px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/axes_1h/fbx/_axe_01.fbx',              wname: '1H Axe #1',        slot: 'axe',         px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/hammers_2h/fbx/_hammer_01.fbx',        wname: 'Hammer #1',        slot: 'hammer',      px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/daggers/fbx/_dagger_01.fbx',           wname: 'Dagger #1',        slot: 'dagger',      px:0, py:0.02, pz:0, rx:0, ry:0, rz:0, s:0.008 },
  // 2H Melee — R hand
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/swords_extra/fbx/_sword_01.fbx',       wname: 'Great Sword #1',   slot: '2h_sword',    px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.012 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/axes_2h/fbx/_axe_01.fbx',             wname: '2H Axe #1',        slot: '2h_axe',      px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.012 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/hammers_2h/fbx/_hammer_01.fbx',        wname: '2H Hammer #1',     slot: '2h_hammer',   px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.012 },
  // Ranged
  { mid: 'crusade_human', bone: 'L_hand_container', url: 'animationsweapons/bows/fbx/bow_full/_bow_01.fbx',        wname: 'Longbow #1',       slot: 'bow',         px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/crossbows/fbx/fbx_full/_crossbow_01.fbx', wname: 'Crossbow #1',   slot: 'crossbow',    px:0, py:0.05, pz:0.02, rx:-90, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/fantasy_weapons/pistol_01.fbx',        wname: 'Pistol #1',        slot: 'gun',         px:0, py:0.02, pz:0.05, rx:-90, ry:0, rz:0, s:0.008 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/fantasy_weapons/rifle_01.fbx',         wname: 'Rifle #1',         slot: 'rifle',       px:0, py:0.03, pz:0.08, rx:-90, ry:0, rz:0, s:0.01 },
  // Magic
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/staffs/fbx/_cane_01.fbx',              wname: 'Staff #1',         slot: 'staff',       px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/magic_staffs/fbx/_staff_01.fbx',       wname: 'Magic Staff #1',   slot: 'magic_staff', px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/magic_staffs/fbx/_staff_02.fbx',       wname: 'Wand #1',          slot: 'wand',        px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.008 },
  // Shield
  { mid: 'crusade_human', bone: 'L_shield_container', url: 'animationsweapons/shields/fbx/_Shield_01.fbx',         wname: 'Shield #1',        slot: 'shield',      px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  // Dual wield — main hand
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/3dswords/fbx/_sword_01.fbx',           wname: 'Dual Sword R',     slot: 'dual_sword_r',px:0, py:0, pz:0, rx:0, ry:0, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'L_hand_container', url: 'animationsweapons/3dswords/fbx/_sword_02.fbx',           wname: 'Dual Sword L',     slot: 'dual_sword_l',px:0, py:0, pz:0, rx:0, ry:180, rz:0, s:0.01 },
  { mid: 'crusade_human', bone: 'R_hand_container', url: 'animationsweapons/daggers/fbx/_dagger_01.fbx',           wname: 'Dual Dagger R',    slot: 'dual_dagger_r',px:0, py:0.02, pz:0, rx:0, ry:0, rz:0, s:0.008 },
  { mid: 'crusade_human', bone: 'L_hand_container', url: 'animationsweapons/daggers/fbx/_dagger_02.fbx',           wname: 'Dual Dagger L',    slot: 'dual_dagger_l',px:0, py:0.02, pz:0, rx:0, ry:180, rz:0, s:0.008 },
];

for (const p of PRESETS) {
  sql.push(`INSERT OR REPLACE INTO weapon_bone_attachments(id,model_id,bone_name,weapon_url,weapon_name,slot_label,pos_x,pos_y,pos_z,rot_x,rot_y,rot_z,scale) VALUES('${uid()}','${p.mid}','${p.bone}','${R2}/${p.url}','${q(p.wname)}','${p.slot}',${p.px},${p.py},${p.pz},${p.rx},${p.ry},${p.rz},${p.s});`);
}

fs.writeFileSync('d1/seed.sql', sql.join('\n'));
console.log(`Generated ${sql.length} statements to d1/seed.sql`);
