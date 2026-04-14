/**
 * WeaponAnimController — Manages weapon-specific animation packs
 * and a combat state machine triggered by hotkeys.
 *
 * States: idle → draw → equipped → attack/block/dodge → sheath → idle
 */

import { WEAPON_ANIM_MAP, COMBAT_ACTIONS } from './GameData.js';

export class WeaponAnimController {
  /**
   * @param {THREE.AnimationMixer} mixer
   * @param {FBXLoader} fbxLoader
   * @param {(msg: string) => void} statusFn
   */
  constructor(mixer, fbxLoader, statusFn) {
    this.mixer = mixer;
    this.loader = fbxLoader;
    this.status = statusFn || (() => {});

    /** Currently equipped weapon type key (e.g. 'sword', 'bow') */
    this.equippedWeaponType = null;
    /** Current animation pack id */
    this.currentPackId = null;
    /** Loaded actions keyed by filename */
    this.actions = {};
    /** Current playing action */
    this.currentAction = null;

    /** Combat state: idle | draw | equipped | attacking | blocking | dodging | sheath */
    this.state = 'idle';
    /** Combat mode vs harvest mode */
    this.mode = 'combat';

    /** Callbacks on state change */
    this._changeCallbacks = [];
  }

  /**
   * Register a callback for when weapon/state changes.
   * @param {() => void} fn
   */
  onChange(fn) {
    this._changeCallbacks.push(fn);
  }

  /** @private */
  _notify() {
    this._changeCallbacks.forEach(fn => fn());
  }

  // ── Equip / Sheath ────────────────────────────────────────

  /**
   * Equip a weapon — loads its animation pack and plays the draw animation.
   * @param {string} weaponType - key from WEAPON_ANIM_MAP (e.g. 'sword')
   * @param {object} animPacks - WEAPON_ANIMATION_PACKS registry
   * @param {THREE.Object3D} model - the character model
   */
  async equipWeapon(weaponType, animPacks, model) {
    const mapping = WEAPON_ANIM_MAP[weaponType];
    if (!mapping) {
      this.status(`No anim mapping for weapon: ${weaponType}`);
      return;
    }

    const pack = animPacks[mapping.animPack];
    if (!pack) {
      this.status(`Animation pack not found: ${mapping.animPack}`);
      return;
    }

    this.equippedWeaponType = weaponType;
    this.currentPackId = mapping.animPack;
    this.state = 'equipped';

    // Load draw animation if available
    if (mapping.drawAnim) {
      await this._loadAndPlay(pack.path + mapping.drawAnim, model, 'draw');
    }

    // Load idle anim
    if (mapping.idleAnim) {
      await this._loadAndPlay(pack.path + mapping.idleAnim, model, 'idle');
    }

    this.status(`Equipped: ${weaponType} (${mapping.animPack})`);
    this._notify();
  }

  /**
   * Sheath the current weapon — plays sheath animation and returns to idle.
   */
  sheathWeapon() {
    if (!this.equippedWeaponType) return;

    const mapping = WEAPON_ANIM_MAP[this.equippedWeaponType];
    if (mapping?.sheathAnim && this.actions[mapping.sheathAnim]) {
      this._playAction(mapping.sheathAnim, 0.2);
    }

    this.equippedWeaponType = null;
    this.currentPackId = null;
    this.state = 'idle';
    this._notify();
  }

  // ── Combat Actions ────────────────────────────────────────

  /**
   * Trigger a combat action by slot name.
   * @param {string} slotKey - e.g. 'slot1', 'slot2', 'block', 'dodge'
   */
  triggerAction(slotKey) {
    if (!this.currentPackId || this.state === 'idle') return;

    const actions = COMBAT_ACTIONS[this.currentPackId];
    if (!actions || !actions[slotKey]) return;

    const action = actions[slotKey];
    this.state = slotKey === 'block' ? 'blocking' : slotKey === 'dodge' ? 'dodging' : 'attacking';

    this._loadAndPlayFromPack(action.file);
    this.status(`${action.name}`);
    this._notify();
  }

  /**
   * Release block — return to equipped idle.
   */
  releaseBlock() {
    if (this.state !== 'blocking') return;
    this.state = 'equipped';

    const mapping = WEAPON_ANIM_MAP[this.equippedWeaponType];
    if (mapping?.idleAnim && this.actions[mapping.idleAnim]) {
      this._playAction(mapping.idleAnim, 0.15);
    }
    this._notify();
  }

  /**
   * Toggle between combat and harvest mode.
   */
  toggleMode() {
    this.mode = this.mode === 'combat' ? 'harvest' : 'combat';
    this.status(`Mode: ${this.mode}`);
    this._notify();
  }

  // ── Hotbar ────────────────────────────────────────────────

  /**
   * Get the hotbar layout for the current weapon.
   * @returns {object|null} { slot1, slot2, slot3, slot4, block, dodge }
   */
  getHotbar() {
    if (!this.currentPackId) return null;
    return COMBAT_ACTIONS[this.currentPackId] || null;
  }

  // ── Animation Loading ─────────────────────────────────────

  /** @private */
  async _loadAndPlay(url, model, label) {
    try {
      const fbx = await new Promise((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });

      if (fbx.animations?.length > 0) {
        const clip = fbx.animations[0];
        const name = url.split('/').pop();
        clip.name = name;

        const action = this.mixer.clipAction(clip, model);
        this.actions[name] = action;
        this._playAction(name, 0.2);
      }
    } catch (err) {
      this.status(`Anim load failed: ${err.message}`);
    }
  }

  /** @private */
  async _loadAndPlayFromPack(fileName) {
    if (!this.currentPackId) return;

    // Check if already loaded
    if (this.actions[fileName]) {
      this._playAction(fileName, 0.15);
      return;
    }

    // Need to load — requires knowing the pack path
    // The pack path should have been used during equipWeapon
    // For now, just play if cached
    this.status(`Action: ${fileName}`);
  }

  /** @private */
  _playAction(name, fadeDuration = 0.2) {
    const next = this.actions[name];
    if (!next) return;

    next.reset().play();
    next.timeScale = 1;

    if (this.currentAction && this.currentAction !== next) {
      this.currentAction.crossFadeTo(next, fadeDuration, false);
    }
    this.currentAction = next;
  }
}
