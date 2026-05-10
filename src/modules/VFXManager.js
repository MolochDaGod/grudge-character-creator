/**
 * VFXManager — Animation-timed VFX system for Grudge Studio characters.
 *
 * Supports:
 *   - Playing VFX on animation START, at a NORMALIZED TIME (0-1), or on COMPLETE
 *   - Attaching VFX to a bone container (hand, weapon tip, chest, feet, etc.)
 *   - Loading GLTF/GLB effects from object storage
 *   - Three.js particle burst fallback when no asset is available
 *   - Auto-despawn after duration
 *
 * VFX Registry keys map to skill/action names from Controller.controller
 * (Melee Attack, Fireball, Bow Attack, etc.) — fill in URLs once decided.
 *
 * Object storage base: https://objects.grudge-studio.com  (or VITE_ASSET_BASE_URL)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_URL = import.meta.env.VITE_ASSET_BASE_URL || '/assets';

// ─── VFX Registry ────────────────────────────────────────────────────────────
// Map: actionKey → VFX config(s)
// timing: 'start' | 'complete' | number (0.0–1.0 normalized animation time)
// attach: bone key from EquipmentManager.bones, or 'position' for world pos
// type: 'gltf' | 'particle' | 'both'
// Populate url once you decide which object storage assets to use.
// ─────────────────────────────────────────────────────────────────────────────
export const VFX_REGISTRY = {
  // ── Warrior ──────────────────────────────────────────────────────────────
  'Melee Attack':     [{ timing: 0.3, attach: 'rightHand', type: 'particle', color: 0xffffff, scale: 0.8, url: null }],
  'Strong Hit':       [{ timing: 0.4, attach: 'rightHand', type: 'particle', color: 0xff4400, scale: 1.2, url: null }],
  'Whirl Wind':       [{ timing: 'start', attach: 'position', type: 'particle', color: 0x88aaff, scale: 2.0, url: null }],
  'Twohand Attack':   [{ timing: 0.35, attach: 'rightHand', type: 'particle', color: 0xffaa00, scale: 1.0, url: null }],
  'Shield Bash':      [{ timing: 0.4, attach: 'leftShield', type: 'particle', color: 0x00aaff, scale: 1.0, url: null }],
  'Cleave':           [{ timing: 0.3, attach: 'rightHand', type: 'particle', color: 0xff2200, scale: 1.5, url: null }],
  'Bash':             [{ timing: 0.35, attach: 'rightHand', type: 'particle', color: 0xffdd00, scale: 0.9, url: null }],
  'Concusive Blow':   [{ timing: 0.4, attach: 'rightHand', type: 'particle', color: 0xaaaaff, scale: 1.2, url: null }],
  'Warcry':           [{ timing: 'start', attach: 'position', type: 'particle', color: 0xff8800, scale: 3.0, url: null }],
  'Thrust':           [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0xffffff, scale: 0.7, url: null }],
  'Flank':            [{ timing: 0.4, attach: 'rightHand', type: 'particle', color: 0x00ffcc, scale: 0.8, url: null }],
  'Spear Attack':     [{ timing: 0.4, attach: 'rightHand', type: 'particle', color: 0x88ff88, scale: 1.0, url: null }],
  'Spear Throw':      [{ timing: 0.6, attach: 'rightHand', type: 'particle', color: 0x44ff44, scale: 1.2, url: null }],
  'Sprint':           [{ timing: 'start', attach: 'position', type: 'particle', color: 0xffffff, scale: 0.5, url: null }],

  // ── Ranger ───────────────────────────────────────────────────────────────
  'Bow Attack':       [{ timing: 0.5, attach: 'leftHand', type: 'particle', color: 0x88ff44, scale: 0.8, url: null }],
  'Volly':            [{ timing: 0.4, attach: 'leftHand', type: 'particle', color: 0x44ff88, scale: 1.5, url: null }],
  'Precise Shot':     [{ timing: 0.6, attach: 'leftHand', type: 'particle', color: 0xffff00, scale: 0.6, url: null }],
  'Stunning Shot':    [{ timing: 0.5, attach: 'leftHand', type: 'particle', color: 0x00ddff, scale: 0.8, url: null }],

  // ── Fire Magic ───────────────────────────────────────────────────────────
  'Fireball':         [{ timing: 0.6, attach: 'rightHand', type: 'particle', color: 0xff4400, scale: 1.5, url: null }],
  'Flame Strike':     [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0xff6600, scale: 1.2, url: null }],
  'Fire Nova':        [{ timing: 0.5, attach: 'position', type: 'particle', color: 0xff3300, scale: 3.0, url: null }],
  'Inferno':          [{ timing: 0.4, attach: 'position', type: 'particle', color: 0xff0000, scale: 4.0, url: null }],
  'Meteor Shower':    [{ timing: 0.7, attach: 'position', type: 'particle', color: 0xff5500, scale: 3.5, url: null }],

  // ── Ice Magic ────────────────────────────────────────────────────────────
  'Ice Bolt':         [{ timing: 0.6, attach: 'rightHand', type: 'particle', color: 0x88ddff, scale: 1.0, url: null }],
  'Freeze':           [{ timing: 0.5, attach: 'position', type: 'particle', color: 0xaaeeff, scale: 2.0, url: null }],
  'Hail Storm':       [{ timing: 0.4, attach: 'position', type: 'particle', color: 0xccf4ff, scale: 3.0, url: null }],
  'Frost Nova':       [{ timing: 0.5, attach: 'position', type: 'particle', color: 0x44ccff, scale: 3.5, url: null }],
  'Frost Armor':      [{ timing: 'start', attach: 'position', type: 'particle', color: 0x00aaff, scale: 2.0, url: null }],

  // ── Nature Magic ─────────────────────────────────────────────────────────
  'Nature Bolt':      [{ timing: 0.6, attach: 'rightHand', type: 'particle', color: 0x44ff44, scale: 1.0, url: null }],
  'Stone Spikes':     [{ timing: 0.5, attach: 'position', type: 'particle', color: 0xaa8844, scale: 2.0, url: null }],
  'Natures Touch':    [{ timing: 0.4, attach: 'position', type: 'particle', color: 0x00ff88, scale: 1.5, url: null }],
  'Stone Rain':       [{ timing: 0.5, attach: 'position', type: 'particle', color: 0x998866, scale: 3.0, url: null }],
  'Roots':            [{ timing: 0.5, attach: 'position', type: 'particle', color: 0x336622, scale: 1.8, url: null }],

  // ── Lightning Magic ──────────────────────────────────────────────────────
  'Shock':            [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0xffff00, scale: 1.0, url: null }],
  'Static Charge':    [{ timing: 'start', attach: 'position', type: 'particle', color: 0xffffaa, scale: 1.5, url: null }],
  'Storm':            [{ timing: 0.4, attach: 'position', type: 'particle', color: 0x8888ff, scale: 4.0, url: null }],
  'Lightning Strike': [{ timing: 0.6, attach: 'position', type: 'particle', color: 0xeeeeff, scale: 2.5, url: null }],
  'Tornado':          [{ timing: 0.3, attach: 'position', type: 'particle', color: 0xaaaaff, scale: 3.0, url: null }],

  // ── Holy Magic ───────────────────────────────────────────────────────────
  'Smite':            [{ timing: 0.6, attach: 'rightHand', type: 'particle', color: 0xffffdd, scale: 1.2, url: null }],
  'Healing Light':    [{ timing: 0.5, attach: 'position', type: 'particle', color: 0xffff88, scale: 2.0, url: null }],
  'Holy Shield':      [{ timing: 'start', attach: 'position', type: 'particle', color: 0xffffff, scale: 2.5, url: null }],
  'Holy Nova':        [{ timing: 0.5, attach: 'position', type: 'particle', color: 0xffeeaa, scale: 3.5, url: null }],
  'Resurrect':        [{ timing: 0.7, attach: 'position', type: 'particle', color: 0xffffff, scale: 2.0, url: null }],
  'Divine Justice':   [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0xffdd44, scale: 1.8, url: null }],

  // ── Harvesting ───────────────────────────────────────────────────────────
  'HARVESTING':       [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0x88ff88, scale: 0.5, url: null }],
  'WOODCUTTING':      [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0x886644, scale: 0.6, url: null }],
  'MINING':           [{ timing: 0.5, attach: 'rightHand', type: 'particle', color: 0x888888, scale: 0.6, url: null }],
  'FISHING':          [{ timing: 0.7, attach: 'rightHand', type: 'particle', color: 0x4488ff, scale: 0.4, url: null }],
};

// ─────────────────────────────────────────────────────────────────────────────

export class VFXManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{ rightHand, leftHand, leftShield, ... }} bones  from EquipmentManager.bones
   */
  constructor(scene, bones = {}) {
    this.scene = scene;
    this.bones = bones;
    this._gltfLoader = new GLTFLoader();
    /** Cache loaded GLTF scenes by URL */
    this._cache = new Map();
    /** Active VFX instances for update loop */
    this._active = [];
    /** Pending normalized-time watchers: { action, normalizedTime, vfxConfigs, position, fired } */
    this._watchers = [];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Update loop — call every frame with delta.
   * Drives normalized-time watchers.
   * @param {number} delta  seconds
   */
  update(delta) {
    // Tick active VFX lifetimes
    for (let i = this._active.length - 1; i >= 0; i--) {
      const vfx = this._active[i];
      vfx.life -= delta;
      if (vfx.life <= 0) {
        if (vfx.object.parent) vfx.object.parent.remove(vfx.object);
        this._active.splice(i, 1);
      }
    }

    // Check normalized-time watchers
    for (const w of this._watchers) {
      if (w.fired || !w.action.isRunning()) continue;
      const t = w.action.time / (w.action.getClip().duration || 1);
      if (t >= w.normalizedTime) {
        w.fired = true;
        this._spawnConfigs(w.vfxConfigs, w.position);
      }
    }
    // Purge finished watchers
    this._watchers = this._watchers.filter(w => w.action.isRunning() || !w.fired === false);
  }

  /**
   * Play all VFX registered for an action key.
   * Handles timing internally (start / normalizedTime / complete).
   *
   * @param {string} actionKey        e.g. 'Fireball', 'Melee Attack'
   * @param {THREE.AnimationMixer} mixer
   * @param {THREE.AnimationAction} action
   * @param {THREE.Vector3} [position]  world position (defaults to character root)
   */
  playForAction(actionKey, mixer, action, position = new THREE.Vector3()) {
    const configs = VFX_REGISTRY[actionKey];
    if (!configs?.length) return;

    const startConfigs   = configs.filter(c => c.timing === 'start');
    const completeConfigs = configs.filter(c => c.timing === 'complete');
    const timedConfigs   = configs.filter(c => typeof c.timing === 'number');

    if (startConfigs.length)    this._spawnConfigs(startConfigs, position);
    if (completeConfigs.length) this._onActionComplete(mixer, action, completeConfigs, position);
    if (timedConfigs.length)    this._watchNormalizedTime(action, timedConfigs, position);
  }

  /**
   * Spawn a VFX immediately at position.
   * @param {string} actionKey
   * @param {THREE.Vector3} position
   */
  playAt(actionKey, position) {
    const configs = VFX_REGISTRY[actionKey];
    if (configs) this._spawnConfigs(configs, position);
  }

  /**
   * Update bone refs (call after new model loads).
   * @param {{ rightHand, leftHand, leftShield }} bones
   */
  setBones(bones) {
    this.bones = bones;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /** @private */
  _getBonePosition(boneKey, fallback) {
    const bone = this.bones[boneKey];
    if (bone) {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      return pos;
    }
    return fallback?.clone() ?? new THREE.Vector3();
  }

  /** @private */
  _spawnConfigs(configs, defaultPosition) {
    for (const cfg of configs) {
      const pos = cfg.attach === 'position'
        ? defaultPosition.clone()
        : this._getBonePosition(cfg.attach, defaultPosition);

      if (cfg.url) {
        this._spawnGLTF(cfg, pos);
      } else {
        this._spawnParticle(cfg, pos);
      }
    }
  }

  /** @private — Three.js particle burst fallback */
  _spawnParticle(cfg, position) {
    const count = 24;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 4,
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: cfg.color ?? 0xffffff,
      size: 0.12 * (cfg.scale ?? 1),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    const life = 0.8;
    const vfxEntry = { object: points, life };
    this._active.push(vfxEntry);

    // Animate manually via requestAnimationFrame to keep particles moving
    const posArr = geo.attributes.position.array;
    let elapsed = 0;
    const tick = (dt) => {
      elapsed += dt;
      for (let i = 0; i < count; i++) {
        posArr[i * 3]     += velocities[i].x * dt;
        posArr[i * 3 + 1] += velocities[i].y * dt;
        posArr[i * 3 + 2] += velocities[i].z * dt;
        velocities[i].y   -= 6 * dt; // gravity
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - elapsed / life);
    };
    vfxEntry.tick = tick;
  }

  /** @private — Load + spawn GLTF effect from object storage */
  async _spawnGLTF(cfg, position) {
    try {
      let gltfScene;
      if (this._cache.has(cfg.url)) {
        gltfScene = this._cache.get(cfg.url).clone();
      } else {
        const gltf = await this._gltfLoader.loadAsync(cfg.url);
        this._cache.set(cfg.url, gltf.scene);
        gltfScene = gltf.scene.clone();
      }

      gltfScene.position.copy(position);
      if (cfg.scale) gltfScene.scale.setScalar(cfg.scale);
      this.scene.add(gltfScene);

      const duration = cfg.duration ?? 1.5;
      this._active.push({ object: gltfScene, life: duration });
    } catch (err) {
      console.warn(`[VFX] Failed to load ${cfg.url} — falling back to particle`, err);
      this._spawnParticle(cfg, position);
    }
  }

  /** @private — Watch for normalized time threshold on a running action */
  _watchNormalizedTime(action, timedConfigs, position) {
    // Group configs by timing value
    const byTime = {};
    for (const cfg of timedConfigs) {
      (byTime[cfg.timing] ??= []).push(cfg);
    }
    for (const [t, cfgs] of Object.entries(byTime)) {
      this._watchers.push({
        action,
        normalizedTime: parseFloat(t),
        vfxConfigs: cfgs,
        position: position.clone(),
        fired: false,
      });
    }
  }

  /** @private — Fire VFX when an action reaches its end */
  _onActionComplete(mixer, action, configs, position) {
    const handler = (e) => {
      if (e.action === action) {
        this._spawnConfigs(configs, position);
        mixer.removeEventListener('finished', handler);
      }
    };
    mixer.addEventListener('finished', handler);
  }
}
