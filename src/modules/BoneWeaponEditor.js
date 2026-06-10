/**
 * BoneWeaponEditor — Interactive UI for attaching weapons to character bones.
 *
 * Features:
 * - Bone picker dropdown (populated from live skeleton)
 * - Weapon pack selector or drag-drop custom model
 * - Live position/rotation/scale sliders with real-time preview
 * - Quick-slot presets (R_hand, L_hand, L_shield, Spine)
 * - Save to D1 / Reset transforms
 */

import * as THREE from 'three';
import { BoneAttachment } from './BoneAttachment.js';
import { loadModel, prepareModel, SUPPORTED_EXTENSIONS } from './SmartLoader.js';
import { WEAPON_MODEL_PACKS, getWeaponModelPacks } from './FactionRegistry.js';
import { apiClient } from './ApiClient.js';
import { WEAPON_PRESETS, getAllPresets, buildWeaponUrl } from './WeaponLibrary.js';

// Quick-attach presets for common bone slots
const PRESETS = [
  { label: 'R Hand', slot: 'rightHand', icon: '🗡️' },
  { label: 'L Hand', slot: 'leftHand', icon: '🛡️' },
  { label: 'L Shield', slot: 'L_shield_container', icon: '🔰' },
  { label: 'Back', slot: 'spine', icon: '⚔️' },
  { label: 'Head', slot: 'head', icon: '👑' },
  { label: 'Hips', slot: 'hips', icon: '🎒' },
];

export class BoneWeaponEditor {
  /**
   * @param {THREE.Scene} scene
   * @param {BoneAttachment} boneAttach
   * @param {(msg: string) => void} statusFn
   */
  constructor(scene, boneAttach, statusFn) {
    this.scene = scene;
    this.boneAttach = boneAttach;
    this.status = statusFn || (() => {});

    /** Current character model root */
    this.model = null;
    /** Current model ID for D1 (e.g. 'crusade_human') */
    this.modelId = null;
    /** Currently attached preview weapon */
    this._previewMesh = null;
    /** Current bone name */
    this._currentBone = '';
    /** Current transform state */
    this._transform = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, scale: 0.01 };
    /** Default transform (for Reset button) */
    this._defaultTransform = { ...this._transform };
    /** Saved attachments from D1 */
    this._savedAttachments = [];
    /** DOM containers */
    this._container = null;
    /** Loading lock to prevent concurrent loads */
    this._loading = false;
    /** Current active preset key */
    this._activePresetKey = null;
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Set the current model. Call after loading a new character.
   * @param {THREE.Object3D} model
   * @param {string} modelId - D1 model ID e.g. 'crusade_human'
   */
  setModel(model, modelId) {
    this.model = model;
    this.modelId = modelId;
    this._clearPreview();
    // #7 — Reset transform + sliders when switching models
    this._transform = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, scale: 0.01 };
    this._defaultTransform = { ...this._transform };
    this._currentBone = '';
    this._activePresetKey = null;
    this._syncSlidersFromTransform();
    this._refreshBoneList();
    this._loadSavedAttachments();
  }

  /**
   * Initialize the editor UI inside a container element.
   * @param {HTMLElement} container
   */
  init(container) {
    this._container = container;
    container.innerHTML = this._buildHTML();
    this._bindEvents();
  }

  // ── UI Build ──────────────────────────────────────────────

  _buildHTML() {
    const presetBtns = PRESETS.map(p =>
      `<button class="action-btn bone-preset" data-slot="${p.slot}" title="${p.label}" style="font-size:.65rem;padding:2px 6px;">${p.icon} ${p.label}</button>`
    ).join('');

    // Build weapon type quickload grid from WeaponLibrary presets
    const typeGrid = getAllPresets()
      .filter(p => p.pack && p.sample) // only presets with loadable weapons
      .map(p => `<button class="wep-type-btn wep-preset-btn" data-preset="${p.key}" title="${p.label}\n${p.hand.toUpperCase()} • ${p.bone}" style="font-size:.55rem;padding:3px;">${p.icon}<br>${p.label.split(' ').pop()}</button>`)
      .join('');

    return `
      <h3>🦴 Bone Weapon Editor</h3>

      <div style="margin-bottom:6px;">
        <label style="font-size:.65rem;color:var(--muted);">Quick Equip — click to auto-attach</label>
        <div class="wep-type-grid" style="grid-template-columns:repeat(5,1fr);gap:2px;margin-bottom:6px;">${typeGrid}</div>
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:.65rem;color:var(--muted);">Target Bone</label>
        <select id="boneSelect" style="width:100%;margin-bottom:4px;">
          <option value="">— Load a character first —</option>
        </select>
        <div style="display:flex;flex-wrap:wrap;gap:2px;">${presetBtns}</div>
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:.65rem;color:var(--muted);">Weapon Source</label>
        <select id="weaponPackSelect2" style="width:100%;margin-bottom:4px;">
          <option value="">— Select Weapon Pack —</option>
        </select>
        <select id="weaponFileSelect" style="width:100%;margin-bottom:4px;display:none;">
          <option value="">— Select Weapon —</option>
        </select>
        <input type="file" id="customWeaponFile" accept=".fbx,.glb,.gltf,.obj" style="font-size:.65rem;color:var(--muted);width:100%;margin-bottom:4px;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:.65rem;color:var(--muted);">Transform</label>
        ${this._sliderRow('posX', 'X', -2, 2, 0, 0.01)}
        ${this._sliderRow('posY', 'Y', -2, 2, 0, 0.01)}
        ${this._sliderRow('posZ', 'Z', -2, 2, 0, 0.01)}
        ${this._sliderRow('rotX', 'RX', -180, 180, 0, 1)}
        ${this._sliderRow('rotY', 'RY', -180, 180, 0, 1)}
        ${this._sliderRow('rotZ', 'RZ', -180, 180, 0, 1)}
        ${this._sliderRow('scale', 'S', 0.001, 0.1, 0.01, 0.001)}
      </div>

      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <button class="action-btn" id="boneAttachBtn" style="flex:1;">⚡ Attach</button>
        <button class="action-btn" id="boneResetBtn" style="flex:1;">↺ Reset</button>
        <button class="action-btn" id="boneDetachBtn" style="flex:1;">✕ Detach</button>
        <button class="action-btn" id="boneSaveBtn" style="flex:1;background:rgba(110,231,183,.15);">💾 Save</button>
      </div>

      <div id="savedAttachList" style="max-height:80px;overflow-y:auto;font-size:.65rem;"></div>
    `;
  }

  _sliderRow(id, label, min, max, value, step) {
    return `<div class="attr-row" style="margin-bottom:2px;">
      <label style="font-size:.6rem;min-width:22px;font-weight:600;">${label}</label>
      <input type="range" id="slider_${id}" min="${min}" max="${max}" step="${step}" value="${value}" data-transform="${id}" style="flex:1;height:3px;">
      <span class="val" id="val_${id}" style="font-size:.6rem;min-width:36px;">${value}</span>
    </div>`;
  }

  // ── Event Binding ─────────────────────────────────────────

  _bindEvents() {
    const c = this._container;
    if (!c) return;

    // Weapon type preset quickload buttons
    c.querySelectorAll('.wep-preset-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.preset;
        const preset = WEAPON_PRESETS[key];
        if (!preset || !this.model) { this.status('Load a character first'); return; }
        // #6 — Prevent concurrent loads
        if (this._loading) { this.status('Loading in progress...'); return; }

        // Mark active
        c.querySelectorAll('.wep-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activePresetKey = key;

        // #3 — Resolve alias to actual bone name for dropdown sync
        this._currentBone = preset.bone;
        const resolvedBone = this.boneAttach.findBone(this.model, preset.bone);
        const boneSelect = c.querySelector('#boneSelect');
        if (boneSelect && resolvedBone) {
          boneSelect.value = resolvedBone.name;
        }

        // Set transform from preset + store as defaults for Reset
        this._transform = {
          px: preset.pos.x, py: preset.pos.y, pz: preset.pos.z,
          rx: preset.rot.x, ry: preset.rot.y, rz: preset.rot.z,
          scale: preset.scale,
        };
        this._defaultTransform = { ...this._transform };
        this._syncSlidersFromTransform();

        // #6 — Loading lock + status
        this._loading = true;
        this.status(`Loading: ${preset.label}...`);

        try {
          // Load main hand weapon — #1 skip auto-scale, preset provides exact scale
          const packs = { ...WEAPON_MODEL_PACKS, ...getWeaponModelPacks() };
          const url = buildWeaponUrl(preset.pack, preset.sample, packs);
          if (url) await this._loadWeapon(url, preset.label, true);

          // Dual wield: load offhand too
          if (preset.hand === 'dual' && preset.dualOff) {
            const offUrl = buildWeaponUrl(preset.dualOff.pack, preset.dualOff.sample, packs);
            if (offUrl) {
              this.status(`Loading offhand: ${preset.dualOff.sample}`);
              const { scene: offScene } = await loadModel(offUrl);
              offScene.traverse(ch => { if (ch.isMesh) { ch.castShadow = true; ch.receiveShadow = true; } });

              const off = preset.dualOff;
              this.boneAttach.attach(this.model, offScene, off.bone, {
                position: new THREE.Vector3(off.pos.x, off.pos.y, off.pos.z),
                rotation: new THREE.Euler(
                  THREE.MathUtils.degToRad(off.rot.x),
                  THREE.MathUtils.degToRad(off.rot.y),
                  THREE.MathUtils.degToRad(off.rot.z)
                ),
                scale: new THREE.Vector3(off.scale, off.scale, off.scale),
              });
              this.boneAttach.attachments.set('_editor_offhand', {
                bone: this.boneAttach.findBone(this.model, off.bone),
                object: offScene,
              });
              this.status(`Dual wield: ${preset.label}`);
            }
          } else {
            // Not dual — clear any previous offhand
            this.boneAttach.detach('_editor_offhand');
          }
        } catch (err) {
          this.status(`Load failed: ${err.message}`);
        } finally {
          this._loading = false;
        }
      });
    });

    // Bone presets
    c.querySelectorAll('.bone-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const select = c.querySelector('#boneSelect');
        const slot = btn.dataset.slot;
        // Find matching bone in dropdown
        const options = [...select.options];
        const match = options.find(o => o.value === slot || o.text.toLowerCase().includes(slot.toLowerCase()));
        if (match) {
          select.value = match.value;
          this._currentBone = match.value;
          this._updatePreview();
        } else {
          // Use as direct slot name for BoneAttachment (uses alias system)
          this._currentBone = slot;
          this._updatePreview();
        }
        this.status(`Bone: ${this._currentBone}`);
      });
    });

    // Bone dropdown
    c.querySelector('#boneSelect')?.addEventListener('change', (e) => {
      this._currentBone = e.target.value;
      this._updatePreview();
    });

    // Weapon pack dropdown
    c.querySelector('#weaponPackSelect2')?.addEventListener('change', (e) => {
      const packKey = e.target.value;
      const fileSelect = c.querySelector('#weaponFileSelect');
      if (!packKey) { fileSelect.style.display = 'none'; return; }

      const packs = getWeaponModelPacks();
      const pack = packs[packKey] || WEAPON_MODEL_PACKS[packKey];
      if (!pack) return;

      // Generate file options based on pack count and prefix
      fileSelect.innerHTML = '<option value="">— Select Weapon —</option>';
      for (let i = 1; i <= Math.min(pack.count, 30); i++) {
        const num = String(i).padStart(2, '0');
        const filename = `${pack.prefix}${num}.fbx`;
        const opt = document.createElement('option');
        opt.value = pack.path + filename;
        opt.textContent = filename;
        fileSelect.appendChild(opt);
      }
      fileSelect.style.display = '';
    });

    // Weapon file selection
    c.querySelector('#weaponFileSelect')?.addEventListener('change', async (e) => {
      if (e.target.value) await this._loadWeapon(e.target.value);
    });

    // Custom weapon file
    c.querySelector('#customWeaponFile')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      await this._loadWeapon(url, file.name);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    // Transform sliders — update in real-time
    c.querySelectorAll('[data-transform]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.dataset.transform;
        const val = parseFloat(e.target.value);
        c.querySelector(`#val_${key}`).textContent = val.toFixed(key === 'scale' ? 3 : key.startsWith('rot') ? 0 : 2);
        this._transform[key === 'posX' ? 'px' : key === 'posY' ? 'py' : key === 'posZ' ? 'pz'
          : key === 'rotX' ? 'rx' : key === 'rotY' ? 'ry' : key === 'rotZ' ? 'rz' : 'scale'] = val;
        this._applyTransform();
      });
    });

    // Attach button
    c.querySelector('#boneAttachBtn')?.addEventListener('click', () => this._updatePreview());

    // #8 — Reset Transform button: snap back to preset defaults
    c.querySelector('#boneResetBtn')?.addEventListener('click', () => {
      this._transform = { ...this._defaultTransform };
      this._syncSlidersFromTransform();
      this._applyTransform();
      this.status('Transform reset to preset defaults');
    });

    // Detach button — #2 also clears offhand
    c.querySelector('#boneDetachBtn')?.addEventListener('click', () => {
      this._clearPreview();
      this.status('Weapon detached');
    });

    // Save button
    c.querySelector('#boneSaveBtn')?.addEventListener('click', () => this._saveToD1());

    // Populate weapon pack dropdown
    this._refreshWeaponPacks();
  }

  // ── Model Operations ──────────────────────────────────────

  _refreshBoneList() {
    const select = this._container?.querySelector('#boneSelect');
    if (!select || !this.model) return;

    const bones = BoneAttachment.listBones(this.model);
    select.innerHTML = '<option value="">— Select Bone —</option>';
    for (const name of bones) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    this.status(`${bones.length} bones found`);
  }

  _refreshWeaponPacks() {
    const select = this._container?.querySelector('#weaponPackSelect2');
    if (!select) return;

    const packs = getWeaponModelPacks();
    const allPacks = { ...WEAPON_MODEL_PACKS, ...packs };
    select.innerHTML = '<option value="">— Select Weapon Pack —</option>';
    for (const [key, pack] of Object.entries(allPacks)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${pack.name} (${pack.count})`;
      select.appendChild(opt);
    }
  }

  /**
   * Load a weapon model and attach to current bone.
   * @param {string} url
   * @param {string} [displayName]
   * @param {boolean} [skipAutoScale=false] — #1 skip bounding-box auto-scale when preset provides exact scale
   */
  async _loadWeapon(url, displayName, skipAutoScale = false) {
    this.status(`Loading weapon: ${displayName || url.split('/').pop()}`);
    try {
      const { scene: weaponScene } = await loadModel(url);

      // #1 — Only auto-scale when NOT using a preset (manual pack/file pick)
      if (!skipAutoScale) {
        const box = new THREE.Box3().setFromObject(weaponScene);
        const size = box.getSize(new THREE.Vector3()).length();
        const targetSize = 0.5;
        if (size > 0) weaponScene.scale.setScalar(targetSize / size);
      }

      weaponScene.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // #9 — Apply DoubleSide like prepareModel does
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { if (m) m.side = THREE.DoubleSide; });
        }
      });

      weaponScene.userData._weaponUrl = url;
      weaponScene.userData._weaponName = displayName || url.split('/').pop();
      this._previewMesh = weaponScene;
      this._updatePreview();
      this.status(`Loaded: ${weaponScene.userData._weaponName}`);
    } catch (err) {
      this.status(`Failed: ${err.message}`);
      console.error(err);
    }
  }

  _updatePreview() {
    if (!this.model || !this._previewMesh || !this._currentBone) return;

    // Detach from any previous bone
    this.boneAttach.detach('_editor_preview');

    // Attach to selected bone
    const t = this._transform;
    this.boneAttach.attach(this.model, this._previewMesh, this._currentBone, {
      position: new THREE.Vector3(t.px, t.py, t.pz),
      rotation: new THREE.Euler(
        THREE.MathUtils.degToRad(t.rx),
        THREE.MathUtils.degToRad(t.ry),
        THREE.MathUtils.degToRad(t.rz)
      ),
      scale: new THREE.Vector3(t.scale, t.scale, t.scale),
    });

    // Store as editor preview slot
    this.boneAttach.attachments.set('_editor_preview', {
      bone: this.boneAttach.findBone(this.model, this._currentBone),
      object: this._previewMesh,
    });
  }

  _applyTransform() {
    if (!this._previewMesh) return;
    const t = this._transform;
    this._previewMesh.position.set(t.px, t.py, t.pz);
    this._previewMesh.rotation.set(
      THREE.MathUtils.degToRad(t.rx),
      THREE.MathUtils.degToRad(t.ry),
      THREE.MathUtils.degToRad(t.rz)
    );
    this._previewMesh.scale.setScalar(t.scale);
  }

  _clearPreview() {
    // #2 — Detach both main hand and offhand
    this.boneAttach.detach('_editor_preview');
    this.boneAttach.detach('_editor_offhand');
    if (this._previewMesh) {
      this._previewMesh.removeFromParent();
      this._previewMesh = null;
    }
    this._activePresetKey = null;
  }

  // ── D1 Persistence ────────────────────────────────────────

  async _saveToD1() {
    if (!this.modelId || !this._currentBone || !this._previewMesh) {
      this.status('Select bone + weapon first');
      return;
    }

    const t = this._transform;
    const attachment = {
      model_id: this.modelId,
      bone_name: this._currentBone,
      weapon_url: this._previewMesh.userData._weaponUrl || '',
      weapon_name: this._previewMesh.userData._weaponName || 'Custom',
      slot_label: this._currentBone,
      pos_x: t.px, pos_y: t.py, pos_z: t.pz,
      rot_x: t.rx, rot_y: t.ry, rot_z: t.rz,
      scale: t.scale,
    };

    try {
      const result = await apiClient.saveAttachment(attachment);
      this.status(`Saved attachment: ${attachment.weapon_name} → ${attachment.bone_name}`);
      this._loadSavedAttachments();
    } catch (err) {
      this.status(`Save failed: ${err.message}`);
    }
  }

  async _loadSavedAttachments() {
    if (!this.modelId) return;
    const listEl = this._container?.querySelector('#savedAttachList');
    if (!listEl) return;

    try {
      this._savedAttachments = await apiClient.getAttachments(this.modelId);
    } catch {
      this._savedAttachments = [];
    }

    if (this._savedAttachments.length === 0) {
      listEl.innerHTML = '<p style="color:var(--muted);">No saved attachments</p>';
      return;
    }

    listEl.innerHTML = this._savedAttachments.map(a => `
      <div class="saved-char" data-id="${a.id}" style="padding:4px 6px;margin-bottom:2px;">
        <span class="char-name" style="font-size:.6rem;">${a.weapon_name} → ${a.bone_name}</span>
        <span style="font-size:.55rem;color:var(--muted);">S:${a.scale}</span>
        <span class="char-delete" data-delete-attach="${a.id}" title="Delete">✕</span>
      </div>
    `).join('');

    // Bind click to load / delete
    listEl.querySelectorAll('[data-delete-attach]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await apiClient.deleteAttachment(btn.dataset.deleteAttach);
          this.status('Attachment deleted');
          this._loadSavedAttachments();
        } catch (err) {
          this.status(`Delete failed: ${err.message}`);
        }
      });
    });

    listEl.querySelectorAll('.saved-char[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const a = this._savedAttachments.find(x => x.id === row.dataset.id);
        if (!a) return;
        // Set bone and transform from saved data
        this._currentBone = a.bone_name;
        const boneSelect = this._container?.querySelector('#boneSelect');
        if (boneSelect) boneSelect.value = a.bone_name;
        this._transform = {
          px: a.pos_x, py: a.pos_y, pz: a.pos_z,
          rx: a.rot_x, ry: a.rot_y, rz: a.rot_z,
          scale: a.scale,
        };
        this._syncSlidersFromTransform();
        // Load the weapon if URL is set
        if (a.weapon_url) this._loadWeapon(a.weapon_url, a.weapon_name);
        this.status(`Loaded: ${a.weapon_name} → ${a.bone_name}`);
      });
    });
  }

  _syncSlidersFromTransform() {
    const c = this._container;
    if (!c) return;
    const t = this._transform;
    const map = { posX: t.px, posY: t.py, posZ: t.pz, rotX: t.rx, rotY: t.ry, rotZ: t.rz, scale: t.scale };
    for (const [key, val] of Object.entries(map)) {
      const slider = c.querySelector(`#slider_${key}`);
      const valEl = c.querySelector(`#val_${key}`);
      if (slider) slider.value = val;
      if (valEl) valEl.textContent = key === 'scale' ? val.toFixed(3) : key.startsWith('rot') ? val.toFixed(0) : val.toFixed(2);
    }
  }
}
