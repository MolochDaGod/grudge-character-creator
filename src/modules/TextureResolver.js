/**
 * TextureResolver — Auto-discover, auto-attach, and fallback-generate textures.
 *
 * Pipeline (runs after loadModel):
 * 1. Scan each mesh's material for missing texture channels
 * 2. Attempt to discover sibling texture files by naming convention
 * 3. Auto-attach discovered textures to the correct PBR channel
 * 4. If nothing found, generate procedural fallback materials:
 *    - Low-poly (< 5000 verts) → Toon/stylized (flat color, cel outline)
 *    - High-poly (≥ 5000 verts) → Realistic PBR (roughness/metalness from name heuristics)
 */

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

// ── Poly threshold for toon vs PBR ──────────────────────────────────────────

const TOON_THRESHOLD = 5000; // Total vertex count below this → toon style

// ── Texture naming conventions ───────────────────────────────────────────────

const CHANNEL_PATTERNS = {
  map: [
    /_diffuse\./i, /_basecolor\./i, /_albedo\./i, /_color\./i, /_diff\./i,
    /_col\./i, /_base\./i, /diffuse\./i, /albedo\./i, /color\./i,
  ],
  normalMap: [
    /_normal\./i, /_norm\./i, /_nrm\./i, /normal\./i, /_bump\./i,
  ],
  roughnessMap: [
    /_roughness\./i, /_rough\./i, /_rgh\./i, /roughness\./i,
  ],
  metalnessMap: [
    /_metallic\./i, /_metalness\./i, /_metal\./i, /_mtl\./i, /metallic\./i,
  ],
  aoMap: [
    /_ao\./i, /_ambient.?occlusion\./i, /_occlusion\./i, /ao\./i,
  ],
  emissiveMap: [
    /_emissive\./i, /_emission\./i, /_glow\./i, /emissive\./i,
  ],
};

const TEXTURE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.tga'];

// ── Material name heuristics for procedural fallback ─────────────────────────

const MATERIAL_HEURISTICS = [
  { re: /metal|iron|steel|chrome|gold|silver|copper|bronze/i, metalness: 0.9, roughness: 0.3 },
  { re: /wood|bark|log|plank|timber/i,                        metalness: 0.0, roughness: 0.8 },
  { re: /cloth|fabric|linen|silk|cotton|wool|leather/i,       metalness: 0.0, roughness: 0.95 },
  { re: /stone|rock|brick|concrete|marble|granite/i,          metalness: 0.0, roughness: 0.85 },
  { re: /glass|crystal|gem|diamond|ruby/i,                    metalness: 0.1, roughness: 0.1 },
  { re: /skin|flesh|face|body/i,                              metalness: 0.0, roughness: 0.6 },
  { re: /hair|fur/i,                                          metalness: 0.0, roughness: 0.7 },
  { re: /bone|tooth|tusk|ivory/i,                             metalness: 0.0, roughness: 0.5 },
  { re: /water|liquid/i,                                      metalness: 0.0, roughness: 0.05 },
  { re: /plastic|rubber|polymer/i,                            metalness: 0.0, roughness: 0.4 },
];

function guessPhysicalProps(materialName) {
  for (const h of MATERIAL_HEURISTICS) {
    if (h.re.test(materialName)) return { metalness: h.metalness, roughness: h.roughness };
  }
  return { metalness: 0.0, roughness: 0.6 }; // generic default
}

// ── Deterministic color from string ──────────────────────────────────────────

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return new THREE.Color().setHSL(h / 360, 0.5, 0.5);
}

// ── Toon material generator ─────────────────────────────────────────────────

function createToonMaterial(mesh, existingMat) {
  let baseColor = new THREE.Color(0x888888);

  // Try vertex colors first
  if (mesh.geometry?.getAttribute('color')) {
    baseColor = sampleVertexColor(mesh.geometry);
  } else if (existingMat?.color && !existingMat.color.equals(new THREE.Color(1, 1, 1))) {
    baseColor = existingMat.color.clone();
  } else {
    baseColor = hashColor(mesh.name || mesh.uuid);
  }

  // Three.js MeshToonMaterial for cel-shaded look
  const gradientTex = createGradientTexture(3);
  const mat = new THREE.MeshToonMaterial({
    color: baseColor,
    gradientMap: gradientTex,
    side: THREE.DoubleSide,
  });
  mat.name = `toon_${mesh.name || 'auto'}`;
  return mat;
}

function createGradientTexture(steps) {
  const canvas = document.createElement('canvas');
  canvas.width = steps;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const val = Math.floor((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${val},${val},${val})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ── PBR material generator ──────────────────────────────────────────────────

function createPBRMaterial(mesh, existingMat) {
  let baseColor = new THREE.Color(0x888888);

  if (mesh.geometry?.getAttribute('color')) {
    baseColor = sampleVertexColor(mesh.geometry);
  } else if (existingMat?.color && !existingMat.color.equals(new THREE.Color(1, 1, 1))) {
    baseColor = existingMat.color.clone();
  } else {
    baseColor = hashColor(mesh.name || mesh.uuid);
  }

  const matName = existingMat?.name || mesh.name || '';
  const { metalness, roughness } = guessPhysicalProps(matName);

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  mat.name = `pbr_${mesh.name || 'auto'}`;
  return mat;
}

// ── Vertex color sampling ───────────────────────────────────────────────────

function sampleVertexColor(geometry) {
  const colorAttr = geometry.getAttribute('color');
  if (!colorAttr || colorAttr.count === 0) return new THREE.Color(0x888888);

  // Average the first 10 vertices
  let r = 0, g = 0, b = 0;
  const n = Math.min(colorAttr.count, 10);
  for (let i = 0; i < n; i++) {
    r += colorAttr.getX(i);
    g += colorAttr.getY(i);
    b += colorAttr.getZ(i);
  }
  return new THREE.Color(r / n, g / n, b / n);
}

// ── Main resolve function ────────────────────────────────────────────────────

/**
 * Count total vertices in a model.
 * @param {THREE.Object3D} root
 * @returns {number}
 */
function countVertices(root) {
  let total = 0;
  root.traverse(child => {
    if (child.geometry) {
      const pos = child.geometry.getAttribute('position');
      if (pos) total += pos.count;
    }
  });
  return total;
}

/**
 * Check if a material has a meaningful texture on the diffuse channel.
 * @param {THREE.Material} mat
 * @returns {boolean}
 */
function hasTexture(mat) {
  if (!mat) return false;
  if (mat.map && mat.map.image) return true;
  return false;
}

/**
 * Try to load a texture from a URL pattern, returning null on failure.
 * @param {string} url
 * @returns {Promise<THREE.Texture|null>}
 */
async function tryLoadTexture(url) {
  return new Promise((resolve) => {
    textureLoader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

/**
 * Attempt to discover and attach textures by naming convention.
 * @param {THREE.Mesh} mesh
 * @param {string} modelUrl - URL the model was loaded from (for sibling lookup)
 * @returns {Promise<boolean>} true if any texture was attached
 */
async function discoverTextures(mesh, modelUrl) {
  if (!modelUrl) return false;

  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat || !(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial)) {
    return false;
  }

  const baseDir = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
  const modelBase = modelUrl.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  let attached = false;

  for (const [channel, patterns] of Object.entries(CHANNEL_PATTERNS)) {
    if (mat[channel]) continue; // already has a texture

    for (const ext of TEXTURE_EXTS) {
      for (const pattern of patterns) {
        // Build candidate: modelName_diffuse.png, modelName_normal.png, etc.
        const suffix = pattern.source.replace(/[\\^$.|?*+()[\]{}]/g, '').replace(/^_/, '');
        const candidate = `${baseDir}${modelBase}_${suffix}${ext}`;
        const tex = await tryLoadTexture(candidate);
        if (tex) {
          mat[channel] = tex;
          mat.needsUpdate = true;
          attached = true;
          break;
        }
      }
      if (mat[channel]) break;
    }
  }

  return attached;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full texture resolution pipeline on a loaded model.
 *
 * 1. Try to discover sibling textures by naming convention
 * 2. For meshes with no textures, generate procedural materials
 *    (toon for low-poly, PBR for high-poly)
 *
 * @param {THREE.Object3D} model
 * @param {string} [modelUrl] - original URL for sibling texture lookup
 * @returns {Promise<{discovered: number, generated: number}>}
 */
export async function resolveTextures(model, modelUrl) {
  const totalVerts = countVertices(model);
  const useToon = totalVerts < TOON_THRESHOLD;
  let discovered = 0;
  let generated = 0;

  const meshes = [];
  model.traverse(child => {
    if (child.isMesh || child.isSkinnedMesh) meshes.push(child);
  });

  for (const mesh of meshes) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

    // Skip meshes that already have a proper texture
    if (hasTexture(mat)) continue;

    // Phase 1: Try to discover textures from sibling files
    if (modelUrl) {
      const found = await discoverTextures(mesh, modelUrl);
      if (found) { discovered++; continue; }
    }

    // Phase 2: Generate procedural material
    if (useToon) {
      mesh.material = createToonMaterial(mesh, mat);
    } else {
      mesh.material = createPBRMaterial(mesh, mat);
    }
    generated++;
  }

  return { discovered, generated };
}

/**
 * Classify whether a model is "low-poly" (toon) or "high-poly" (PBR).
 * @param {THREE.Object3D} model
 * @returns {'toon'|'pbr'}
 */
export function classifyStyle(model) {
  return countVertices(model) < TOON_THRESHOLD ? 'toon' : 'pbr';
}

export { TOON_THRESHOLD, CHANNEL_PATTERNS, MATERIAL_HEURISTICS };
