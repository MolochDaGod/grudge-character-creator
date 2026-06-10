/**
 * SmartLoader — Universal model/animation loader with auto-format detection.
 *
 * Supports: .fbx, .gltf, .glb (+ Draco + KTX2), .obj (+.mtl), .dae, .stl, .usdz
 * Returns a consistent { scene, animations, format } shape regardless of format.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { USDZLoader } from 'three/addons/loaders/USDZLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ── Singleton loaders ────────────────────────────────────────────────────────

const fbxLoader = new FBXLoader();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();
const colladaLoader = new ColladaLoader();
const stlLoader = new STLLoader();
const usdzLoader = new USDZLoader();
const rgbeLoader = new RGBELoader();

// GLTF with Draco decoder
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'js' });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let ktx2Ready = false;

/**
 * Initialize KTX2 texture support (call once after renderer is created).
 * @param {THREE.WebGLRenderer} renderer
 */
export function initKTX2(renderer) {
  if (ktx2Ready) return;
  try {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/');
    ktx2Loader.detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    ktx2Ready = true;
  } catch (e) {
    console.warn('[SmartLoader] KTX2 init failed (non-fatal):', e.message);
  }
}

// ── Format detection ─────────────────────────────────────────────────────────

const FORMAT_MAP = {
  '.fbx': 'fbx', '.gltf': 'gltf', '.glb': 'glb',
  '.obj': 'obj', '.dae': 'dae', '.stl': 'stl',
  '.usdz': 'usdz', '.usdc': 'usdz',
};

function detectFormat(url) {
  const clean = url.toLowerCase().split('?')[0].split('#')[0];
  for (const [ext, fmt] of Object.entries(FORMAT_MAP)) {
    if (clean.endsWith(ext)) return fmt;
  }
  return 'unknown';
}

function dirOf(url) {
  const i = url.lastIndexOf('/');
  return i >= 0 ? url.slice(0, i + 1) : '';
}

// ── Core load ────────────────────────────────────────────────────────────────

/**
 * Load any 3D model and return a normalized result.
 * @param {string} url
 * @param {(e: ProgressEvent) => void} [onProgress]
 * @param {object} [opts]
 * @param {string} [opts.mtlUrl] - explicit .mtl path for OBJ files
 * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[], format: string}>}
 */
export async function loadModel(url, onProgress, opts = {}) {
  const fmt = detectFormat(url);

  if (fmt === 'fbx') {
    return new Promise((resolve, reject) => {
      fbxLoader.load(url, (fbx) => {
        resolve({ scene: fbx, animations: fbx.animations || [], format: 'fbx' });
      }, onProgress, reject);
    });
  }

  if (fmt === 'gltf' || fmt === 'glb') {
    return new Promise((resolve, reject) => {
      gltfLoader.load(url, (gltf) => {
        resolve({ scene: gltf.scene, animations: gltf.animations || [], format: fmt });
      }, onProgress, reject);
    });
  }

  if (fmt === 'obj') {
    const mtlUrl = opts.mtlUrl || url.replace(/\.obj$/i, '.mtl');
    let materials = null;
    try {
      materials = await new Promise((resolve) => {
        mtlLoader.setPath(dirOf(mtlUrl));
        mtlLoader.load(mtlUrl.split('/').pop(), (mtl) => {
          mtl.preload(); resolve(mtl);
        }, undefined, () => resolve(null));
      });
    } catch { /* no MTL */ }
    if (materials) objLoader.setMaterials(materials);
    return new Promise((resolve, reject) => {
      objLoader.load(url, (obj) => {
        resolve({ scene: obj, animations: [], format: 'obj' });
      }, onProgress, reject);
    });
  }

  if (fmt === 'dae') {
    return new Promise((resolve, reject) => {
      colladaLoader.load(url, (collada) => {
        resolve({ scene: collada.scene, animations: collada.scene.animations || [], format: 'dae' });
      }, onProgress, reject);
    });
  }

  if (fmt === 'stl') {
    return new Promise((resolve, reject) => {
      stlLoader.load(url, (geometry) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = url.split('/').pop()?.replace(/\.stl$/i, '') || 'stl_model';
        const group = new THREE.Group();
        group.add(mesh);
        resolve({ scene: group, animations: [], format: 'stl' });
      }, onProgress, reject);
    });
  }

  if (fmt === 'usdz') {
    return new Promise((resolve, reject) => {
      usdzLoader.load(url, (usd) => {
        resolve({ scene: usd.scene || usd, animations: [], format: 'usdz' });
      }, onProgress, reject);
    });
  }

  throw new Error(`[SmartLoader] Unsupported format: ${url}`);
}

/**
 * Load a model from a File/Blob (drag-and-drop).
 * @param {File} file
 * @returns {Promise<{scene: THREE.Group, animations: THREE.AnimationClip[], format: string}>}
 */
export async function loadModelFromFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const fmt = FORMAT_MAP[ext];
  if (!fmt) throw new Error(`[SmartLoader] Unsupported file: ${file.name}`);

  const url = URL.createObjectURL(file);
  // For FBX, rename blob URL so the loader can detect the format
  const fakeUrl = url + '#/' + file.name;
  try {
    return await loadModel(fakeUrl, undefined, {});
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

// ── Animation ────────────────────────────────────────────────────────────────

export async function loadAnimationClips(url) {
  const { animations } = await loadModel(url);
  return animations;
}

// ── HDR Environment ──────────────────────────────────────────────────────────

/**
 * Load an HDR environment map and apply it to the scene.
 * @param {string} url
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} [opts]
 * @returns {Promise<THREE.DataTexture>}
 */
export async function loadHDREnvironment(url, scene, renderer, opts = {}) {
  const { backgroundBlurriness = 0.5, backgroundIntensity = 0.4, envIntensity = 1.0 } = opts;
  return new Promise((resolve, reject) => {
    rgbeLoader.load(url, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.environmentIntensity = envIntensity;
      scene.background = texture;
      scene.backgroundBlurriness = backgroundBlurriness;
      scene.backgroundIntensity = backgroundIntensity;
      resolve(texture);
    }, undefined, reject);
  });
}

// ── Model preparation ────────────────────────────────────────────────────────

/**
 * Scale, center, and enable shadows on a loaded model.
 * @param {THREE.Object3D} model
 * @param {object} [opts]
 * @param {number} [opts.targetHeight=2.0]
 * @param {boolean} [opts.shadows=true]
 */
export function prepareModel(model, opts = {}) {
  const { targetHeight = 2.0, shadows = true } = opts;
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height > 0) model.scale.setScalar(targetHeight / height);

  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y = -scaledBox.min.y;
  model.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
  model.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

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

// ── Exports ──────────────────────────────────────────────────────────────────

export const SUPPORTED_EXTENSIONS = Object.keys(FORMAT_MAP);
export const ACCEPT_TYPES = SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join(',');
export { fbxLoader, gltfLoader, dracoLoader, rgbeLoader };
