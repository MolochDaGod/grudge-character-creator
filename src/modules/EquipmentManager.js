/**
 * EquipmentManager
 *
 * Loads a faction character FBX, auto-discovers all child meshes,
 * classifies them into equipment slots, and provides toggle/equip API.
 *
 * Usage:
 *   const em = new EquipmentManager(prefix);   // e.g. 'WK_'
 *   em.catalog(fbxScene);                       // after FBXLoader loads
 *   em.equip('body', 'A');                      // show Body_A, hide others
 *   em.equipWeapon('sword', 'A');               // show sword_A in R_hand
 *   em.getSlots();                              // { body: ['A','B',...], ... }
 */

// Slot categories and the regex to match mesh names (after prefix strip)
const SLOT_DEFS = [
  // Armor slots — skinned meshes at root
  { slot: 'body',       re: /^Units_Body_([A-Z])$/i,           group: 'armor' },
  { slot: 'arms',       re: /^Units_Arms_([A-Z])$/i,           group: 'armor' },
  { slot: 'legs',       re: /^Units_Legs_([A-Z])$/i,           group: 'armor' },
  { slot: 'head',       re: /^Units_head_([A-Z])$/i,           group: 'armor' },
  { slot: 'shoulders',  re: /^Units_shoulderpads_([A-Z])$/i,   group: 'armor' },

  // Right-hand weapons (inside R_hand_container or named directly)
  { slot: 'axe',    re: /(?:Units_|weapon_)axe_([A-Z])$/i,     group: 'weapon_r' },
  { slot: 'hammer', re: /(?:Units_|weapon_)hammer_([A-Z])$/i,  group: 'weapon_r' },
  { slot: 'sword',  re: /(?:Units_|weapon_)[Ss]word_([A-Z])$/i,group: 'weapon_r' },
  { slot: 'pick',   re: /(?:Units_|weapon_)pick$/i,            group: 'weapon_r', noVariant: true },
  { slot: 'spear',  re: /(?:Units_|weapon_)[Ss]pear$/i,        group: 'weapon_r', noVariant: true },

  // Left-hand items (inside L_hand_container)
  { slot: 'bow',    re: /(?:Units_|weapon_)[Bb]ow$/i,          group: 'weapon_l', noVariant: true },
  { slot: 'staff',  re: /(?:Units_|weapon_)staff_([A-Z])$/i,   group: 'weapon_l' },

  // Shields (inside L_shield_container)
  { slot: 'shield', re: /(?:Units_|)[Ss]hield_([A-Z])$/i,      group: 'shield' },

  // Utility
  { slot: 'bag',    re: /(?:Xtra_|Units_)bag$/i,               group: 'utility', noVariant: true },
  { slot: 'wood',   re: /(?:Xtra_|Units_)wood$/i,              group: 'utility', noVariant: true },
  { slot: 'quiver', re: /(?:Xtra_|Units_)quiver$/i,            group: 'utility', noVariant: true },
];

export class EquipmentManager {
  /**
   * @param {string} prefix  Race prefix e.g. 'WK_', 'ORC_', 'ELF_'
   */
  constructor(prefix) {
    this.prefix = prefix;
    // slot -> { variant -> Object3D }
    this.slots = {};
    // Currently equipped: slot -> variant|true
    this.equipped = {};
    // Flat list of all cataloged meshes for bulk ops
    this._allMeshes = [];
    // Skeleton bones for weapon attachment
    this.bones = {};
  }

  /**
   * Scan the loaded FBX scene graph and catalog every child mesh into slots.
   * @param {THREE.Group} root  The loaded FBX scene
   */
  catalog(root) {
    this.root = root;
    this.slots = {};
    this._allMeshes = [];

    // Find bone containers
    this.bones.rightHand  = root.getObjectByName('R_hand_container')  ?? null;
    this.bones.leftHand   = root.getObjectByName('L_hand_container')  ?? null;
    this.bones.leftShield = root.getObjectByName('L_shield_container') ?? null;
    this.bones.bag        = root.getObjectByName('Bone_bag')          ?? null;
    this.bones.wood       = root.getObjectByName('Bone_wood')         ?? null;
    this.bones.quiver     = root.getObjectByName('Quiver_container')  ?? null;

    root.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return;

      const name = child.name;
      // Strip the race prefix to get the generic slot name
      const stripped = name.startsWith(this.prefix)
        ? name.slice(this.prefix.length)
        : name;

      for (const def of SLOT_DEFS) {
        const match = stripped.match(def.re);
        if (!match) continue;

        const variant = def.noVariant ? '_default' : (match[1] || match[2] || '_default').toUpperCase();

        if (!this.slots[def.slot]) {
          this.slots[def.slot] = {};
        }
        this.slots[def.slot][variant] = child;
        child.userData.equipSlot = def.slot;
        child.userData.equipVariant = variant;
        child.userData.equipGroup = def.group;
        this._allMeshes.push(child);

        // Hide everything initially
        child.visible = false;
        break;
      }
    });

    // Default equip: show first variant of body/legs/head
    this._autoEquipDefaults();

    return this.getSlotSummary();
  }

  /** Auto-equip variant A of armor slots so the character isn't invisible */
  _autoEquipDefaults() {
    for (const slot of ['body', 'arms', 'legs', 'head']) {
      const variants = this.slots[slot];
      if (!variants) continue;
      const first = Object.keys(variants).sort()[0];
      if (first) this.equip(slot, first);
    }
  }

  /**
   * Equip a specific variant of a slot (hides others in same slot).
   * @param {string} slot     e.g. 'body', 'sword', 'shield'
   * @param {string} variant  e.g. 'A', 'B', '_default'
   */
  equip(slot, variant) {
    const variants = this.slots[slot];
    if (!variants) return false;

    // Hide all variants in this slot
    for (const [v, mesh] of Object.entries(variants)) {
      mesh.visible = (v === variant);
    }
    this.equipped[slot] = variant;
    return true;
  }

  /**
   * Unequip a slot (hide all variants).
   */
  unequip(slot) {
    const variants = this.slots[slot];
    if (!variants) return;
    for (const mesh of Object.values(variants)) {
      mesh.visible = false;
    }
    delete this.equipped[slot];
  }

  /**
   * Toggle a slot on/off.
   */
  toggle(slot, variant) {
    if (this.equipped[slot] === variant) {
      this.unequip(slot);
    } else {
      this.equip(slot, variant);
    }
  }

  /**
   * Hide all weapons (right hand, left hand, shield).
   */
  unequipAllWeapons() {
    for (const mesh of this._allMeshes) {
      if (['weapon_r', 'weapon_l', 'shield'].includes(mesh.userData.equipGroup)) {
        mesh.visible = false;
      }
    }
    for (const slot of ['axe', 'hammer', 'sword', 'pick', 'spear', 'bow', 'staff', 'shield']) {
      delete this.equipped[slot];
    }
  }

  /**
   * Equip a weapon by slot, auto-hiding conflicting slots.
   * Right-hand weapons are mutually exclusive. Same for left-hand.
   */
  equipWeapon(slot, variant = '_default') {
    const def = SLOT_DEFS.find(d => d.slot === slot);
    if (!def) return false;

    // Hide all same-group weapons first
    for (const mesh of this._allMeshes) {
      if (mesh.userData.equipGroup === def.group) {
        mesh.visible = false;
        delete this.equipped[mesh.userData.equipSlot];
      }
    }

    return this.equip(slot, variant);
  }

  /**
   * Get summary of all discovered slots and their variants.
   * @returns {Object} { slot: [variant, variant, ...], ... }
   */
  getSlotSummary() {
    const summary = {};
    for (const [slot, variants] of Object.entries(this.slots)) {
      summary[slot] = Object.keys(variants).sort();
    }
    return summary;
  }

  /**
   * Get all available slots grouped for UI.
   */
  getGroupedSlots() {
    const groups = { armor: {}, weapons: {}, shields: {}, utility: {} };
    for (const [slot, variants] of Object.entries(this.slots)) {
      const def = SLOT_DEFS.find(d => d.slot === slot);
      if (!def) continue;
      const groupKey = def.group === 'weapon_r' || def.group === 'weapon_l'
        ? 'weapons' : def.group === 'shield' ? 'shields' : def.group;
      groups[groupKey][slot] = {
        variants: Object.keys(variants).sort(),
        equipped: this.equipped[slot] ?? null,
      };
    }
    return groups;
  }

  /**
   * Show all meshes (debug mode).
   */
  showAll() {
    for (const mesh of this._allMeshes) {
      mesh.visible = true;
    }
  }

  /**
   * Hide all meshes.
   */
  hideAll() {
    for (const mesh of this._allMeshes) {
      mesh.visible = false;
    }
  }

  /** Total count of cataloged equipment meshes */
  get meshCount() {
    return this._allMeshes.length;
  }

  // ── External Weapon Model Loading ───────────────────────────

  /**
   * Load an external weapon FBX and attach it to a bone container.
   * @param {FBXLoader} loader - Three.js FBXLoader instance
   * @param {string} url - URL to the weapon FBX file
   * @param {string} boneKey - 'rightHand', 'leftHand', or 'leftShield'
   * @param {Object} [opts] - { scale, offset, rotation }
   * @returns {Promise<THREE.Object3D>} The attached weapon mesh
   */
  async loadExternalWeapon(loader, url, boneKey = 'rightHand', opts = {}) {
    const bone = this.bones[boneKey];
    if (!bone) {
      console.warn(`Bone container '${boneKey}' not found`);
      return null;
    }

    // Remove previous external weapon on this bone
    if (this._externalWeapons?.[boneKey]) {
      bone.remove(this._externalWeapons[boneKey]);
    }
    if (!this._externalWeapons) this._externalWeapons = {};

    try {
      const fbx = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      // Scale to reasonable weapon size
      const scale = opts.scale || 0.01; // FBX models often need scaling
      fbx.scale.setScalar(scale);

      // Apply optional offset and rotation
      if (opts.offset) fbx.position.set(opts.offset.x || 0, opts.offset.y || 0, opts.offset.z || 0);
      if (opts.rotation) fbx.rotation.set(opts.rotation.x || 0, opts.rotation.y || 0, opts.rotation.z || 0);

      // Enable shadows
      fbx.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      bone.add(fbx);
      this._externalWeapons[boneKey] = fbx;
      return fbx;
    } catch (err) {
      console.error(`Failed to load external weapon: ${url}`, err);
      return null;
    }
  }

  /**
   * Remove all external weapons from bone containers.
   */
  removeAllExternalWeapons() {
    if (!this._externalWeapons) return;
    for (const [boneKey, mesh] of Object.entries(this._externalWeapons)) {
      const bone = this.bones[boneKey];
      if (bone && mesh) bone.remove(mesh);
    }
    this._externalWeapons = {};
  }
}
