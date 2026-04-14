/**
 * WeaponAnimController
 *
 * Connects equipped weapons to their animation packs and manages the
 * combat state machine: idle → draw → combat_idle → attack/block/dodge → sheath
 *
 * Usage:
 *   const ctrl = new WeaponAnimController(mixer, fbxLoader, updateStatus);
 *   await ctrl.equipWeapon('sword', WEAPON_ANIM_MAP, WEAPON_ANIMATION_PACKS);
 *   ctrl.triggerAction('slot1');  // plays attack animation
 *   ctrl.triggerAction('block');
 *   ctrl.setMode('harvest');     // switches to harvest mode (no combat anims)
 */

import { WEAPON_ANIM_MAP, COMBAT_ACTIONS } from './GameData.js';

// Combat states
const STATE = {
  IDLE: 'idle',
  DRAWING: 'drawing',
  COMBAT_IDLE: 'combat_idle',
  ATTACKING: 'attacking',
  BLOCKING: 'blocking',
  DODGING: 'dodging',
  SHEATHING: 'sheathing',
  DEAD: 'dead',
};

export class WeaponAnimController {
  /**
   * @param {THREE.AnimationMixer} mixer
   * @param {FBXLoader} fbxLoader
   * @param {Function} statusFn - updateStatus callback
   */
  constructor(mixer, fbxLoader, statusFn = () => {}) {
    this.mixer = mixer;
    this.loader = fbxLoader;
    this.statusFn = statusFn;

    // State
    this.state = STATE.IDLE;
    this.mode = 'combat';          // 'combat' or 'harvest'
    this.equippedWeaponType = null; // e.g. 'sword', 'bow', 'staff'
    this.activeAnimPack = null;     // animation pack ID
    this.activeActions = {};        // name → AnimationAction cache
    this.currentAction = null;
    this.combatActions = null;      // COMBAT_ACTIONS for current pack

    // Track the model root for retargeting
    this.modelRoot = null;

    // Listeners for state changes
    this._listeners = [];
  }

  /** Register a state change listener */
  onChange(fn) { this._listeners.push(fn); }
  _emit() { this._listeners.forEach(fn => fn(this.state, this.equippedWeaponType, this.mode)); }

  /**
   * Equip a weapon type — loads the matching animation pack and plays draw animation.
   * @param {string} weaponType - key from WEAPON_TYPES (e.g. 'sword', 'bow')
   * @param {Object} animPacks - WEAPON_ANIMATION_PACKS from FactionRegistry
   * @param {THREE.Object3D} model - the loaded character model (for retargeting)
   */
  async equipWeapon(weaponType, animPacks, model) {
    const mapping = WEAPON_ANIM_MAP[weaponType];
    if (!mapping) {
      this.statusFn(`No animation mapping for weapon: ${weaponType}`);
      return false;
    }

    this.equippedWeaponType = weaponType;
    this.activeAnimPack = mapping.animPack;
    this.modelRoot = model;
    this.combatActions = COMBAT_ACTIONS[mapping.animPack] || null;

    const pack = animPacks[mapping.animPack];
    if (!pack) {
      this.statusFn(`Animation pack not found: ${mapping.animPack}`);
      return false;
    }

    this.statusFn(`Loading ${pack.name} animations...`);

    // Preload key animations: idle, draw, run, and all 4 combat slots
    const toLoad = [mapping.idleAnim];
    if (mapping.drawAnim) toLoad.push(mapping.drawAnim);
    if (mapping.sheathAnim) toLoad.push(mapping.sheathAnim);
    if (this.combatActions) {
      for (const key of ['slot1', 'slot2', 'slot3', 'slot4', 'block', 'dodge', 'run', 'death']) {
        const action = this.combatActions[key];
        if (action?.file && !toLoad.includes(action.file)) toLoad.push(action.file);
      }
    }

    // Load all in parallel
    const loadPromises = toLoad.map(file => this._loadAnim(pack.path, file));
    await Promise.allSettled(loadPromises);

    // Play draw animation if available, otherwise go straight to combat idle
    if (mapping.drawAnim && this.activeActions[mapping.drawAnim]) {
      this.state = STATE.DRAWING;
      this._playOnce(mapping.drawAnim, () => {
        this.state = STATE.COMBAT_IDLE;
        this._playLoop(mapping.idleAnim);
        this._emit();
      });
    } else {
      this.state = STATE.COMBAT_IDLE;
      this._playLoop(mapping.idleAnim);
    }

    this.statusFn(`Equipped: ${weaponType} → ${pack.name}`);
    this._emit();
    return true;
  }

  /**
   * Trigger a combat action by slot name.
   * @param {'slot1'|'slot2'|'slot3'|'slot4'|'block'|'dodge'} slot
   */
  triggerAction(slot) {
    if (this.mode !== 'combat') {
      this.statusFn('Switch to combat mode first (Tab)');
      return;
    }
    if (!this.combatActions) return;
    if (this.state === STATE.DEAD) return;

    const action = this.combatActions[slot];
    if (!action?.file) {
      this.statusFn(`No animation for ${slot}`);
      return;
    }

    if (!this.activeActions[action.file]) {
      this.statusFn(`Animation not loaded: ${action.file}`);
      return;
    }

    const mapping = WEAPON_ANIM_MAP[this.equippedWeaponType];

    if (slot === 'block') {
      this.state = STATE.BLOCKING;
      this._playLoop(action.file);
    } else if (slot === 'dodge') {
      this.state = STATE.DODGING;
      this._playOnce(action.file, () => {
        this.state = STATE.COMBAT_IDLE;
        this._playLoop(mapping.idleAnim);
        this._emit();
      });
    } else {
      // Attack slots (1-4): play once then return to combat idle
      this.state = STATE.ATTACKING;
      this._playOnce(action.file, () => {
        this.state = STATE.COMBAT_IDLE;
        this._playLoop(mapping.idleAnim);
        this._emit();
      });
    }

    this.statusFn(`${action.name}`);
    this._emit();
  }

  /** Release block — return to combat idle */
  releaseBlock() {
    if (this.state !== STATE.BLOCKING) return;
    const mapping = WEAPON_ANIM_MAP[this.equippedWeaponType];
    if (mapping) {
      this.state = STATE.COMBAT_IDLE;
      this._playLoop(mapping.idleAnim);
      this._emit();
    }
  }

  /** Sheath weapon — play sheath animation, return to base idle */
  async sheathWeapon() {
    const mapping = WEAPON_ANIM_MAP[this.equippedWeaponType];
    if (!mapping) return;

    if (mapping.sheathAnim && this.activeActions[mapping.sheathAnim]) {
      this.state = STATE.SHEATHING;
      this._playOnce(mapping.sheathAnim, () => {
        this.state = STATE.IDLE;
        this.equippedWeaponType = null;
        this.activeAnimPack = null;
        this.combatActions = null;
        this._emit();
      });
    } else {
      this.state = STATE.IDLE;
      this.equippedWeaponType = null;
      this.activeAnimPack = null;
      this.combatActions = null;
      this._emit();
    }
  }

  /** Toggle combat/harvest mode */
  setMode(mode) {
    this.mode = mode;
    this.statusFn(`Mode: ${mode.toUpperCase()}`);
    this._emit();
  }

  toggleMode() {
    this.setMode(this.mode === 'combat' ? 'harvest' : 'combat');
  }

  /** Kill — play death animation */
  triggerDeath() {
    if (!this.combatActions?.death?.file) return;
    this.state = STATE.DEAD;
    this._playOnce(this.combatActions.death.file);
    this._emit();
  }

  /** Get the hotbar display data for current weapon */
  getHotbar() {
    if (!this.combatActions) return null;
    return {
      slot1: this.combatActions.slot1,
      slot2: this.combatActions.slot2,
      slot3: this.combatActions.slot3,
      slot4: this.combatActions.slot4,
      block: this.combatActions.block,
      dodge: this.combatActions.dodge,
    };
  }

  // ── Internal animation helpers ──────────────────────────────

  async _loadAnim(basePath, fileName) {
    if (!fileName || this.activeActions[fileName]) return;
    try {
      const fbx = await new Promise((resolve, reject) => {
        this.loader.load(basePath + fileName, resolve, undefined, reject);
      });
      if (fbx.animations?.length > 0) {
        const clip = fbx.animations[0];
        clip.name = fileName;
        const action = this.mixer.clipAction(clip, this.modelRoot);
        this.activeActions[fileName] = action;
      }
    } catch (err) {
      console.warn(`Failed to load anim: ${fileName}`, err.message);
    }
  }

  _playLoop(fileName) {
    const action = this.activeActions[fileName];
    if (!action) return;
    action.reset().setLoop(2200, Infinity).play(); // THREE.LoopRepeat = 2200
    action.clampWhenFinished = false;
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.crossFadeTo(action, 0.2, false);
    }
    this.currentAction = action;
  }

  _playOnce(fileName, onComplete) {
    const action = this.activeActions[fileName];
    if (!action) { onComplete?.(); return; }
    action.reset().setLoop(2201, 1).play(); // THREE.LoopOnce = 2201
    action.clampWhenFinished = true;
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.crossFadeTo(action, 0.15, false);
    }
    this.currentAction = action;

    if (onComplete) {
      const onFinish = (e) => {
        if (e.action === action) {
          this.mixer.removeEventListener('finished', onFinish);
          onComplete();
        }
      };
      this.mixer.addEventListener('finished', onFinish);
    }
  }
}
