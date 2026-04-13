/**
 * FactionRegistry — Complete map of all 6 faction/race combos.
 *
 * Each race's customizable FBX has ALL equipment baked as child meshes.
 * The EquipmentManager reads this registry to know what prefix to strip
 * and which slot categories to expect.
 *
 * Path base:  D:\Games\Models\grudgeracecharacters\factioncharacters\
 */

// In production, set VITE_ASSET_BASE_URL to your object storage origin
// e.g. https://objects.grudge-studio.com/race-characters
// In local dev, Vite serves parent dir via fs.allow so '../' works.
const ASSET_URL = import.meta.env.VITE_ASSET_BASE_URL || '..';
const BASE = `${ASSET_URL}/factioncharacters`;
const ANIM_BASE = `${ASSET_URL}/animationsweapons`;

// Bone containers (identical across all 6 races)
export const BONE_CONTAINERS = {
  rightHand:  'R_hand_container',
  leftHand:   'L_hand_container',
  leftShield: 'L_shield_container',
  bag:        'Bone_bag',
  wood:       'Bone_wood',
  quiver:     'Quiver_container',
};

// Slot definitions — regex patterns to match child mesh names after prefix strip
export const SLOT_PATTERNS = {
  body:       /^Units_Body_([A-Z])$/i,
  arms:       /^Units_Arms_([A-Z])$/i,
  legs:       /^Units_Legs_([A-Z])$/i,
  head:       /^Units_head_([A-Z])$/i,
  shoulders:  /^Units_shoulderpads_([A-Z])$/i,
  // Weapons (right hand)
  axe:        /^Units_axe_([A-Z])$|^weapon_Axe_([A-Z])$/i,
  hammer:     /^Units_hammer_([A-Z])$|^weapon_hammer_([A-Z])$/i,
  sword:      /^Units_sword_([A-Z])$|^weapon_Sword_([A-Z])$/i,
  pick:       /^Units_pick$/i,
  spear:      /^Units_spear$|^weapon_Spear$/i,
  // Left hand items
  bow:        /^Units_Bow$|^weapon_Bow$/i,
  staff:      /^Units_staff_([A-Z])$|^weapon_staff_([A-Z])$/i,
  // Shields
  shield:     /^Units_shield_([A-Z])$|^Shield_([A-Z])$/i,
  // Utility
  bag:        /^Xtra_bag$|^Units_bag$/i,
  wood:       /^Xtra_wood$|^Units_wood$/i,
  quiver:     /^Xtra_quiver$|^Units_quiver$/i,
};

// Slot groupings for the UI
export const SLOT_GROUPS = {
  armor:    ['body', 'arms', 'legs', 'head', 'shoulders'],
  weapons:  ['axe', 'hammer', 'sword', 'pick', 'spear', 'bow', 'staff'],
  shields:  ['shield'],
  utility:  ['bag', 'wood', 'quiver'],
};

export const FACTIONS = {
  crusade: {
    name: 'Crusade',
    color: '#c9a04e',
    races: {
      human: {
        name: 'Human',
        prefix: 'WK_',
        model:    `${BASE}/Crusade/Human/models/WK_Characters_customizable.FBX`,
        cavalry:  `${BASE}/Crusade/Human/models/WK_Cavalry_customizable.FBX`,
        catapult: `${BASE}/Crusade/Human/models/WK_Catapult.FBX`,
        textures: {
          standard: `${BASE}/Crusade/Human/models/Materials/textures/WK_Standard_Units.tga`,
          black:    `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_black.tga`,
          blue:     `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_blue.tga`,
          brown:    `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_brown.tga`,
          green:    `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_green.tga`,
          red:      `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_red.tga`,
          white:    `${BASE}/Crusade/Human/models/Materials/Colors/textures/WK_StandardUnits_white.tga`,
        },
        extraEquipment: [
          `${BASE}/Crusade/Human/models/extra models/equipment/WK_weapon_staff_B.FBX`,
          `${BASE}/Crusade/Human/models/extra models/equipment/WK_weapon_sword_A.FBX`,
        ],
        animations: {
          catapult: `${BASE}/Crusade/Human/animation/Catapult/`,
          cavalry:  `${BASE}/Crusade/Human/animation/Cavalry/`,
        },
      },
      barbarian: {
        name: 'Barbarian',
        prefix: 'BRB_',
        model:    `${BASE}/Crusade/Barbarians/models/BRB_Characters_customizable.FBX`,
        cavalry:  `${BASE}/Crusade/Barbarians/models/BRB_Cavalry_customizable.FBX`,
        textures: {
          standard: `${BASE}/Crusade/Barbarians/models/Materials/BRB_StandardUnits_texture.tga`,
          brown:    `${BASE}/Crusade/Barbarians/models/Materials/Color/textures/BRB_Standard_Units_brown.tga`,
        },
        extraEquipment: [
          `${BASE}/Crusade/Barbarians/models/extra models/Equipment/BRB_weapon_hammer_B.FBX`,
          `${BASE}/Crusade/Barbarians/models/extra models/Equipment/BRB_weapon_spear.FBX`,
          `${BASE}/Crusade/Barbarians/models/extra models/Equipment/BRB_weapon_staff_B.FBX`,
          `${BASE}/Crusade/Barbarians/models/extra models/Equipment/BRB_weapon_sword_B.FBX`,
        ],
        animations: {
          mage:     `${BASE}/Crusade/Barbarians/animation/Mage/`,
          spearman: `${BASE}/Crusade/Barbarians/animation/Spearman/`,
        },
      },
    },
  },

  fabled: {
    name: 'Fabled',
    color: '#7ec8e3',
    races: {
      elf: {
        name: 'Elf',
        prefix: 'ELF_',
        model:    `${BASE}/Fabled/Elves/models/ELF_Characters_customizable.FBX`,
        cavalry:  `${BASE}/Fabled/Elves/models/ELF_Cavalry_customizable.FBX`,
        siege:    `${BASE}/Fabled/Elves/models/ELF_BoltThrower.FBX`,
        textures: {
          highElf:  `${BASE}/Fabled/Elves/models/Materials/ELF_HighElves_Texture.tga`,
          darkElf:  `${BASE}/Fabled/Elves/models/Materials/ELF_DarkElves_Texture.tga`,
          woodElf:  `${BASE}/Fabled/Elves/models/Materials/ELF_WoodElves_Texture.tga`,
          darkBlue: `${BASE}/Fabled/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Blue.tga`,
          darkGreen:`${BASE}/Fabled/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Green.tga`,
          darkRed:  `${BASE}/Fabled/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Red.tga`,
          woodBrown:`${BASE}/Fabled/Elves/models/Materials/Color/WoodElves/textures/ELF_WoodElves_Brown.tga`,
        },
        extraEquipment: [
          `${BASE}/Fabled/Elves/models/extra models/ELF_bolt.FBX`,
          `${BASE}/Fabled/Elves/models/extra models/equipment/ELF_weapon_spear.FBX`,
          `${BASE}/Fabled/Elves/models/extra models/equipment/ELF_weapon_staff_C.FBX`,
        ],
        animations: {
          boltThrower:  `${BASE}/Fabled/Elves/animation/BoltThrower/`,
          cavalryMage:  `${BASE}/Fabled/Elves/animation/Cavalry_Mage/`,
          cavalrySpear: `${BASE}/Fabled/Elves/animation/Cavalry_Spear/`,
        },
      },
      dwarf: {
        name: 'Dwarf',
        prefix: 'DWF_',
        model:    `${BASE}/Fabled/Dwarves/models/DWF_Characters_customizable.FBX`,
        cavalry:  `${BASE}/Fabled/Dwarves/models/DWF_Cavalry_customizable.FBX`,
        textures: {
          standard: `${BASE}/Fabled/Dwarves/models/Materials/DWF_Standard_Units.tga`,
          brown:    `${BASE}/Fabled/Dwarves/models/Materials/Colors/Textures/DWF_Units_Brown.tga`,
        },
        extraEquipment: [],
        animations: {
          cavalry: `${BASE}/Fabled/Dwarves/animation/Cavalry/`,
          worker:  `${BASE}/Fabled/Dwarves/animation/Worker/`,
        },
      },
    },
  },

  legion: {
    name: 'Legion',
    color: '#8b2020',
    races: {
      orc: {
        name: 'Orc',
        prefix: 'ORC_',
        model:    `${BASE}/Legion/Orcs/models/ORC_Characters_Customizable.FBX`,
        cavalry:  `${BASE}/Legion/Orcs/models/ORC_Cavalry_Customizable.FBX`,
        catapult: `${BASE}/Legion/Orcs/models/ORC_Catapult.FBX`,
        textures: {
          standard: `${BASE}/Legion/Orcs/models/Materials/textures/ORC_StandardUnits.tga`,
          black:    `${BASE}/Legion/Orcs/models/Materials/color/textures/ORC_StandardUnits_black.tga`,
          blue:     `${BASE}/Legion/Orcs/models/Materials/color/textures/ORC_StandardUnits_blue.tga`,
          brown:    `${BASE}/Legion/Orcs/models/Materials/color/textures/ORC_StandardUnits_brown.tga`,
          green:    `${BASE}/Legion/Orcs/models/Materials/color/textures/ORC_StandardUnits_green.tga`,
          red:      `${BASE}/Legion/Orcs/models/Materials/color/textures/ORC_StandardUnits_red.tga`,
        },
        extraEquipment: [
          `${BASE}/Legion/Orcs/models/extra_models/Equipment/ORC_Shield_D.FBX`,
          `${BASE}/Legion/Orcs/models/extra_models/Equipment/ORC_weapon_Axe_A.FBX`,
          `${BASE}/Legion/Orcs/models/extra_models/Equipment/ORC_weapon_staff_B.FBX`,
        ],
        animations: {
          catapult: `${BASE}/Legion/Orcs/animation/Catapult/`,
          cavalry:  `${BASE}/Legion/Orcs/animation/Cavalry/`,
          worker:   `${BASE}/Legion/Orcs/animation/Worker/`,
        },
      },
      undead: {
        name: 'Undead',
        prefix: 'UD_',
        model:    `${BASE}/Legion/Undead/models/UD_Characters_customizable.FBX`,
        cavalry:  `${BASE}/Legion/Undead/models/UD_Cavalry_customizable.FBX`,
        textures: {
          standard: `${BASE}/Legion/Undead/models/Materials/UD_Standard_Units.tga`,
          brown:    `${BASE}/Legion/Undead/models/Materials/Colors/textures/UD_Standard_Units_brown.tga`,
        },
        extraEquipment: [
          `${BASE}/Legion/Undead/models/extra_models/Equipment/UD_Shield_C.FBX`,
          `${BASE}/Legion/Undead/models/extra_models/Equipment/UD_weapon_Spear.FBX`,
          `${BASE}/Legion/Undead/models/extra_models/Equipment/UD_weapon_staff_B.FBX`,
          `${BASE}/Legion/Undead/models/extra_models/Equipment/UD_weapon_Sword_C.FBX`,
        ],
        animations: {},
      },
    },
  },
};

// Weapon animation packs — these apply to ALL races via retargeting
export const WEAPON_ANIMATION_PACKS = {
  '1h_sword_shield': {
    name: '1H Sword & Shield',
    path: `${ANIM_BASE}/1hweaponandshield/`,
    files: [
      'sword and shield idle.fbx',
      'sword and shield run.fbx', 'sword and shield run (2).fbx',
      'sword and shield attack.fbx', 'sword and shield attack (2).fbx',
      'sword and shield attack (3).fbx', 'sword and shield attack (4).fbx',
      'sword and shield block.fbx', 'sword and shield block (2).fbx',
      'sword and shield block idle.fbx',
      'sword and shield strafe.fbx', 'sword and shield strafe (2).fbx',
      'sword and shield turn.fbx', 'sword and shield turn (2).fbx',
      'sword and shield death.fbx',
      'draw sword 1.fbx', 'sheath sword 1.fbx',
    ],
  },
  '2h_melee': {
    name: '2H Melee (Axe/Hammer)',
    path: `${ANIM_BASE}/meleemoves/`,
    files: [
      'standing idle.fbx',
      'standing run forward.fbx', 'standing run back.fbx',
      'standing melee attack horizontal.fbx', 'standing melee attack downward.fbx',
      'standing melee attack backhand.fbx',
      'standing melee attack 360 high.fbx', 'standing melee attack 360 low.fbx',
      'standing melee combo attack ver. 1.fbx',
      'standing melee combo attack ver. 2.fbx',
      'standing melee combo attack ver. 3.fbx',
      'standing melee run jump attack.fbx',
      'standing block idle.fbx', 'standing block react large.fbx',
      'standing jump.fbx',
      'standing walk forward.fbx', 'standing walk back.fbx',
      'standing walk left.fbx', 'standing walk right.fbx',
      'standing turn left 90.fbx', 'standing turn right 90.fbx',
      'standing taunt battlecry.fbx', 'standing taunt chest thump.fbx',
    ],
  },
  longbow: {
    name: 'Longbow',
    path: `${ANIM_BASE}/longbow_pack_unzipped/`,
    files: [
      'standing idle 01.fbx',
      'standing run forward.fbx', 'standing run back.fbx',
      'standing run left.fbx', 'standing run right.fbx',
      'standing aim overdraw.fbx', 'standing aim recoil.fbx',
      'standing draw arrow.fbx', 'standing equip bow.fbx', 'standing disarm bow.fbx',
      'standing aim walk forward.fbx', 'standing aim walk back.fbx',
      'standing aim walk left.fbx', 'standing aim walk right.fbx',
      'standing block.fbx',
      'standing dodge forward.fbx', 'standing dodge backward.fbx',
      'standing dodge left.fbx', 'standing dodge right.fbx',
      'standing death forward 01.fbx', 'standing death backward 01.fbx',
      'standing melee kick.fbx', 'standing melee punch.fbx',
    ],
  },
  magic: {
    name: 'Magic Staff',
    path: `${ANIM_BASE}/magicmotion/`,
    files: [
      'standing idle.fbx', 'standing idle 02.fbx',
      'Standing Run Forward.fbx', 'Standing Run Back.fbx',
      'Standing Walk Forward.fbx', 'Standing Walk Back.fbx',
      'Standing 1H Magic Attack 01.fbx',
      'Standing 2H Magic Area Attack 02.fbx',
      'Standing Jump.fbx',
      'Standing React Death Backward.fbx',
      'Standing React Large From Front.fbx',
      'Standing React Small From Front.fbx',
      'Standing Turn Left 90.fbx', 'Standing Turn Right 90.fbx',
    ],
  },
  rifle_crossbow: {
    name: 'Rifle / Crossbow',
    path: `${ANIM_BASE}/rifleandcrossbow/`,
    files: [
      'rifle aiming idle.fbx', 'rifle run.fbx',
      'firing rifle.fbx', 'reloading.fbx',
      'rifle jump.fbx', 'hit reaction.fbx',
      'run backwards.fbx',
      'strafe left.fbx', 'strafe right.fbx',
      'walking.fbx', 'walking backwards.fbx',
      'toss grenade.fbx',
      'turn left.fbx', 'turning right 45 degrees.fbx',
    ],
  },
  advanced_gun: {
    name: 'Advanced Gun (8-Dir)',
    path: `${ANIM_BASE}/advancedgunandcrossbow/`,
    files: [
      'idle.fbx', 'idle aiming.fbx',
      'run forward.fbx', 'run backward.fbx', 'run left.fbx', 'run right.fbx',
      'sprint forward.fbx',
      'walk forward.fbx', 'walk backward.fbx', 'walk left.fbx', 'walk right.fbx',
      'jump up.fbx', 'jump loop.fbx', 'jump down.fbx',
      'death from front headshot.fbx', 'death from the back.fbx',
      'turn 90 left.fbx', 'turn 90 right.fbx',
    ],
  },

  // ── NEW: Pro packs (expanded versions of base packs) ──
  pro_sword_shield: {
    name: 'Pro Sword & Shield (51)',
    path: `${ANIM_BASE}/pro_sword_shield/`,
    files: [
      'draw sword 1.fbx', 'draw sword 2.fbx',
      'sheath sword 1.fbx', 'sheath sword 2.fbx',
      'sword and shield attack.fbx', 'sword and shield attack (2).fbx',
      'sword and shield attack (3).fbx', 'sword and shield attack (4).fbx',
      'sword and shield block.fbx', 'sword and shield block (2).fbx',
      'sword and shield block idle.fbx',
      'sword and shield casting.fbx', 'sword and shield casting (2).fbx',
      'sword and shield crouch idle.fbx', 'sword and shield crouch.fbx',
      'sword and shield crouch block.fbx', 'sword and shield crouch block (2).fbx',
      'sword and shield crouch block idle.fbx',
      'sword and shield death.fbx', 'sword and shield death (2).fbx',
      'sword and shield idle.fbx', 'sword and shield idle (2).fbx',
      'sword and shield impact.fbx', 'sword and shield impact (2).fbx',
      'sword and shield jump.fbx',
      'sword and shield kick.fbx', 'sword and shield kick (2).fbx',
      'sword and shield power up.fbx',
      'sword and shield run.fbx', 'sword and shield run (2).fbx',
      'sword and shield slash.fbx', 'sword and shield slash (2).fbx',
      'sword and shield strafe.fbx', 'sword and shield strafe (2).fbx',
      'sword and shield strafe (3).fbx', 'sword and shield strafe (4).fbx',
      'sword and shield turn.fbx', 'sword and shield turn (2).fbx',
      'sword and shield 180 turn.fbx', 'sword and shield 180 turn (2).fbx',
      'sword and shield walk.fbx', 'sword and shield walk (2).fbx',
    ],
  },
  pro_longbow: {
    name: 'Pro Longbow (39)',
    path: `${ANIM_BASE}/pro_longbow/`,
    files: [
      'standing aim overdraw.fbx', 'standing aim recoil.fbx',
      'standing aim walk forward.fbx', 'standing aim walk back.fbx',
      'standing aim walk left.fbx', 'standing aim walk right.fbx',
      'standing block.fbx',
      'standing death backward 01.fbx', 'standing death forward 01.fbx',
      'standing disarm bow.fbx', 'standing dive forward.fbx',
      'standing dodge backward.fbx', 'standing dodge forward.fbx',
      'standing dodge left.fbx', 'standing dodge right.fbx',
      'standing draw arrow.fbx', 'standing equip bow.fbx',
      'standing idle 01.fbx', 'standing idle 02.fbx',
      'standing melee kick.fbx', 'standing melee punch.fbx',
      'standing run back.fbx', 'standing run forward.fbx',
      'standing run left.fbx', 'standing run right.fbx',
      'standing turn left 90.fbx', 'standing turn right 90.fbx',
      'standing walk back.fbx', 'standing walk forward.fbx',
      'standing walk left.fbx', 'standing walk right.fbx',
      'fall a loop.fbx', 'fall a land to run forward.fbx',
      'fall a land to standing idle 01.fbx',
    ],
  },
  pro_magic: {
    name: 'Pro Magic (56)',
    path: `${ANIM_BASE}/pro_magic/`,
    files: [
      'standing 1H cast spell 01.fbx',
      'Standing 1H Magic Attack 01.fbx', 'Standing 1H Magic Attack 02.fbx',
      'Standing 1H Magic Attack 03.fbx',
      'Standing 2H Cast Spell 01.fbx',
      'Standing 2H Magic Area Attack 01.fbx', 'Standing 2H Magic Area Attack 02.fbx',
      'Standing 2H Magic Attack 01.fbx', 'Standing 2H Magic Attack 02.fbx',
      'Standing 2H Magic Attack 03.fbx', 'Standing 2H Magic Attack 04.fbx',
      'Standing 2H Magic Attack 05.fbx',
      'Crouch Idle.fbx', 'Crouch To Standing Idle.fbx',
      'Crouch Turn Left 90.fbx', 'Crouch Turn Right 90.fbx',
      'Crouch Walk Back.fbx', 'Crouch Walk Forward.fbx',
      'Crouch Walk Left.fbx', 'Crouch Walk Right.fbx',
    ],
  },
  pro_melee_axe: {
    name: 'Pro Melee Axe (47)',
    path: `${ANIM_BASE}/pro_melee_axe/`,
    files: [
      'standing idle.fbx',
      'standing idle looking ver. 1.fbx', 'standing idle looking ver. 2.fbx',
      'standing jump.fbx',
      'standing melee attack horizontal.fbx', 'standing melee attack downward.fbx',
      'standing melee attack backhand.fbx',
      'standing melee attack 360 high.fbx', 'standing melee attack 360 low.fbx',
      'standing melee combo attack ver. 1.fbx',
      'standing melee combo attack ver. 2.fbx',
      'standing melee combo attack ver. 3.fbx',
      'standing melee attack kick ver. 1.fbx', 'standing melee attack kick ver. 2.fbx',
      'standing block idle.fbx', 'standing block react large.fbx',
      'standing disarm over shoulder.fbx', 'standing disarm underarm.fbx',
      'crouch idle.fbx', 'crouch to standing idle.fbx',
    ],
  },
  great_sword: {
    name: 'Great Sword (52)',
    path: `${ANIM_BASE}/great_swords/`,
    files: [
      'draw a great sword 1.fbx', 'draw a great sword 2.fbx',
      'great sword idle.fbx', 'great sword idle (2).fbx',
      'great sword idle (3).fbx', 'great sword idle (4).fbx', 'great sword idle (5).fbx',
      'great sword attack.fbx', 'great sword high spin attack.fbx',
      'great sword slash.fbx', 'great sword slash (2).fbx',
      'great sword slash (3).fbx', 'great sword slash (4).fbx', 'great sword slash (5).fbx',
      'great sword slide attack.fbx',
      'great sword blocking.fbx', 'great sword blocking (2).fbx', 'great sword blocking (3).fbx',
      'great sword casting.fbx',
      'great sword run.fbx', 'great sword run (2).fbx',
      'great sword walk.fbx', 'great sword walk (2).fbx',
      'great sword strafe.fbx', 'great sword strafe (2).fbx',
      'great sword strafe (3).fbx', 'great sword strafe (4).fbx',
      'great sword turn.fbx', 'great sword turn (2).fbx',
      'great sword 180 turn.fbx', 'great sword 180 turn (2).fbx',
      'great sword jump.fbx', 'great sword jump (2).fbx', 'great sword jump attack.fbx',
      'great sword kick.fbx', 'great sword kick (2).fbx',
      'great sword power up.fbx',
      'great sword impact.fbx', 'great sword impact (2).fbx',
      'great sword impact (3).fbx', 'great sword impact (4).fbx', 'great sword impact (5).fbx',
      'great sword crouching.fbx', 'great sword crouching (2).fbx',
      'great sword crouching (3).fbx', 'great sword crouching (4).fbx',
      'great sword crouching (5).fbx', 'great sword crouching (6).fbx',
      'two handed sword death.fbx', 'two handed sword death (2).fbx',
      'spell cast.fbx',
    ],
  },
  magic_locomotion: {
    name: 'Magic Locomotion (16)',
    path: `${ANIM_BASE}/magic_locomotion/`,
    files: [
      'standing idle.fbx',
      'Standing Run Forward.fbx', 'Standing Run Back.fbx',
      'Standing Run Left.fbx', 'Standing Run Right.fbx',
      'Standing Sprint Forward.fbx',
      'Standing Walk Forward.fbx', 'Standing Walk Back.fbx',
      'Standing Walk Left.fbx', 'Standing Walk Right.fbx',
      'Standing Jump.fbx', 'Standing Jump Running.fbx',
      'Standing Jump Running Landing.fbx', 'Standing Land To Standing Idle.fbx',
      'Standing Turn Left 90.fbx', 'Standing Turn Right 90.fbx',
    ],
  },
  male_injured: {
    name: 'Male Injured (20)',
    path: `${ANIM_BASE}/male_injured/`,
    files: [
      'injured idle.fbx', 'injured hurting idle.fbx', 'injured stumble idle.fbx',
      'injured wave idle.fbx',
      'injured run.fbx', 'injured run jump.fbx',
      'injured run left turn.fbx', 'injured run right turn.fbx',
      'injured run backwards.fbx',
      'injured run backwards left turn.fbx', 'injured run backwards right turn.fbx',
      'injured walk.fbx', 'injured walk backwards.fbx',
      'injured walk left turn.fbx', 'injured walk right turn.fbx',
      'injured turn left.fbx', 'injured turn right.fbx',
      'injured backwards turn left.fbx', 'injured backwards turn right.fbx',
      'injured standing jump.fbx',
    ],
  },
  male_locomotion: {
    name: 'Male Locomotion (11)',
    path: `${ANIM_BASE}/male_locomotion/`,
    files: [
      'idle.fbx', 'standard run.fbx', 'walking.fbx',
      'left strafe.fbx', 'right strafe.fbx',
      'left strafe walking.fbx', 'right strafe walking.fbx',
      'left turn 90.fbx', 'right turn 90.fbx',
      'jump.fbx', 'rac.fbx',
    ],
  },
};

// Standalone weapon model packs (for swapping/testing)
export const WEAPON_MODEL_PACKS = {
  // ── Existing ──
  swords:       { name: 'Swords (24)',           path: `${ANIM_BASE}/3dswords/fbx/`,            count: 24, prefix: '_sword_' },
  axes:         { name: 'Axes 2H (24)',          path: `${ANIM_BASE}/2hweapons/fbx/`,           count: 24, prefix: '_axe_' },
  staffs:       { name: 'Staffs (24)',           path: `${ANIM_BASE}/staffs/fbx/`,              count: 24, prefix: '_cane_' },
  shields:      { name: 'Shields (20)',          path: `${ANIM_BASE}/shields/fbx/`,             count: 20, prefix: '_Shield_' },
  bows:         { name: 'Bows (24)',             path: `${ANIM_BASE}/bows/fbx/bow_full/`,       count: 24, prefix: '_bow_' },
  // ── NEW: Extracted packs ──
  axes_1h:      { name: 'Axes 1H (24)',          path: `${ANIM_BASE}/axes_1h/fbx/`,             count: 24, prefix: '_axe_' },
  axes_2h:      { name: 'Axes 2H Extra (24)',    path: `${ANIM_BASE}/axes_2h/fbx/`,             count: 24, prefix: '_axe_' },
  daggers:      { name: 'Daggers (24)',          path: `${ANIM_BASE}/daggers/fbx/`,             count: 24, prefix: '_dagger_' },
  hammers_2h:   { name: 'Hammers 2H (24)',       path: `${ANIM_BASE}/hammers_2h/fbx/`,          count: 24, prefix: '_hammer_' },
  magic_staffs: { name: 'Magic Staffs (24)',     path: `${ANIM_BASE}/magic_staffs/fbx/`,        count: 24, prefix: '_staff_' },
  crossbows:    { name: 'Crossbows (24)',        path: `${ANIM_BASE}/crossbows/fbx/fbx_full/`,  count: 24, prefix: '_crossbow_' },
  swords_extra: { name: 'Swords Extra (24)',     path: `${ANIM_BASE}/swords_extra/fbx/`,        count: 24, prefix: '_sword_' },
  staffs_extra: { name: 'Staffs Extra (24)',     path: `${ANIM_BASE}/staffs_extra/fbx/`,        count: 24, prefix: '_cane_' },
  fantasy:      { name: 'Fantasy Weapons (58)',  path: `${ANIM_BASE}/fantasy_weapons/`,         count: 58, prefix: '' },
  great_swords: { name: 'Great Swords Models',   path: `${ANIM_BASE}/great_swords/`,            count: 1,  prefix: '' },
  medieval:     { name: 'Medieval Collection (19)', path: `${ANIM_BASE}/medieval_collection/FBX/`, count: 19, prefix: '' },
};

/** Flatten all races into a simple lookup array */
export function getAllRaces() {
  const races = [];
  for (const [factionId, faction] of Object.entries(FACTIONS)) {
    for (const [raceId, race] of Object.entries(faction.races)) {
      races.push({ factionId, factionName: faction.name, factionColor: faction.color, raceId, ...race });
    }
  }
  return races;
}

/** Get a specific race config */
export function getRace(factionId, raceId) {
  return FACTIONS[factionId]?.races?.[raceId] ?? null;
}
