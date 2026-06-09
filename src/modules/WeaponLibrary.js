/**
 * WeaponLibrary — Canonical weapon-type → bone attachment presets.
 *
 * Each entry defines:
 *   bone:      BoneAttachment slot (alias or direct bone name)
 *   pack:      WEAPON_MODEL_PACKS key for the model source
 *   animPack:  WEAPON_ANIMATION_PACKS key for animations
 *   pos:       local position offset { x, y, z }
 *   rot:       local rotation offset in degrees { x, y, z }
 *   scale:     uniform scale factor
 *   hand:      '1h' | '2h' | 'oh' | 'dual'
 *   dualOff:   (dual wield only) offhand bone + offset override
 *
 * Offsets are tuned for the Toon_RTS bip001 skeleton (WK_, BRB_, etc).
 * Adjust scale for different model packs — FBX weapon packs are typically
 * 100x too large (exported in cm), so 0.01 is the baseline.
 */

export const WEAPON_PRESETS = {
  // ── 1H Melee — Right Hand ─────────────────────────────────
  sword: {
    label: '1H Sword',
    icon: '⚔️',
    bone: 'rightHand',
    pack: 'swords',
    animPack: 'pro_sword_shield',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '1h',
    sample: '_sword_01.fbx',
  },
  axe: {
    label: '1H Axe',
    icon: '🪓',
    bone: 'rightHand',
    pack: 'axes_1h',
    animPack: 'pro_melee_axe',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '1h',
    sample: '_axe_01.fbx',
  },
  hammer: {
    label: '1H Hammer',
    icon: '🔨',
    bone: 'rightHand',
    pack: 'hammers_2h',
    animPack: '2h_melee',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '1h',
    sample: '_hammer_01.fbx',
  },
  mace: {
    label: 'Mace',
    icon: '🔨',
    bone: 'rightHand',
    pack: 'hammers_2h',
    animPack: '2h_melee',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '1h',
    sample: '_hammer_02.fbx',
  },
  dagger: {
    label: 'Dagger',
    icon: '🗡️',
    bone: 'rightHand',
    pack: 'daggers',
    animPack: '1h_sword_shield',
    pos: { x: 0, y: 0.02, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.008,
    hand: '1h',
    sample: '_dagger_01.fbx',
  },
  wand: {
    label: 'Wand',
    icon: '✨',
    bone: 'rightHand',
    pack: 'magic_staffs',
    animPack: 'magic',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.008,
    hand: '1h',
    sample: '_staff_01.fbx',
  },

  // ── 2H Melee — Right Hand ─────────────────────────────────
  '2h_sword': {
    label: '2H Great Sword',
    icon: '🗡️',
    bone: 'rightHand',
    pack: 'swords_extra',
    animPack: 'great_sword',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.012,
    hand: '2h',
    sample: '_sword_01.fbx',
  },
  '2h_axe': {
    label: '2H Axe',
    icon: '⚒️',
    bone: 'rightHand',
    pack: 'axes_2h',
    animPack: 'pro_melee_axe',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.012,
    hand: '2h',
    sample: '_axe_01.fbx',
  },
  '2h_hammer': {
    label: '2H Hammer',
    icon: '🔨',
    bone: 'rightHand',
    pack: 'hammers_2h',
    animPack: '2h_melee',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.012,
    hand: '2h',
    sample: '_hammer_01.fbx',
  },
  spear: {
    label: 'Spear',
    icon: '🔱',
    bone: 'rightHand',
    pack: 'medieval',
    animPack: '2h_melee',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: -90, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: 'spear.fbx',
  },

  // ── Ranged — bone varies by type ──────────────────────────
  bow: {
    label: 'Bow',
    icon: '🏹',
    bone: 'leftHand',
    pack: 'bows',
    animPack: 'pro_longbow',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: '_bow_01.fbx',
  },
  crossbow: {
    label: 'Crossbow',
    icon: '🏹',
    bone: 'rightHand',
    pack: 'crossbows',
    animPack: 'rifle_crossbow',
    pos: { x: 0, y: 0.05, z: 0.02 },
    rot: { x: -90, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: '_crossbow_01.fbx',
  },
  gun: {
    label: 'Gun / Pistol',
    icon: '🔫',
    bone: 'rightHand',
    pack: 'fantasy',
    animPack: 'advanced_gun',
    pos: { x: 0, y: 0.02, z: 0.05 },
    rot: { x: -90, y: 0, z: 0 },
    scale: 0.008,
    hand: '1h',
    sample: 'pistol_01.fbx',
  },
  rifle: {
    label: 'Rifle',
    icon: '🔫',
    bone: 'rightHand',
    pack: 'fantasy',
    animPack: 'rifle_crossbow',
    pos: { x: 0, y: 0.03, z: 0.08 },
    rot: { x: -90, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: 'rifle_01.fbx',
  },

  // ── Magic — Staff/Tome ────────────────────────────────────
  staff: {
    label: 'Staff',
    icon: '🪄',
    bone: 'rightHand',
    pack: 'staffs',
    animPack: 'pro_magic',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: '_cane_01.fbx',
  },
  magic_staff: {
    label: 'Magic Staff',
    icon: '🪄',
    bone: 'rightHand',
    pack: 'magic_staffs',
    animPack: 'pro_magic',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: '2h',
    sample: '_staff_01.fbx',
  },
  tome: {
    label: 'Tome',
    icon: '📖',
    bone: 'leftHand',
    pack: null,
    animPack: 'pro_magic',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 90, z: 0 },
    scale: 0.008,
    hand: 'oh',
    sample: null,
  },
  offhand_relic: {
    label: 'Off-Hand Relic',
    icon: '💎',
    bone: 'leftHand',
    pack: null,
    animPack: 'pro_magic',
    pos: { x: 0, y: 0.02, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.006,
    hand: 'oh',
    sample: null,
  },

  // ── Shield — Left shield container ────────────────────────
  shield: {
    label: 'Shield',
    icon: '🛡️',
    bone: 'L_shield_container',
    pack: 'shields',
    animPack: 'pro_sword_shield',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: 'oh',
    sample: '_Shield_01.fbx',
  },

  // ── Dual Wield Combos ─────────────────────────────────────
  dual_swords: {
    label: 'Dual Swords',
    icon: '⚔️⚔️',
    bone: 'rightHand',
    pack: 'swords',
    animPack: '1h_sword_shield',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: 'dual',
    sample: '_sword_01.fbx',
    dualOff: {
      bone: 'leftHand',
      pack: 'swords',
      sample: '_sword_02.fbx',
      pos: { x: 0, y: 0, z: 0 },
      rot: { x: 0, y: 180, z: 0 },
      scale: 0.01,
    },
  },
  dual_daggers: {
    label: 'Dual Daggers',
    icon: '🗡️🗡️',
    bone: 'rightHand',
    pack: 'daggers',
    animPack: '1h_sword_shield',
    pos: { x: 0, y: 0.02, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.008,
    hand: 'dual',
    sample: '_dagger_01.fbx',
    dualOff: {
      bone: 'leftHand',
      pack: 'daggers',
      sample: '_dagger_02.fbx',
      pos: { x: 0, y: 0.02, z: 0 },
      rot: { x: 0, y: 180, z: 0 },
      scale: 0.008,
    },
  },
  dual_axes: {
    label: 'Dual Axes',
    icon: '🪓🪓',
    bone: 'rightHand',
    pack: 'axes_1h',
    animPack: 'pro_melee_axe',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: 'dual',
    sample: '_axe_01.fbx',
    dualOff: {
      bone: 'leftHand',
      pack: 'axes_1h',
      sample: '_axe_02.fbx',
      pos: { x: 0, y: 0, z: 0 },
      rot: { x: 0, y: 180, z: 0 },
      scale: 0.01,
    },
  },
  sword_dagger: {
    label: 'Sword + Dagger',
    icon: '⚔️🗡️',
    bone: 'rightHand',
    pack: 'swords',
    animPack: 'pro_sword_shield',
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: 0.01,
    hand: 'dual',
    sample: '_sword_01.fbx',
    dualOff: {
      bone: 'leftHand',
      pack: 'daggers',
      sample: '_dagger_01.fbx',
      pos: { x: 0, y: 0.02, z: 0 },
      rot: { x: 0, y: 180, z: 0 },
      scale: 0.008,
    },
  },
};

/**
 * Get a flat list of all weapon presets (for UI iteration).
 * @returns {{ key: string, preset: object }[]}
 */
export function getAllPresets() {
  return Object.entries(WEAPON_PRESETS).map(([key, preset]) => ({ key, ...preset }));
}

/**
 * Get presets filtered by hand type.
 * @param {'1h'|'2h'|'oh'|'dual'} hand
 */
export function getPresetsByHand(hand) {
  return getAllPresets().filter(p => p.hand === hand);
}

/**
 * Build the full weapon URL from a pack key and sample filename.
 * Uses the WEAPON_MODEL_PACKS path.
 * @param {string} packKey
 * @param {string} sampleFile
 * @param {object} packs - WEAPON_MODEL_PACKS registry
 * @returns {string|null}
 */
export function buildWeaponUrl(packKey, sampleFile, packs) {
  const pack = packs[packKey];
  if (!pack || !sampleFile) return null;
  return pack.path + sampleFile;
}
