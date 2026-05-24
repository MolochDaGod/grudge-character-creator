/**
 * ForgePanel — Admin model inspector + hierarchy breakdown tool.
 *
 * Features:
 * - Drag-and-drop any model file onto the viewport
 * - Recursive hierarchy tree with collapsible nodes
 * - Auto-labels appendages (head, arms, legs, hands, feet, torso, hips)
 * - Per-node isolation (click to focus), visibility toggle
 * - Export hierarchy as JSON
 * - Geometry + material stats per node
 */

import * as THREE from 'three';
import { loadModelFromFile, prepareModel, SUPPORTED_EXTENSIONS } from './SmartLoader.js';

// ── Appendage classification heuristics ──────────────────────────────────────

const APPENDAGE_PATTERNS = [
  { label: 'head',    re: /head|skull|cranium/i,    color: '#ef4444' },
  { label: 'neck',    re: /neck/i,                   color: '#f97316' },
  { label: 'torso',   re: /spine|chest|torso|ribcage/i, color: '#3b82f6' },
  { label: 'hips',    re: /hip|pelvis|root/i,        color: '#8b5cf6' },
  { label: 'arm_R',   re: /r.*(arm|upper.?arm|shoulder)/i, color: '#22c55e' },
  { label: 'arm_L',   re: /l.*(arm|upper.?arm|shoulder)/i, color: '#22c55e' },
  { label: 'forearm_R', re: /r.*(forearm|fore.?arm)/i, color: '#14b8a6' },
  { label: 'forearm_L', re: /l.*(forearm|fore.?arm)/i, color: '#14b8a6' },
  { label: 'hand_R',  re: /r.*(hand|palm|fist)/i,    color: '#eab308' },
  { label: 'hand_L',  re: /l.*(hand|palm|fist)/i,    color: '#eab308' },
  { label: 'finger_R', re: /r.*(finger|thumb|index|middle|ring|pinky)/i, color: '#f59e0b' },
  { label: 'finger_L', re: /l.*(finger|thumb|index|middle|ring|pinky)/i, color: '#f59e0b' },
  { label: 'leg_R',   re: /r.*(thigh|upper.?leg|leg)/i, color: '#06b6d4' },
  { label: 'leg_L',   re: /l.*(thigh|upper.?leg|leg)/i, color: '#06b6d4' },
  { label: 'shin_R',  re: /r.*(shin|calf|lower.?leg)/i, color: '#0ea5e9' },
  { label: 'shin_L',  re: /l.*(shin|calf|lower.?leg)/i, color: '#0ea5e9' },
  { label: 'foot_R',  re: /r.*(foot|toe|ankle)/i,    color: '#a855f7' },
  { label: 'foot_L',  re: /l.*(foot|toe|ankle)/i,    color: '#a855f7' },
  { label: 'weapon',  re: /weapon|sword|axe|shield|bow|staff|container/i, color: '#fbbf24' },
  { label: 'utility', re: /bag|quiver|cape|cloak|belt/i, color: '#94a3b8' },
];

function classifyAppendage(name) {
  for (const p of APPENDAGE_PATTERNS) {
    if (p.re.test(name)) return p;
  }
  return null;
}

// ── Node stats ───────────────────────────────────────────────────────────────

function getNodeStats(obj) {
  const stats = { type: 'Object3D', vertices: 0, faces: 0, materials: [], textures: [] };

  if (obj.isBone) stats.type = 'Bone';
  else if (obj.isSkinnedMesh) stats.type = 'SkinnedMesh';
  else if (obj.isMesh) stats.type = 'Mesh';
  else if (obj.isGroup) stats.type = 'Group';
  else if (obj.isLight) stats.type = 'Light';
  else if (obj.isCamera) stats.type = 'Camera';

  if (obj.geometry) {
    const pos = obj.geometry.getAttribute('position');
    if (pos) stats.vertices = pos.count;
    const idx = obj.geometry.index;
    stats.faces = idx ? idx.count / 3 : Math.floor(stats.vertices / 3);
  }

  const mats = obj.material
    ? (Array.isArray(obj.material) ? obj.material : [obj.material])
    : [];
  for (const m of mats) {
    stats.materials.push(m.type || 'unknown');
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
      if (m[key]) stats.textures.push(key);
    }
  }

  return stats;
}

// ── Hierarchy tree builder ───────────────────────────────────────────────────

function buildTreeData(obj, depth = 0) {
  const appendage = classifyAppendage(obj.name);
  if (appendage) obj.userData.appendage = appendage.label;

  const stats = getNodeStats(obj);
  const node = {
    name: obj.name || `(unnamed ${stats.type})`,
    type: stats.type,
    uuid: obj.uuid,
    appendage: appendage?.label || null,
    appendageColor: appendage?.color || null,
    vertices: stats.vertices,
    faces: stats.faces,
    materials: stats.materials,
    textures: stats.textures,
    visible: obj.visible,
    depth,
    children: [],
  };

  for (const child of obj.children) {
    node.children.push(buildTreeData(child, depth + 1));
  }

  return node;
}

function treeToHTML(node, flat = []) {
  const indent = node.depth * 16;
  const hasChildren = node.children.length > 0;
  const toggle = hasChildren ? '<span class="forge-toggle">▶</span>' : '<span class="forge-toggle" style="visibility:hidden">▶</span>';
  const badge = node.appendage
    ? `<span class="forge-badge" style="background:${node.appendageColor}">${node.appendage}</span>`
    : '';
  const typeIcon = {
    Bone: '🦴', Mesh: '🔷', SkinnedMesh: '🧬', Group: '📦', Light: '💡', Camera: '📷',
  }[node.type] || '⬜';
  const geoInfo = node.vertices > 0 ? `<span class="forge-geo">${node.vertices}v / ${node.faces}f</span>` : '';
  const matInfo = node.materials.length > 0
    ? `<span class="forge-mat">${node.materials[0]}${node.textures.length ? ' [' + node.textures.join(',') + ']' : ''}</span>`
    : '';
  const vis = node.visible ? '' : ' forge-hidden';

  flat.push(`<div class="forge-node${vis}" data-uuid="${node.uuid}" data-depth="${node.depth}" style="padding-left:${indent}px">
    ${toggle} ${typeIcon} <span class="forge-name">${node.name}</span> ${badge} ${geoInfo} ${matInfo}
    <button class="forge-vis" data-uuid="${node.uuid}" title="Toggle visibility">👁</button>
    <button class="forge-focus" data-uuid="${node.uuid}" title="Focus camera">🎯</button>
  </div>`);

  for (const child of node.children) {
    treeToHTML(child, flat);
  }

  return flat;
}

// ── Total poly count ─────────────────────────────────────────────────────────

function countTotalPolys(obj) {
  let verts = 0, faces = 0;
  obj.traverse(child => {
    if (child.geometry) {
      const pos = child.geometry.getAttribute('position');
      if (pos) verts += pos.count;
      const idx = child.geometry.index;
      faces += idx ? idx.count / 3 : (pos ? Math.floor(pos.count / 3) : 0);
    }
  });
  return { verts, faces };
}

// ── ForgePanel class ─────────────────────────────────────────────────────────

export class ForgePanel {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
   * @param {(msg: string) => void} updateStatus
   */
  constructor(scene, camera, controls, updateStatus) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.updateStatus = updateStatus;
    this.forgeModel = null;
    this.treeData = null;
    this._objectMap = new Map();
  }

  // ── Drag and drop setup ──────────────────────────────────

  initDropZone(viewportEl) {
    const overlay = document.createElement('div');
    overlay.id = 'forgeDropOverlay';
    overlay.innerHTML = '<p>Drop model file here<br><small>FBX · GLB · GLTF · OBJ · DAE · STL · USDZ</small></p>';
    overlay.style.cssText = `
      display:none; position:absolute; inset:0; z-index:100;
      background:rgba(110,231,183,.15); border:3px dashed var(--accent);
      font-size:1.2rem; color:var(--accent); pointer-events:none;
      justify-content:center; align-items:center; flex-direction:column;
    `;
    viewportEl.style.position = 'relative';
    viewportEl.appendChild(overlay);

    viewportEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      overlay.style.display = 'flex';
    });
    viewportEl.addEventListener('dragleave', () => {
      overlay.style.display = 'none';
    });
    viewportEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      overlay.style.display = 'none';
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      await this.loadDroppedFile(file);
    });
  }

  async loadDroppedFile(file) {
    this.updateStatus(`Forge: Loading ${file.name}...`);
    try {
      const { scene: model, animations, format } = await loadModelFromFile(file);
      prepareModel(model);

      // Remove previous forge model
      if (this.forgeModel) this.scene.remove(this.forgeModel);

      this.scene.add(model);
      this.forgeModel = model;

      // Build hierarchy
      this._objectMap.clear();
      model.traverse(obj => this._objectMap.set(obj.uuid, obj));

      this.treeData = buildTreeData(model);
      const { verts, faces } = countTotalPolys(model);

      this.updateStatus(`Forge: ${file.name} (${format}) — ${verts} verts, ${faces} faces, ${animations.length} anims`);
      this.renderTree();
    } catch (err) {
      this.updateStatus(`Forge error: ${err.message}`);
      console.error('[Forge]', err);
    }
  }

  // ── Tree rendering ───────────────────────────────────────

  renderTree() {
    const container = document.getElementById('forgeTree');
    if (!container || !this.treeData) return;

    const lines = treeToHTML(this.treeData);
    container.innerHTML = lines.join('');

    // Wire click events
    container.addEventListener('click', (e) => {
      const togBtn = e.target.closest('.forge-toggle');
      if (togBtn) {
        const row = togBtn.closest('.forge-node');
        const depth = parseInt(row.dataset.depth);
        let sibling = row.nextElementSibling;
        const collapsing = togBtn.textContent === '▼';
        togBtn.textContent = collapsing ? '▶' : '▼';
        while (sibling && parseInt(sibling.dataset.depth) > depth) {
          sibling.style.display = collapsing ? 'none' : '';
          sibling = sibling.nextElementSibling;
        }
        return;
      }

      const visBtn = e.target.closest('.forge-vis');
      if (visBtn) {
        const obj = this._objectMap.get(visBtn.dataset.uuid);
        if (obj) {
          obj.visible = !obj.visible;
          visBtn.closest('.forge-node').classList.toggle('forge-hidden', !obj.visible);
        }
        return;
      }

      const focusBtn = e.target.closest('.forge-focus');
      if (focusBtn) {
        const obj = this._objectMap.get(focusBtn.dataset.uuid);
        if (obj) this.focusOn(obj);
        return;
      }
    });
  }

  // ── Camera focus ─────────────────────────────────────────

  focusOn(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);

    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(maxDim * 1.5, maxDim, maxDim * 1.5));
    this.controls.update();
    this.updateStatus(`Focused: ${obj.name || obj.uuid}`);
  }

  // ── Export ───────────────────────────────────────────────

  exportJSON() {
    if (!this.treeData) {
      this.updateStatus('Forge: Nothing to export');
      return;
    }
    const json = JSON.stringify(this.treeData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.forgeModel?.name || 'model') + '_hierarchy.json';
    a.click();
    URL.revokeObjectURL(url);
    this.updateStatus('Forge: Hierarchy exported');
  }
}
