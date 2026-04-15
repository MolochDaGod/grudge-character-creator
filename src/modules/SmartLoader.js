/**
 * SmartLoader — Unified model/animation loader that auto-detects format.
 *
 * Supports: .fbx, .gltf, .glb
 * Returns a consistent { scene, animations, mixer } shape regardless of format.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

/**
 * Detect format from URL.
 * @param {string} url
 * @returns {'fbx'|'gltf'|'glb'|'unknown'}
 */
function detectFormat(url) {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.fbx')) return 'fbx';
  if (lower.endsWith('.gltf')) return 'gltf';
  if (lower.endsWith('.glb')) return 'glb';
  return 'unknown';
}

/**
 * Load any 3D model (FBX, GLTF, GLB) and return a normalized result.
 *
 * @param {string} url
 * @param {(e: ProgressEvent) => void} [onProgress]
 * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[]}>}
 */
export async function loadModel(url, onProgress) {
  const fmt = detectFormat(url);

  if (fmt === 'fbx') {
    return new Promise((resolve, reject) => {
      fbxLoader.load(url, (fbx) => {
        resolve({ scene: fbx, animations: fbx.animations || [] });
      }, onProgress, reject);
    });
  }

  if (fmt === 'gltf' || fmt === 'glb') {
    return new Promise((resolve, reject) => {
      gltfLoader.load(url, (gltf) => {
        resolve({ scene: gltf.scene, animations: gltf.animations || [] });
      }, onProgress, reject);
    });
  }

  throw new Error(`[SmartLoader] Unknown format for: ${url}`);
}

/**
 * Load an animation file and return its clips.
 * @param {string} url
 * @returns {Promise<THREE.AnimationClip[]>}
 */
export async function loadAnimationClips(url) {
  const { animations } = await loadModel(url);
  return animations;
}

/**
 * Prepare a loaded model for the scene: scale, center, enable shadows.
 *
 * @param {THREE.Object3D} model
 * @param {object} [opts]
 * @param {number} [opts.targetHeight=2.0]
 * @param {boolean} [opts.shadows=true]
 * @returns {THREE.Object3D}
 */
export function prepareModel(model, opts = {}) {
  const { targetHeight = 2.0, shadows = true } = opts;

  // Scale to target height
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height > 0) {
    const scale = targetHeight / height;
    model.scale.setScalar(scale);
  }

  // Center on ground
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y = -scaledBox.min.y;
  model.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
  model.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

  // Shadows + double-sided materials
  if (shadows) {
    model.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { m.side = THREE.DoubleSide; });
        }
      }
    });
  }

  return model;
}

// Re-export loaders for direct use if needed
export { fbxLoader, gltfLoader };
