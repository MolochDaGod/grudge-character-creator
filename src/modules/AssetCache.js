/**
 * AssetCache — Centralized asset loading with caching, retry, and timeout.
 *
 * Patterns from threejs-skills/threejs-loaders:
 * - Map-based caching for FBX models and AnimationClips
 * - THREE.Cache.enabled for built-in texture/file caching
 * - Retry logic with exponential backoff
 * - Timeout support
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Enable Three.js built-in cache for textures and files
THREE.Cache.enabled = true;

class AssetCacheManager {
  constructor() {
    /** @type {Map<string, THREE.Group>} raw FBX scene graphs (cloned on retrieval) */
    this.models = new Map();
    /** @type {Map<string, THREE.AnimationClip[]>} parsed animation clips keyed by URL */
    this.clips = new Map();
    /** @type {Map<string, Promise>} in-flight loads to avoid duplicate requests */
    this.pending = new Map();
    /** @type {FBXLoader} shared loader instance */
    this.loader = new FBXLoader();
    /** @type {THREE.LoadingManager} */
    this.manager = new THREE.LoadingManager();

    this.manager.onProgress = (url, loaded, total) => {
      const pct = total > 0 ? Math.floor((loaded / total) * 100) : 0;
      this._onProgress?.(url, pct);
    };
    this.manager.onError = (url) => {
      console.error(`[AssetCache] Failed to load: ${url}`);
    };

    this.loader.manager = this.manager;
  }

  /**
   * Set a progress callback.
   * @param {(url: string, pct: number) => void} fn
   */
  onProgress(fn) {
    this._onProgress = fn;
  }

  // ── Core Loaders ─────────────────────────────────────────

  /**
   * Load an FBX model with caching. Returns a CLONE of the cached scene graph
   * so each caller gets an independent instance.
   *
   * @param {string} url
   * @param {object} [opts]
   * @param {number} [opts.maxRetries=2]
   * @param {number} [opts.timeout=30000]
   * @param {(e: ProgressEvent) => void} [opts.onProgress]
   * @returns {Promise<THREE.Group>}
   */
  async loadFBX(url, opts = {}) {
    // Return clone from cache
    if (this.models.has(url)) {
      return this._cloneModel(this.models.get(url));
    }
    // Deduplicate in-flight requests
    if (this.pending.has(url)) {
      await this.pending.get(url);
      return this._cloneModel(this.models.get(url));
    }

    const promise = this._loadWithRetry(url, opts);
    this.pending.set(url, promise);

    try {
      const fbx = await promise;
      this.models.set(url, fbx);
      // Also cache any embedded animations
      if (fbx.animations?.length > 0) {
        this.clips.set(url, fbx.animations);
      }
      return this._cloneModel(fbx);
    } finally {
      this.pending.delete(url);
    }
  }

  /**
   * Load an FBX file and return only its AnimationClips (cached).
   * Useful for loading animation-only FBX files to apply to another model.
   *
   * @param {string} url
   * @param {object} [opts]
   * @returns {Promise<THREE.AnimationClip[]>}
   */
  async loadAnimationClips(url, opts = {}) {
    if (this.clips.has(url)) {
      return this.clips.get(url);
    }
    // Load the full FBX (it will cache the model too)
    await this.loadFBX(url, opts);
    return this.clips.get(url) || [];
  }

  /**
   * Load an animation FBX and bind its first clip to a mixer on a target model.
   *
   * @param {string} url - animation FBX URL
   * @param {THREE.AnimationMixer} mixer
   * @param {THREE.Object3D} rootModel - the model the mixer is bound to
   * @param {object} [opts]
   * @returns {Promise<{clip: THREE.AnimationClip, action: THREE.AnimationAction}|null>}
   */
  async loadAndBindAnimation(url, mixer, rootModel, opts = {}) {
    const clips = await this.loadAnimationClips(url, opts);
    if (!clips || clips.length === 0) return null;

    const clip = clips[0];
    // Derive a clean name from filename
    const name = url.split('/').pop().replace(/\.(fbx|FBX)$/, '');
    clip.name = name;

    const action = mixer.clipAction(clip, rootModel);
    return { clip, action };
  }

  // ── Helpers ──────────────────────────────────────────────

  /** @private */
  _cloneModel(fbx) {
    const clone = fbx.clone(true);
    // Clone materials so instances are independent
    clone.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else if (child.material) {
          child.material = child.material.clone();
        }
      }
    });
    // Copy animations reference
    clone.animations = fbx.animations;
    return clone;
  }

  /**
   * Load with retry + timeout.
   * @private
   */
  async _loadWithRetry(url, { maxRetries = 2, timeout = 30000, onProgress } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._loadSingle(url, timeout, onProgress);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          console.warn(`[AssetCache] Retry ${attempt + 1}/${maxRetries} for ${url}`);
        }
      }
    }
    throw lastError;
  }

  /**
   * Single load attempt with timeout.
   * @private
   */
  _loadSingle(url, timeout, onProgress) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[AssetCache] Timeout loading ${url} (${timeout}ms)`));
      }, timeout);

      this.loader.load(
        url,
        (fbx) => {
          clearTimeout(timer);
          resolve(fbx);
        },
        onProgress || undefined,
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  // ── Cache Management ─────────────────────────────────────

  /** Check if a model URL is already cached. */
  has(url) {
    return this.models.has(url);
  }

  /** Manually add a model to the cache (e.g. after procedural creation). */
  set(url, fbx) {
    this.models.set(url, fbx);
    if (fbx.animations?.length > 0) {
      this.clips.set(url, fbx.animations);
    }
  }

  /** Remove a specific entry from cache and dispose its resources. */
  evict(url) {
    const model = this.models.get(url);
    if (model) {
      model.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => m.dispose());
        }
      });
      this.models.delete(url);
    }
    this.clips.delete(url);
  }

  /** Clear entire cache and dispose all resources. */
  clear() {
    for (const url of this.models.keys()) {
      this.evict(url);
    }
    THREE.Cache.clear();
  }

  /** Get cache stats. */
  get stats() {
    return {
      models: this.models.size,
      clips: this.clips.size,
      pending: this.pending.size,
    };
  }
}

/** Singleton instance */
export const assetCache = new AssetCacheManager();
export { AssetCacheManager };
