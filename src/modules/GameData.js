/**
 * GameData — Grudge Warlords game systems data.
 *
 * Defines: Classes, Professions, Class Skill Trees, Weapon Skill Trees, Weapon Mastery.
 * Used by the tabbed character panel UI.
 */

// ══════════════════════════════════════════════════════════════
// CLASSES
// ══════════════════════════════════════════════════════════════
// ── Worge Form Models (GLTF) ────────────────────────────────
export const WORGE_FORMS = {
  bear: {
    name: 'Bear Form',
    icon: '🐻',
    model: 'factioncharacters/ADDITIONAL_MODELS/worge_forms/werewolf/scene.gltf',
    desc: 'Large and powerful — tank form. High HP, high defense, AoE taunt.',
  },
  warbear: {
    name: 'Warbear Form (Lv20)',
    icon: '🐻',
    model: 'factioncharacters/ADDITIONAL_MODELS/worge_forms/warbear/scene.gltf',
    desc: 'Ultimate bear form — 3x HP, massive size, raid-boss tanking. Level 20 class skill.',
  },
  raptor: {
    name: 'Raptor Form',
    icon: '🦎',
    model: 'factioncharacters/ADDITIONAL_MODELS/worge_forms/raptor/scene.gltf',
    desc: 'Invisible rogue — stealth, backstab, bleed. Fast and deadly.',
  },
  bird: {
    name: 'Large Bird Form',
    icon: '🦅',
    model: null, // TODO: add bird model
    desc: 'Flyable mount — carry allies, aerial combat, dive bomb.',
  },
};

// ── Magic Projectile VFX ────────────────────────────────────
export const MAGIC_VFX = {
  basePath: 'animationsweapons/magicFX/projectiles/assets/BinbunVFX/magic_projectiles/',
  categories: ['basic', 'fire', 'ice', 'lightning', 'dark', 'holy'],
  desc: 'Godot .tres particle materials — convert to Three.js particle systems for spell effects.',
};

export const CLASSES = {
  warrior: {
    name: 'Warrior', icon: '⚔️', color: '#ef4444',
    desc: 'Melee powerhouse. Stamina-fueled charge attacks, AoE strikes, and group invincibility.',
    primaryAttr: 'STR', secondaryAttr: 'END',
    weaponTypes: ['shield', 'sword', '2h_sword', '2h_axe', '2h_hammer'],
    passive: 'Sprint stamina system: fills via parries, dodges, blocks. Perfect actions grant bonus.',
    abilities: ['Double Jump', 'AoE Slam', 'Charge Attack', 'Group Invincibility'],
  },
  mage: {
    name: 'Mage', icon: '🔮', color: '#8b5cf6',
    desc: 'Arcane caster. Teleport blocks, elemental mastery, and devastating spell combos.',
    primaryAttr: 'INT', secondaryAttr: 'WIS',
    weaponTypes: ['staff', 'tome', 'mace', 'offhand_relic', 'wand'],
    passive: 'Creates particle teleport blocks (max 10). Placeable by AI companions, breakable by factions.',
    abilities: ['Teleport Block', 'Elemental Burst', 'Mana Shield', 'Chain Lightning'],
  },
  ranger: {
    name: 'Ranger', icon: '🏹', color: '#f97316',
    desc: 'Precision striker. Parry-counter combos, ranged mastery, and swift dash attacks.',
    primaryAttr: 'DEX', secondaryAttr: 'LCK',
    weaponTypes: ['bow', 'crossbow', 'gun', 'dagger', '2h_sword', 'spear'],
    passive: 'RMB+LMB parry: perfect parry → 0.5s stun → instant dash attack (2s window).',
    abilities: ['Perfect Parry', 'Dash Strike', 'Arrow Burst', 'Evasion Roll'],
  },
  worge: {
    name: 'Worge', icon: '🐺', color: '#d97706',
    desc: 'Shapeshifter. Three forms: Bear (tank), Raptor (stealth), Large Bird (flight).',
    primaryAttr: 'VIT', secondaryAttr: 'END',
    weaponTypes: ['staff', 'spear', 'dagger', 'bow', 'hammer', 'mace', 'offhand_relic'],
    passive: 'Form shifting — Bear: power + tank. Raptor: invisible rogue. Bird: flyable mount.',
    abilities: ['Bear Form', 'Raptor Form', 'Bird Form', 'Primal Roar'],
    forms: WORGE_FORMS,
  },
};

// ── Integration Notes ────────────────────────────────────────
// CLASS_SKILLS below aligns with GrudgeBuilder's skillTreeData.ts format:
//   - Skills have: id, name, level (tier unlock), desc, cost (skill points)
//   - GrudgeBuilder adds: scaling { stat, perLevel, unit }, requires, maxPoints
//   - When syncing to GrudgeBuilder, map: level→tier, cost→maxPoints, add scaling
// PROFESSIONS aligns with GrudgeBuilder's professionSystem.ts:
//   - Uses same icons, same profession names, same XP curve concept
//   - GrudgeBuilder adds: crafting professions (Blacksmithing, etc.), XP table, gathering bonuses
// grudge-arena's GrudgeCharacter.js consumes these via the shared character model
//   - race, weaponClass, health, speed, attackSpeed from CLASSES
//   - animations from WEAPON_ANIMATION_PACKS in FactionRegistry.js

// ════════════════════════════════════════════════════════════
// CLASS SKILL TREES
// ════════════════════════════════════════════════════════════
export const CLASS_SKILLS = {
  warrior: {
    trees: {
      arms: {
        name: 'Arms', icon: '⚔️', desc: 'Offensive melee mastery',
        skills: [
          { id: 'cleave',       name: 'Cleave',         level: 1,  desc: 'Swing weapon in arc hitting up to 3 enemies', cost: 1 },
          { id: 'rend',         name: 'Rend',           level: 3,  desc: 'Deep wound causing bleed for 6s', cost: 1 },
          { id: 'mortal_strike',name: 'Mortal Strike',  level: 6,  desc: 'Devastating blow dealing 250% weapon damage', cost: 2 },
          { id: 'whirlwind',    name: 'Whirlwind',      level: 10, desc: 'Spin attack hitting all nearby enemies', cost: 2 },
          { id: 'execute',      name: 'Execute',        level: 14, desc: 'Finish enemies below 20% HP for massive damage', cost: 3 },
          { id: 'bladestorm',   name: 'Bladestorm',     level: 20, desc: 'Become a whirlwind of blades for 6s. Ultimate.', cost: 5 },
        ],
      },
      protection: {
        name: 'Protection', icon: '🛡️', desc: 'Defensive tanking mastery',
        skills: [
          { id: 'shield_slam',  name: 'Shield Slam',    level: 1,  desc: 'Bash with shield, stunning target 1.5s', cost: 1 },
          { id: 'shield_wall',  name: 'Shield Wall',    level: 4,  desc: 'Block all damage for 3s', cost: 1 },
          { id: 'taunt',        name: 'Taunt',          level: 5,  desc: 'Force target to attack you for 6s', cost: 1 },
          { id: 'revenge',      name: 'Revenge',        level: 8,  desc: 'Counter after successful block, bonus damage', cost: 2 },
          { id: 'last_stand',   name: 'Last Stand',     level: 12, desc: 'Temporarily gain 30% max HP for 10s', cost: 2 },
          { id: 'invincible',   name: 'Invincible Aura',level: 20, desc: 'Grant group invincibility for 4s. Ultimate.', cost: 5 },
        ],
      },
      fury: {
        name: 'Fury', icon: '🔥', desc: 'Berserker rage and stamina',
        skills: [
          { id: 'battle_shout', name: 'Battle Shout',   level: 1,  desc: 'Increase party ATK by 10% for 30s', cost: 1 },
          { id: 'charge',       name: 'Charge',         level: 2,  desc: 'Rush to target, stunning 1s', cost: 1 },
          { id: 'bloodthirst',  name: 'Bloodthirst',    level: 6,  desc: 'Attack that heals for 20% damage dealt', cost: 2 },
          { id: 'rampage',      name: 'Rampage',        level: 10, desc: 'Rapid 5-hit combo while enraged', cost: 2 },
          { id: 'recklessness', name: 'Recklessness',   level: 15, desc: 'Guaranteed crits for 8s, take 20% more damage', cost: 3 },
          { id: 'titan_grip',   name: 'Titan\'s Grip',  level: 20, desc: 'Dual-wield two-handed weapons. Ultimate.', cost: 5 },
        ],
      },
    },
  },
  mage: {
    trees: {
      fire: {
        name: 'Fire', icon: '🔥', desc: 'Explosive damage over time',
        skills: [
          { id: 'fireball',     name: 'Fireball',       level: 1,  desc: 'Hurl a ball of fire dealing splash damage', cost: 1 },
          { id: 'fire_blast',   name: 'Fire Blast',     level: 3,  desc: 'Instant burst of flame, no cast time', cost: 1 },
          { id: 'scorch',       name: 'Scorch',         level: 5,  desc: 'Burn the ground, damaging enemies who stand in it', cost: 1 },
          { id: 'combustion',   name: 'Combustion',     level: 10, desc: 'Ignite all DoTs on target for massive burst', cost: 2 },
          { id: 'meteor',       name: 'Meteor',         level: 15, desc: 'Call down a meteor in target area', cost: 3 },
          { id: 'phoenix',      name: 'Phoenix Rising', level: 20, desc: 'Transform into phoenix, massive AoE + self-rez. Ultimate.', cost: 5 },
        ],
      },
      frost: {
        name: 'Frost', icon: '❄️', desc: 'Control and slowing effects',
        skills: [
          { id: 'frostbolt',    name: 'Frostbolt',      level: 1,  desc: 'Icy projectile that slows target 30%', cost: 1 },
          { id: 'ice_barrier',  name: 'Ice Barrier',    level: 4,  desc: 'Shield absorbing damage equal to 20% max HP', cost: 1 },
          { id: 'blizzard',     name: 'Blizzard',       level: 8,  desc: 'AoE snowstorm slowing and damaging', cost: 2 },
          { id: 'frozen_orb',   name: 'Frozen Orb',     level: 12, desc: 'Slow-moving orb spraying ice shards', cost: 2 },
          { id: 'ice_lance',    name: 'Ice Lance',      level: 15, desc: 'Piercing ice dealing triple to frozen targets', cost: 3 },
          { id: 'glacial_spike',name: 'Glacial Spike',  level: 20, desc: 'Massive icicle shattering frozen enemies. Ultimate.', cost: 5 },
        ],
      },
      arcane: {
        name: 'Arcane', icon: '✨', desc: 'Raw magical power and teleportation',
        skills: [
          { id: 'arcane_blast', name: 'Arcane Blast',   level: 1,  desc: 'Pure arcane energy bolt, stacking damage', cost: 1 },
          { id: 'blink',        name: 'Blink',          level: 3,  desc: 'Teleport forward 15m instantly', cost: 1 },
          { id: 'arcane_barrier',name: 'Arcane Barrier', level: 6,  desc: 'Mana-powered shield absorbing all damage', cost: 2 },
          { id: 'slow_time',    name: 'Slow Time',      level: 10, desc: 'Time dilation bubble, enemies slowed 60%', cost: 2 },
          { id: 'teleport_block',name: 'Teleport Block', level: 14, desc: 'Place persistent teleport node (max 10)', cost: 3 },
          { id: 'arcane_power', name: 'Arcane Power',   level: 20, desc: 'All spells cost 0 mana for 10s. Ultimate.', cost: 5 },
        ],
      },
    },
  },
  ranger: {
    trees: {
      marksmanship: {
        name: 'Marksmanship', icon: '🎯', desc: 'Ranged precision and critical strikes',
        skills: [
          { id: 'aimed_shot',   name: 'Aimed Shot',     level: 1,  desc: 'Carefully aimed shot dealing 200% damage', cost: 1 },
          { id: 'rapid_fire',   name: 'Rapid Fire',     level: 3,  desc: 'Fire 5 arrows in quick succession', cost: 1 },
          { id: 'headshot',     name: 'Headshot',       level: 6,  desc: 'Guaranteed crit to stunned targets', cost: 2 },
          { id: 'arrow_rain',   name: 'Arrow Rain',     level: 10, desc: 'Rain arrows on target area for 4s', cost: 2 },
          { id: 'snipe',        name: 'Snipe',          level: 15, desc: 'Long-range shot, +50% damage per 10m distance', cost: 3 },
          { id: 'killshot',     name: 'Kill Shot',      level: 20, desc: 'Execute arrow, instant kill below 15%. Ultimate.', cost: 5 },
        ],
      },
      survival: {
        name: 'Survival', icon: '🗡️', desc: 'Melee combat and traps',
        skills: [
          { id: 'raptor_strike',name: 'Raptor Strike',  level: 1,  desc: 'Quick melee slash with bonus bleed', cost: 1 },
          { id: 'harpoon',      name: 'Harpoon',        level: 4,  desc: 'Throw harpoon pulling you to target', cost: 1 },
          { id: 'trap',         name: 'Steel Trap',     level: 6,  desc: 'Place trap rooting enemy for 4s', cost: 1 },
          { id: 'wildfire_bomb',name: 'Wildfire Bomb',  level: 10, desc: 'AoE fire grenade with DoT', cost: 2 },
          { id: 'flanking',     name: 'Flanking Strike', level: 14, desc: 'Dash behind target for backstab crit', cost: 3 },
          { id: 'coordinated',  name: 'Coordinated Assault', level: 20, desc: 'You and companion attack in perfect sync. Ultimate.', cost: 5 },
        ],
      },
      beast: {
        name: 'Beast Mastery', icon: '🐾', desc: 'Companion and pet abilities',
        skills: [
          { id: 'call_pet',     name: 'Call Companion', level: 1,  desc: 'Summon your companion to fight alongside', cost: 1 },
          { id: 'mend_pet',     name: 'Mend Companion', level: 3,  desc: 'Heal companion for 30% HP over 5s', cost: 1 },
          { id: 'bestial_wrath',name: 'Bestial Wrath',  level: 8,  desc: 'Enrage companion, +50% damage for 10s', cost: 2 },
          { id: 'dire_beast',   name: 'Dire Beast',     level: 12, desc: 'Summon a wild beast to fight for 15s', cost: 2 },
          { id: 'stampede',     name: 'Stampede',       level: 16, desc: 'Call all saved companions to charge', cost: 3 },
          { id: 'alpha_predator',name:'Alpha Predator', level: 20, desc: 'Fuse with companion gaining all abilities. Ultimate.', cost: 5 },
        ],
      },
    },
  },
  worge: {
    trees: {
      bear: {
        name: 'Bear Form', icon: '🐻', desc: 'Tank and powerful melee',
        skills: [
          { id: 'maul',         name: 'Maul',           level: 1,  desc: 'Heavy swipe dealing 180% damage', cost: 1 },
          { id: 'thick_hide',   name: 'Thick Hide',     level: 3,  desc: 'Passive +25% damage reduction in bear form', cost: 1 },
          { id: 'thrash',       name: 'Thrash',         level: 6,  desc: 'AoE thrash bleeding all nearby', cost: 2 },
          { id: 'iron_fur',     name: 'Iron Fur',       level: 10, desc: 'Harden fur, +40% armor for 6s', cost: 2 },
          { id: 'pulverize',    name: 'Pulverize',      level: 15, desc: 'Consume bleeds for massive burst damage', cost: 3 },
          { id: 'ursoc',        name: 'Ursoc\'s Fury',  level: 20, desc: 'Become giant bear, 3x HP for 12s. Ultimate.', cost: 5, model: 'worge_forms/warbear' },
        ],
      },
      raptor: {
        name: 'Raptor Form', icon: '🦎', desc: 'Stealth and assassination',
        skills: [
          { id: 'rake',         name: 'Rake',           level: 1,  desc: 'Stealth opener with bleed', cost: 1 },
          { id: 'prowl',        name: 'Prowl',          level: 2,  desc: 'Enter stealth, invisible to enemies', cost: 1 },
          { id: 'shred',        name: 'Shred',          level: 5,  desc: 'Shred from behind for 200% damage', cost: 1 },
          { id: 'rip',          name: 'Rip',            level: 8,  desc: 'Powerful bleed dealing damage over 12s', cost: 2 },
          { id: 'ferocious',    name: 'Ferocious Bite', level: 12, desc: 'Finishing move, damage scales with combo points', cost: 2 },
          { id: 'predator',     name: 'Apex Predator',  level: 20, desc: 'Permanent stealth while moving. Ultimate.', cost: 5, model: 'worge_forms/raptor' },
        ],
      },
      bird: {
        name: 'Bird Form', icon: '🦅', desc: 'Flight and aerial combat',
        skills: [
          { id: 'takeoff',      name: 'Take Off',       level: 1,  desc: 'Launch into the air, gaining flight', cost: 1 },
          { id: 'dive_bomb',    name: 'Dive Bomb',      level: 4,  desc: 'Dive at target for impact + stun', cost: 1 },
          { id: 'gust',         name: 'Gust',           level: 7,  desc: 'Wing blast pushing enemies back', cost: 1 },
          { id: 'carry',        name: 'Carry Ally',     level: 10, desc: 'Pick up and carry an ally while flying', cost: 2 },
          { id: 'storm_winds',  name: 'Storm Winds',    level: 15, desc: 'Create tornado dealing AoE + knockup', cost: 3 },
          { id: 'sky_lord',     name: 'Sky Lord',       level: 20, desc: 'Become massive eagle, raid-boss sized. Ultimate.', cost: 5 },
        ],
      },
    },
  },
};

// ══════════════════════════════════════════════════════════════
// PROFESSIONS (5 Harvesting)
// ══════════════════════════════════════════════════════════════
export const PROFESSIONS = {
  mining: {
    name: 'Mining', icon: '⛏️', color: '#a8a8a8',
    desc: 'Extract ores, gems, and rare minerals from rock formations.',
    attr: 'STR',
    tiers: [
      { level: 1,  name: 'Apprentice Miner',   resources: ['Copper Ore', 'Tin Ore', 'Stone'] },
      { level: 10, name: 'Journeyman Miner',    resources: ['Iron Ore', 'Coal', 'Silver Ore'] },
      { level: 25, name: 'Expert Miner',         resources: ['Gold Ore', 'Mithril Ore', 'Gems'] },
      { level: 40, name: 'Artisan Miner',        resources: ['Adamantite', 'Starstone', 'Rare Gems'] },
      { level: 60, name: 'Master Miner',         resources: ['Void Crystal', 'Dragon Ore', 'Legendary Gems'] },
    ],
  },
  herbalism: {
    name: 'Herbalism', icon: '🌿', color: '#22c55e',
    desc: 'Gather herbs, flowers, and magical plants for alchemy.',
    attr: 'WIS',
    tiers: [
      { level: 1,  name: 'Apprentice Herbalist', resources: ['Peacebloom', 'Silverleaf', 'Earthroot'] },
      { level: 10, name: 'Journeyman Herbalist',  resources: ['Mageroyal', 'Briarthorn', 'Swiftthistle'] },
      { level: 25, name: 'Expert Herbalist',       resources: ['Goldthorn', 'Khadgar\'s Whisker', 'Firebloom'] },
      { level: 40, name: 'Artisan Herbalist',      resources: ['Dreamfoil', 'Mountain Silversage', 'Plaguebloom'] },
      { level: 60, name: 'Master Herbalist',       resources: ['Black Lotus', 'Fel Lotus', 'Nightmare Vine'] },
    ],
  },
  woodcutting: {
    name: 'Woodcutting', icon: '🪓', color: '#92400e',
    desc: 'Fell trees and harvest rare woods for construction and crafting.',
    attr: 'END',
    tiers: [
      { level: 1,  name: 'Apprentice Logger',    resources: ['Oak Log', 'Pine Log', 'Bark'] },
      { level: 10, name: 'Journeyman Logger',     resources: ['Maple Log', 'Birch Log', 'Resin'] },
      { level: 25, name: 'Expert Logger',          resources: ['Ironwood', 'Darkwood', 'Amber Sap'] },
      { level: 40, name: 'Artisan Logger',         resources: ['Spiritwood', 'Petrified Log', 'Elder Sap'] },
      { level: 60, name: 'Master Logger',          resources: ['World Tree Branch', 'Void Wood', 'Eternal Sap'] },
    ],
  },
  skinning: {
    name: 'Skinning', icon: '🔪', color: '#dc2626',
    desc: 'Skin beasts and monsters for leather, scales, and bone.',
    attr: 'DEX',
    tiers: [
      { level: 1,  name: 'Apprentice Skinner',   resources: ['Light Leather', 'Bone Fragment', 'Sinew'] },
      { level: 10, name: 'Journeyman Skinner',    resources: ['Medium Leather', 'Thick Hide', 'Fang'] },
      { level: 25, name: 'Expert Skinner',         resources: ['Heavy Leather', 'Dragon Scale', 'Claw'] },
      { level: 40, name: 'Artisan Skinner',        resources: ['Runic Leather', 'Ancient Scale', 'Spirit Bone'] },
      { level: 60, name: 'Master Skinner',         resources: ['Void Leather', 'Titan Scale', 'Primordial Bone'] },
    ],
  },
  fishing: {
    name: 'Fishing', icon: '🎣', color: '#3b82f6',
    desc: 'Catch fish, treasure, and rare aquatic materials.',
    attr: 'LCK',
    tiers: [
      { level: 1,  name: 'Apprentice Fisher',    resources: ['Trout', 'Bass', 'Clam'] },
      { level: 10, name: 'Journeyman Fisher',     resources: ['Salmon', 'Swordfish', 'Pearl'] },
      { level: 25, name: 'Expert Fisher',          resources: ['Golden Fish', 'Electric Eel', 'Black Pearl'] },
      { level: 40, name: 'Artisan Fisher',         resources: ['Kraken Tentacle', 'Abyssal Fish', 'Sea Diamond'] },
      { level: 60, name: 'Master Fisher',          resources: ['Leviathan Scale', 'Void Fish', 'Ocean Heart'] },
    ],
  },
};

// ══════════════════════════════════════════════════════════════
// WEAPON TYPES (17)
// ══════════════════════════════════════════════════════════════
export const WEAPON_TYPES = {
  sword:      { name: '1H Sword',   icon: '⚔️',  hand: '1h', classes: ['warrior', 'ranger'] },
  '2h_sword': { name: '2H Sword',   icon: '🗡️',  hand: '2h', classes: ['warrior', 'ranger'] },
  axe:        { name: '1H Axe',     icon: '🪓',  hand: '1h', classes: ['warrior'] },
  '2h_axe':   { name: '2H Axe',     icon: '⚒️',  hand: '2h', classes: ['warrior'] },
  hammer:     { name: '1H Hammer',  icon: '🔨',  hand: '1h', classes: ['warrior', 'worge'] },
  '2h_hammer':{ name: '2H Hammer',  icon: '🔨',  hand: '2h', classes: ['warrior'] },
  dagger:     { name: 'Dagger',     icon: '🗡️',  hand: '1h', classes: ['ranger', 'worge'] },
  spear:      { name: 'Spear',      icon: '🔱',  hand: '2h', classes: ['ranger', 'worge'] },
  bow:        { name: 'Bow',        icon: '🏹',  hand: '2h', classes: ['ranger', 'worge'] },
  crossbow:   { name: 'Crossbow',   icon: '🏹',  hand: '2h', classes: ['ranger'] },
  gun:        { name: 'Gun',        icon: '🔫',  hand: '2h', classes: ['ranger'] },
  staff:      { name: 'Staff',      icon: '🪄',  hand: '2h', classes: ['mage', 'worge'] },
  wand:       { name: 'Wand',       icon: '✨',  hand: '1h', classes: ['mage'] },
  mace:       { name: 'Mace',       icon: '🔨',  hand: '1h', classes: ['mage', 'worge'] },
  tome:       { name: 'Tome',       icon: '📖',  hand: 'oh', classes: ['mage'] },
  offhand_relic:{ name: 'Off-Hand Relic', icon: '💎', hand: 'oh', classes: ['mage', 'worge'] },
  shield:     { name: 'Shield',     icon: '🛡️',  hand: 'oh', classes: ['warrior'] },
};

// ══════════════════════════════════════════════════════════════
// WEAPON → ANIMATION PACK MAPPING
// Connects each weapon type to its animation pack from FactionRegistry
// ══════════════════════════════════════════════════════════════
export const WEAPON_ANIM_MAP = {
  // 1H + Shield
  sword:        { animPack: 'pro_sword_shield', drawAnim: 'draw sword 1.fbx', sheathAnim: 'sheath sword 1.fbx', idleAnim: 'sword and shield idle.fbx', bone: 'R_hand' },
  shield:       { animPack: 'pro_sword_shield', drawAnim: null, sheathAnim: null, idleAnim: 'sword and shield block idle.fbx', bone: 'L_shield' },
  // 2H Melee
  '2h_sword':   { animPack: 'great_sword', drawAnim: 'draw a great sword 1.fbx', sheathAnim: 'draw a great sword 2.fbx', idleAnim: 'great sword idle.fbx', bone: 'R_hand' },
  axe:          { animPack: 'pro_melee_axe', drawAnim: 'standing disarm over shoulder.fbx', sheathAnim: 'standing disarm underarm.fbx', idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  '2h_axe':     { animPack: 'pro_melee_axe', drawAnim: 'standing disarm over shoulder.fbx', sheathAnim: 'standing disarm underarm.fbx', idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  hammer:       { animPack: '2h_melee', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  '2h_hammer':  { animPack: '2h_melee', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  mace:         { animPack: '2h_melee', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  dagger:       { animPack: '1h_sword_shield', drawAnim: 'draw sword 1.fbx', sheathAnim: 'sheath sword 1.fbx', idleAnim: 'sword and shield idle.fbx', bone: 'R_hand' },
  spear:        { animPack: '2h_melee', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  // Ranged
  bow:          { animPack: 'pro_longbow', drawAnim: 'standing equip bow.fbx', sheathAnim: 'standing disarm bow.fbx', idleAnim: 'standing idle 01.fbx', bone: 'L_hand' },
  crossbow:     { animPack: 'rifle_crossbow', drawAnim: null, sheathAnim: null, idleAnim: 'rifle aiming idle.fbx', bone: 'L_hand' },
  gun:          { animPack: 'advanced_gun', drawAnim: null, sheathAnim: null, idleAnim: 'idle.fbx', bone: 'R_hand' },
  // Magic
  staff:        { animPack: 'pro_magic', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  wand:         { animPack: 'magic', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'R_hand' },
  tome:         { animPack: 'pro_magic', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'L_hand' },
  offhand_relic:{ animPack: 'pro_magic', drawAnim: null, sheathAnim: null, idleAnim: 'standing idle.fbx', bone: 'L_hand' },
};

// Bone container names for weapon attachment
export const WEAPON_BONE_MAP = {
  R_hand:   'R_hand_container',
  L_hand:   'L_hand_container',
  L_shield: 'L_shield_container',
};

// Combat actions per weapon animation pack — maps hotbar slots to animation files
export const COMBAT_ACTIONS = {
  pro_sword_shield: {
    slot1: { name: 'Slash',   file: 'sword and shield attack.fbx' },
    slot2: { name: 'Slash 2', file: 'sword and shield attack (2).fbx' },
    slot3: { name: 'Kick',    file: 'sword and shield kick.fbx' },
    slot4: { name: 'Power',   file: 'sword and shield power up.fbx' },
    block: { name: 'Block',   file: 'sword and shield block.fbx' },
    dodge: { name: 'Dodge',   file: 'sword and shield strafe.fbx' },
    death: { name: 'Death',   file: 'sword and shield death.fbx' },
    run:   { name: 'Run',     file: 'sword and shield run.fbx' },
  },
  great_sword: {
    slot1: { name: 'Slash',     file: 'great sword slash.fbx' },
    slot2: { name: 'Spin',      file: 'great sword high spin attack.fbx' },
    slot3: { name: 'Kick',      file: 'great sword kick.fbx' },
    slot4: { name: 'Slide Atk', file: 'great sword slide attack.fbx' },
    block: { name: 'Block',     file: 'great sword blocking.fbx' },
    dodge: { name: 'Dodge',     file: 'great sword strafe.fbx' },
    death: { name: 'Death',     file: 'two handed sword death.fbx' },
    run:   { name: 'Run',       file: 'great sword run.fbx' },
  },
  pro_melee_axe: {
    slot1: { name: 'Horizontal', file: 'standing melee attack horizontal.fbx' },
    slot2: { name: 'Downward',   file: 'standing melee attack downward.fbx' },
    slot3: { name: 'Combo 1',    file: 'standing melee combo attack ver. 1.fbx' },
    slot4: { name: 'Spin 360',   file: 'standing melee attack 360 high.fbx' },
    block: { name: 'Block',      file: 'standing block idle.fbx' },
    dodge: { name: 'Kick',       file: 'standing melee attack kick ver. 1.fbx' },
    death: { name: 'Death',      file: null },
    run:   { name: 'Run',        file: null },
  },
  '2h_melee': {
    slot1: { name: 'Horizontal', file: 'standing melee attack horizontal.fbx' },
    slot2: { name: 'Backhand',   file: 'standing melee attack backhand.fbx' },
    slot3: { name: 'Combo',      file: 'standing melee combo attack ver. 1.fbx' },
    slot4: { name: 'Jump Atk',   file: 'standing melee run jump attack.fbx' },
    block: { name: 'Block',      file: 'standing block idle.fbx' },
    dodge: { name: 'Taunt',      file: 'standing taunt battlecry.fbx' },
    death: { name: 'Death',      file: null },
    run:   { name: 'Run',        file: 'standing run forward.fbx' },
  },
  pro_longbow: {
    slot1: { name: 'Shoot',   file: 'standing aim recoil.fbx' },
    slot2: { name: 'Dive',    file: 'standing dive forward.fbx' },
    slot3: { name: 'Kick',    file: 'standing melee kick.fbx' },
    slot4: { name: 'Punch',   file: 'standing melee punch.fbx' },
    block: { name: 'Block',   file: 'standing block.fbx' },
    dodge: { name: 'Dodge',   file: 'standing dodge forward.fbx' },
    death: { name: 'Death',   file: 'standing death forward 01.fbx' },
    run:   { name: 'Run',     file: 'standing run forward.fbx' },
  },
  rifle_crossbow: {
    slot1: { name: 'Fire',    file: 'firing rifle.fbx' },
    slot2: { name: 'Reload',  file: 'reloading.fbx' },
    slot3: { name: 'Grenade', file: 'toss grenade.fbx' },
    slot4: { name: 'Hit',     file: 'hit reaction.fbx' },
    block: { name: 'Aim',     file: 'rifle aiming idle.fbx' },
    dodge: { name: 'Strafe',  file: 'strafe left.fbx' },
    death: { name: 'Death',   file: null },
    run:   { name: 'Run',     file: 'rifle run.fbx' },
  },
  advanced_gun: {
    slot1: { name: 'Aim',     file: 'idle aiming.fbx' },
    slot2: { name: 'Sprint',  file: 'sprint forward.fbx' },
    slot3: { name: 'Turn L',  file: 'turn 90 left.fbx' },
    slot4: { name: 'Turn R',  file: 'turn 90 right.fbx' },
    block: { name: 'Aim Idle',file: 'idle aiming.fbx' },
    dodge: { name: 'Dodge',   file: 'run left.fbx' },
    death: { name: 'Death',   file: 'death from front headshot.fbx' },
    run:   { name: 'Run',     file: 'run forward.fbx' },
  },
  pro_magic: {
    slot1: { name: '1H Cast',  file: 'standing 1H cast spell 01.fbx' },
    slot2: { name: '2H Cast',  file: 'Standing 2H Cast Spell 01.fbx' },
    slot3: { name: 'Area Atk', file: 'Standing 2H Magic Area Attack 01.fbx' },
    slot4: { name: 'Magic 3',  file: 'Standing 2H Magic Attack 03.fbx' },
    block: { name: 'Crouch',   file: 'Crouch Idle.fbx' },
    dodge: { name: 'Dodge',    file: 'Crouch Walk Forward.fbx' },
    death: { name: 'Death',    file: null },
    run:   { name: 'Run',      file: null },
  },
  magic: {
    slot1: { name: '1H Cast',  file: 'Standing 1H Magic Attack 01.fbx' },
    slot2: { name: '2H Area',  file: 'Standing 2H Magic Area Attack 02.fbx' },
    slot3: { name: 'React',    file: 'Standing React Large From Front.fbx' },
    slot4: { name: 'Jump',     file: 'Standing Jump.fbx' },
    block: { name: 'Idle 2',   file: 'standing idle 02.fbx' },
    dodge: { name: 'Turn',     file: 'Standing Turn Left 90.fbx' },
    death: { name: 'Death',    file: 'Standing React Death Backward.fbx' },
    run:   { name: 'Run',      file: 'Standing Run Forward.fbx' },
  },
  '1h_sword_shield': {
    slot1: { name: 'Slash',   file: 'sword and shield attack.fbx' },
    slot2: { name: 'Slash 2', file: 'sword and shield attack (2).fbx' },
    slot3: { name: 'Slash 3', file: 'sword and shield attack (3).fbx' },
    slot4: { name: 'Slash 4', file: 'sword and shield attack (4).fbx' },
    block: { name: 'Block',   file: 'sword and shield block.fbx' },
    dodge: { name: 'Strafe',  file: 'sword and shield strafe.fbx' },
    death: { name: 'Death',   file: 'sword and shield death.fbx' },
    run:   { name: 'Run',     file: 'sword and shield run.fbx' },
  },
};

// ══════════════════════════════════════════════════════════════
// WEAPON SKILL TREES (per weapon type)
// ══════════════════════════════════════════════════════════════
function generateWeaponSkills(weaponName) {
  return [
    { id: 'basic',    name: `${weaponName} Basics`,     level: 1,  desc: `Basic ${weaponName.toLowerCase()} techniques`, bonus: '+5% damage' },
    { id: 'adept',    name: `${weaponName} Adept`,      level: 5,  desc: `Improved ${weaponName.toLowerCase()} handling`, bonus: '+10% damage, +5% speed' },
    { id: 'spec_1',   name: `${weaponName} Spec I`,     level: 10, desc: `Unlock special ${weaponName.toLowerCase()} ability`, bonus: 'Special attack unlocked' },
    { id: 'expert',   name: `${weaponName} Expert`,     level: 15, desc: `Expert ${weaponName.toLowerCase()} techniques`, bonus: '+15% damage, +10% crit' },
    { id: 'spec_2',   name: `${weaponName} Spec II`,    level: 20, desc: `Advanced ${weaponName.toLowerCase()} ability`, bonus: 'Advanced attack unlocked' },
    { id: 'master',   name: `${weaponName} Mastery`,    level: 25, desc: `Mastered ${weaponName.toLowerCase()} combat`, bonus: '+25% damage, +15% crit, special proc' },
  ];
}

export const WEAPON_SKILLS = {};
for (const [id, wep] of Object.entries(WEAPON_TYPES)) {
  WEAPON_SKILLS[id] = {
    name: wep.name,
    icon: wep.icon,
    skills: generateWeaponSkills(wep.name),
  };
}

// ══════════════════════════════════════════════════════════════
// WEAPON MASTERY
// ══════════════════════════════════════════════════════════════
export const MASTERY_TIERS = [
  { tier: 1, name: 'Novice',       xp: 0,      bonus: 'None' },
  { tier: 2, name: 'Apprentice',   xp: 500,    bonus: '+3% damage' },
  { tier: 3, name: 'Journeyman',   xp: 2000,   bonus: '+6% damage, +3% speed' },
  { tier: 4, name: 'Expert',       xp: 5000,   bonus: '+10% damage, +5% speed, +5% crit' },
  { tier: 5, name: 'Master',       xp: 12000,  bonus: '+15% damage, +8% speed, +8% crit' },
  { tier: 6, name: 'Grandmaster',  xp: 25000,  bonus: '+20% damage, +10% speed, +12% crit, unique proc' },
  { tier: 7, name: 'Legend',       xp: 50000,  bonus: '+25% all, unique passive + visual effect' },
];

export function getMasteryTier(xp) {
  let current = MASTERY_TIERS[0];
  for (const tier of MASTERY_TIERS) {
    if (xp >= tier.xp) current = tier;
    else break;
  }
  return current;
}

export function getMasteryProgress(xp) {
  const current = getMasteryTier(xp);
  const idx = MASTERY_TIERS.indexOf(current);
  const next = MASTERY_TIERS[idx + 1];
  if (!next) return { current, next: null, progress: 1.0 };
  return {
    current,
    next,
    progress: (xp - current.xp) / (next.xp - current.xp),
  };
}
