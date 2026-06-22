/**
 * Grudge6Paths — canonical CDN paths for grudge6 race FBX models.
 * Mirrors GrudgeBuilder/shared/fleet/character.ts (RACE_FBX_PATHS).
 */

export const RACE_BY_PREFIX = {
  WK_:  'human',
  BRB_: 'barbarian',
  ELF_: 'elf',
  DWF_: 'dwarf',
  ORC_: 'orc',
  UD_:  'undead',
};

export const RACE_FBX_FILES = {
  human:     'WK_Characters.fbx',
  barbarian: 'BRB_Characters.fbx',
  elf:       'ELF_Characters.fbx',
  dwarf:     'DWF_Characters.fbx',
  orc:       'ORC_Characters.fbx',
  undead:    'UD_Characters.fbx',
};

/** Normalize legacy race ids (orc_classic → orc). */
export function normalizeRaceId(raceId, prefix) {
  if (raceId === 'orc_classic') return 'orc';
  if (raceId && RACE_FBX_FILES[raceId]) return raceId;
  if (prefix && RACE_BY_PREFIX[prefix]) return RACE_BY_PREFIX[prefix];
  return raceId;
}

/** CDN URL for a grudge6 race FBX on R2. */
export function grudge6RaceModelUrl(raceId, assetsBase = 'https://assets.grudge-studio.com') {
  const id = normalizeRaceId(raceId);
  const file = RACE_FBX_FILES[id];
  if (!file) return null;
  const base = assetsBase.replace(/\/$/, '');
  return `${base}/models/grudge6/races/${file}`;
}

/**
 * Prefer grudge6 FBX over D1 GLB / legacy factioncharacters paths.
 * @param {string} raceId
 * @param {string} prefix
 * @param {string} manifestModel
 * @param {string} assetsBase
 */
export function resolveProductionRaceModel(raceId, prefix, manifestModel, assetsBase) {
  const fbx = grudge6RaceModelUrl(normalizeRaceId(raceId, prefix), assetsBase);
  if (fbx) return fbx;
  return manifestModel;
}