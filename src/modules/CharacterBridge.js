/**
 * CharacterBridge — vanilla JS mirror of @shared/fleet/character.ts
 * Joins creator equipped slots → model3d JSON for Postgres + in-game loaders.
 */

const RACE_GRUDGE6 = {
  human:     { modelId: 'human',     prefix: 'WK_',  label: 'Human',     scale: 1.0,  faction: 'crusade' },
  barbarian: { modelId: 'barbarian', prefix: 'BRB_', label: 'Barbarian', scale: 1.1,  faction: 'crusade' },
  elf:       { modelId: 'elf',       prefix: 'ELF_', label: 'Elf',       scale: 1.0,  faction: 'fabled' },
  dwarf:     { modelId: 'dwarf',     prefix: 'DWF_', label: 'Dwarf',     scale: 0.85, faction: 'crusade' },
  orc:       { modelId: 'orc',       prefix: 'ORC_', label: 'Orc',       scale: 1.15, faction: 'legion' },
  undead:    { modelId: 'undead',    prefix: 'UD_',  label: 'Undead',    scale: 1.0,  faction: 'legion' },
};

const WEAPON_SLOTS = new Set(['axe', 'hammer', 'sword', 'pick', 'spear', 'bow', 'staff', 'shield']);

export function splitEquippedSlots(equipped = {}) {
  const equippedMeshes = {};
  const weaponSlots = {};
  for (const [slot, raw] of Object.entries(equipped)) {
    const variant = raw === true ? 'A' : String(raw);
    if (WEAPON_SLOTS.has(slot)) weaponSlots[slot] = variant;
    else equippedMeshes[slot] = variant;
  }
  return { equippedMeshes, weaponSlots };
}

export function model3dFromEquipped(raceId, equipped = {}, opts = {}) {
  const race = RACE_GRUDGE6[raceId] || RACE_GRUDGE6.human;
  const { equippedMeshes, weaponSlots } = splitEquippedSlots(equipped);
  return {
    baseModelId: `${race.prefix}Characters_customizable`,
    equippedMeshes,
    weaponSlots,
    faceVariant: opts.faceVariant || 'A',
    skinColor: opts.skinColor || '#ffffff',
    armorColor: opts.armorColor || '#ffffff',
    capeEnabled: !!opts.capeEnabled,
    scale: opts.scale ?? race.scale,
  };
}

/** Restore creator UI from API character row */
export function equippedFromModel3d(char) {
  const m = char.model3d || {};
  const out = { ...(m.equippedMeshes || {}) };
  for (const [slot, variant] of Object.entries(m.weaponSlots || {})) {
    out[slot] = variant;
  }
  return out;
}

export { RACE_GRUDGE6 };