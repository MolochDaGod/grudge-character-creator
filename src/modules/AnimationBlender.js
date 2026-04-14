/**
 * AnimationBlender — Advanced animation mixing for characters and AI.
 *
 * Patterns from threejs-skills/threejs-animation:
 * - Weight-based locomotion blending (idle → walk → run)
 * - Additive animation layers (breathing, injured)
 * - Subclip extraction from single-take FBX
 * - Smooth crossfade transitions
 */

import * as THREE from 'three';

export class AnimationBlender {
  /**
   * @param {THREE.AnimationMixer} mixer
   * @param {THREE.Object3D} root - the model the mixer is bound to
   */
  constructor(mixer, root) {
    this.mixer = mixer;
    this.root = root;

    /** @type {Map<string, THREE.AnimationAction>} all registered actions */
    this.actions = new Map();

    // ── Locomotion blend layer ──
    /** @type {THREE.AnimationAction|null} */ this.idleAction = null;
    /** @type {THREE.AnimationAction|null} */ this.walkAction = null;
    /** @type {THREE.AnimationAction|null} */ this.runAction = null;
    this._locomotionSpeed = 0;

    // ── Additive layers ──
    /** @type {Map<string, THREE.AnimationAction>} additive overlay actions */
    this.additiveLayers = new Map();

    // ── Current one-shot ──
    /** @type {THREE.AnimationAction|null} */
    this.currentOneShot = null;

    // Listen for finished events to return to idle
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.currentOneShot) {
        this.currentOneShot = null;
        this._applyLocomotionWeights();
      }
    });
  }

  // ── Registration ──────────────────────────────────────────

  /**
   * Register an AnimationClip and return its action.
   * @param {string} name
   * @param {THREE.AnimationClip} clip
   * @param {object} [opts]
   * @param {boolean} [opts.loop=true]
   * @param {boolean} [opts.clampWhenFinished=false]
   * @returns {THREE.AnimationAction}
   */
  register(name, clip, opts = {}) {
    clip.name = name;
    const action = this.mixer.clipAction(clip, this.root);

    if (opts.loop === false) {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = opts.clampWhenFinished ?? true;
    }

    this.actions.set(name, action);
    return action;
  }

  /**
   * Register multiple clips from an array (e.g. from GLTF animations).
   * @param {THREE.AnimationClip[]} clips
   */
  registerAll(clips) {
    for (const clip of clips) {
      this.register(clip.name, clip);
    }
  }

  // ── Locomotion Blend Layer ────────────────────────────────

  /**
   * Set the three locomotion animations. All three will play simultaneously
   * with weights controlled by setLocomotionSpeed().
   *
   * @param {string} idleName
   * @param {string} walkName
   * @param {string} runName
   */
  setupLocomotion(idleName, walkName, runName) {
    this.idleAction = this.actions.get(idleName) || null;
    this.walkAction = this.actions.get(walkName) || null;
    this.runAction = this.actions.get(runName) || null;

    // Start all three playing with correct initial weights
    [this.idleAction, this.walkAction, this.runAction].forEach(a => {
      if (a) {
        a.play();
        a.setEffectiveWeight(0);
      }
    });
    if (this.idleAction) this.idleAction.setEffectiveWeight(1);
  }

  /**
   * Blend locomotion based on speed (0 = idle, ~3 = walk, ~7+ = run).
   * @param {number} speed - character movement speed
   */
  setLocomotionSpeed(speed) {
    this._locomotionSpeed = speed;
    if (this.currentOneShot) return; // One-shot overrides locomotion
    this._applyLocomotionWeights();
  }

  /** @private */
  _applyLocomotionWeights() {
    const speed = this._locomotionSpeed;
    let idleW = 0, walkW = 0, runW = 0;

    if (speed < 0.1) {
      idleW = 1;
    } else if (speed < 5) {
      const t = speed / 5;
      idleW = 1 - t;
      walkW = t;
    } else {
      const t = Math.min((speed - 5) / 5, 1);
      walkW = 1 - t;
      runW = t;
    }

    if (this.idleAction) this.idleAction.setEffectiveWeight(idleW);
    if (this.walkAction) this.walkAction.setEffectiveWeight(walkW);
    if (this.runAction) this.runAction.setEffectiveWeight(runW);
  }

  // ── Crossfade / One-Shot ──────────────────────────────────

  /**
   * Crossfade to a named action. If the action is non-looping, it will
   * automatically return to locomotion blend when finished.
   *
   * @param {string} name
   * @param {number} [fadeDuration=0.25]
   * @returns {THREE.AnimationAction|null}
   */
  crossFadeTo(name, fadeDuration = 0.25) {
    const next = this.actions.get(name);
    if (!next) return null;

    next.reset();
    next.setEffectiveWeight(1);
    next.play();

    // Fade out current one-shot or locomotion
    if (this.currentOneShot && this.currentOneShot !== next) {
      this.currentOneShot.crossFadeTo(next, fadeDuration, false);
    } else {
      // Fade out locomotion
      [this.idleAction, this.walkAction, this.runAction].forEach(a => {
        if (a) a.crossFadeTo(next, fadeDuration, false);
      });
    }

    if (next.loop === THREE.LoopOnce) {
      this.currentOneShot = next;
    } else {
      this.currentOneShot = null;
    }

    return next;
  }

  /**
   * Play an action immediately (reset + play). Good for combat attacks.
   * @param {string} name
   * @param {number} [fadeDuration=0.15]
   */
  playOnce(name, fadeDuration = 0.15) {
    const action = this.actions.get(name);
    if (!action) return null;

    // Ensure it's configured as one-shot
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;

    return this.crossFadeTo(name, fadeDuration);
  }

  // ── Additive Layers ───────────────────────────────────────

  /**
   * Add an additive animation layer (e.g. breathing, injured, hit react).
   * Additive animations blend ON TOP of the base pose.
   *
   * @param {string} name
   * @param {THREE.AnimationClip} clip
   * @param {number} [weight=1]
   */
  addAdditiveLayer(name, clip, weight = 1) {
    THREE.AnimationUtils.makeClipAdditive(clip);
    const action = this.mixer.clipAction(clip, this.root);
    action.blendMode = THREE.AdditiveAnimationBlendMode;
    action.setEffectiveWeight(weight);
    action.play();
    this.additiveLayers.set(name, action);
    return action;
  }

  /**
   * Adjust weight of an additive layer.
   * @param {string} name
   * @param {number} weight
   */
  setAdditiveWeight(name, weight) {
    const action = this.additiveLayers.get(name);
    if (action) action.setEffectiveWeight(weight);
  }

  /**
   * Remove an additive layer.
   * @param {string} name
   */
  removeAdditiveLayer(name) {
    const action = this.additiveLayers.get(name);
    if (action) {
      action.stop();
      this.additiveLayers.delete(name);
    }
  }

  // ── Subclip Extraction ────────────────────────────────────

  /**
   * Extract a sub-clip from a single-take animation by frame range.
   * Useful for splitting merged FBX timelines (e.g. Ren staff/spear pack).
   *
   * @param {THREE.AnimationClip} sourceClip
   * @param {string} name - name for the new clip
   * @param {number} startFrame
   * @param {number} endFrame
   * @param {number} [fps=30]
   * @returns {THREE.AnimationClip}
   */
  static subclip(sourceClip, name, startFrame, endFrame, fps = 30) {
    return THREE.AnimationUtils.subclip(sourceClip, name, startFrame, endFrame, fps);
  }

  // ── Utilities ─────────────────────────────────────────────

  /** Get all registered action names. */
  get actionNames() {
    return [...this.actions.keys()];
  }

  /** Stop all actions and reset. */
  stopAll() {
    this.mixer.stopAllAction();
    this.currentOneShot = null;
  }

  /** Dispose and clean up. */
  dispose() {
    this.stopAll();
    this.actions.clear();
    this.additiveLayers.clear();
  }
}
