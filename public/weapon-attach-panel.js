/**
 * Weapon Attach Panel — Injectable overlay for the Grudge World page.
 * Loads as a standalone <script> tag, creates a floating panel that talks
 * to the D1 weapon attachment API via /api/weapon-attachments/*.
 * 
 * Usage: Add <script src="/game/weapon-attach-panel.js" defer></script>
 * to the world page's index.html, or inject via browser console:
 *   const s = document.createElement('script');
 *   s.src = '/game/weapon-attach-panel.js';
 *   document.body.appendChild(s);
 */
(function() {
  'use strict';
  if (document.getElementById('wap-root')) return; // already injected

  const API = '/api';
  const PRESETS = {
    sword:      { label: 'Sword',      icon: '⚔️',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    axe:        { label: 'Axe',        icon: '🪓',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    hammer:     { label: 'Hammer',     icon: '🔨',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    dagger:     { label: 'Dagger',     icon: '🗡️',  bone: 'R_hand_container',  pos: [0,0.02,0],       rot: [0,0,0],     scale: 0.008 },
    greatsword: { label: 'Greatsword', icon: '🗡️',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.012 },
    spear:      { label: 'Spear',      icon: '🔱',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [-90,0,0],   scale: 0.01  },
    bow:        { label: 'Bow',        icon: '🏹',  bone: 'L_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    crossbow:   { label: 'Crossbow',   icon: '🏹',  bone: 'R_hand_container',  pos: [0,0.05,0.02],    rot: [-90,0,0],   scale: 0.01  },
    pistol:     { label: 'Pistol',     icon: '🔫',  bone: 'R_hand_container',  pos: [0,0.02,0.05],    rot: [-90,0,0],   scale: 0.008 },
    rifle:      { label: 'Rifle',      icon: '🔫',  bone: 'R_hand_container',  pos: [0,0.03,0.08],    rot: [-90,0,0],   scale: 0.01  },
    staff:      { label: 'Staff',      icon: '🪄',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    shield:     { label: 'Shield',     icon: '🛡️',  bone: 'L_shield_container',pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    dual_sword: { label: 'Dual Sword', icon: '⚔⚔',  bone: 'R_hand_container',  pos: [0,0,0],          rot: [0,0,0],     scale: 0.01  },
    dual_dagger:{ label: 'Dual Dagger',icon: '🗡🗡', bone: 'R_hand_container',  pos: [0,0.02,0],       rot: [0,0,0],     scale: 0.008 },
  };

  const SLIDERS = [
    { key: 'pos_x', label: 'X',  min: -2,   max: 2,   step: 0.01,  fmt: v => v.toFixed(2) },
    { key: 'pos_y', label: 'Y',  min: -2,   max: 2,   step: 0.01,  fmt: v => v.toFixed(2) },
    { key: 'pos_z', label: 'Z',  min: -2,   max: 2,   step: 0.01,  fmt: v => v.toFixed(2) },
    { key: 'rot_x', label: 'RX', min: -180, max: 180, step: 1,     fmt: v => v.toFixed(0) + '°' },
    { key: 'rot_y', label: 'RY', min: -180, max: 180, step: 1,     fmt: v => v.toFixed(0) + '°' },
    { key: 'rot_z', label: 'RZ', min: -180, max: 180, step: 1,     fmt: v => v.toFixed(0) + '°' },
    { key: 'scale', label: 'S',  min: 0.001,max: 0.1, step: 0.001, fmt: v => v.toFixed(3) },
  ];

  let state = {
    open: false,
    presetKey: null,
    bone: 'R_hand_container',
    pos_x: 0, pos_y: 0, pos_z: 0,
    rot_x: 0, rot_y: 0, rot_z: 0,
    scale: 0.01,
    defaults: null,
    saved: [],
    status: '',
    loading: false,
    modelId: 'crusade_human',
  };

  async function fetchSaved() {
    try {
      const r = await fetch(`${API}/weapon-attachments/${state.modelId}`);
      if (!r.ok) return;
      const d = await r.json();
      state.saved = d.attachments || [];
      render();
    } catch {}
  }

  async function doSave() {
    if (!state.presetKey) { state.status = 'Select weapon first'; render(); return; }
    state.loading = true; render();
    try {
      const p = PRESETS[state.presetKey];
      await fetch(`${API}/weapon-attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: state.modelId,
          bone_name: state.bone,
          weapon_url: '',
          weapon_name: p?.label ?? state.presetKey,
          slot_label: state.presetKey,
          pos_x: state.pos_x, pos_y: state.pos_y, pos_z: state.pos_z,
          rot_x: state.rot_x, rot_y: state.rot_y, rot_z: state.rot_z,
          scale: state.scale,
        }),
      });
      state.status = `Saved: ${p?.label}`;
      await fetchSaved();
    } catch { state.status = 'Save failed'; }
    state.loading = false; render();
  }

  async function doDelete(id) {
    state.loading = true; render();
    try {
      await fetch(`${API}/weapon-attachments/${id}`, { method: 'DELETE' });
      state.status = 'Deleted';
      await fetchSaved();
    } catch { state.status = 'Delete failed'; }
    state.loading = false; render();
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    state.presetKey = key;
    state.bone = p.bone;
    state.pos_x = p.pos[0]; state.pos_y = p.pos[1]; state.pos_z = p.pos[2];
    state.rot_x = p.rot[0]; state.rot_y = p.rot[1]; state.rot_z = p.rot[2];
    state.scale = p.scale;
    state.defaults = { ...state, presetKey: key };
    state.status = `${p.label} → ${p.bone}`;
    render();
  }

  function loadSaved(a) {
    state.bone = a.bone_name;
    state.pos_x = a.pos_x; state.pos_y = a.pos_y; state.pos_z = a.pos_z;
    state.rot_x = a.rot_x; state.rot_y = a.rot_y; state.rot_z = a.rot_z;
    state.scale = a.scale;
    state.presetKey = a.slot_label;
    state.status = `Loaded: ${a.weapon_name}`;
    render();
  }

  function resetTransform() {
    if (state.defaults) {
      state.pos_x = state.defaults.pos_x; state.pos_y = state.defaults.pos_y; state.pos_z = state.defaults.pos_z;
      state.rot_x = state.defaults.rot_x; state.rot_y = state.defaults.rot_y; state.rot_z = state.defaults.rot_z;
      state.scale = state.defaults.scale;
    }
    state.status = 'Reset'; render();
  }

  // ── DOM ──
  const root = document.createElement('div');
  root.id = 'wap-root';
  Object.assign(root.style, {
    position: 'fixed', top: '80px', left: '16px', zIndex: '9999',
    width: '260px', fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '11px', color: '#e6ebf5', pointerEvents: 'auto',
  });
  document.body.appendChild(root);

  function render() {
    const presetGrid = Object.entries(PRESETS).map(([k, p]) => {
      const active = state.presetKey === k;
      return `<button data-preset="${k}" style="
        border:1px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.1)'};
        background:${active ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.04)'};
        color:${active ? '#fde68a' : 'rgba(255,255,255,0.6)'};
        border-radius:4px; padding:3px 2px; text-align:center; cursor:pointer; font-size:9px;
      " title="${p.label}\n${p.bone}">
        <span style="font-size:13px;display:block;line-height:1;">${p.icon}</span>
        <span style="display:block;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.label.split(' ').pop()}</span>
      </button>`;
    }).join('');

    const sliderHtml = SLIDERS.map(s => `
      <div style="margin-bottom:2px;">
        <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.35);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">
          <span>${s.label}</span>
          <span style="color:rgba(245,158,11,0.6);">${s.fmt(state[s.key])}</span>
        </div>
        <input type="range" data-slider="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${state[s.key]}"
          style="width:100%;height:4px;cursor:pointer;accent-color:#f59e0b;">
      </div>
    `).join('');

    const savedHtml = state.saved.length > 0 ? `
      <div style="margin-top:6px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(245,158,11,0.45);margin-bottom:3px;">
          Saved (${state.saved.length})
        </div>
        <div style="max-height:100px;overflow-y:auto;">
          ${state.saved.map(a => `
            <div data-load-id="${a.id}" style="display:flex;align-items:center;gap:4px;padding:3px 6px;margin-bottom:2px;border:1px solid rgba(255,255,255,0.08);border-radius:4px;background:rgba(0,0,0,0.25);cursor:pointer;font-size:10px;color:rgba(255,255,255,0.6);">
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.weapon_name} → ${a.bone_name}</span>
              <span style="font-size:9px;color:rgba(255,255,255,0.3);">S:${a.scale}</span>
              <button data-del-id="${a.id}" style="background:none;border:none;color:rgba(239,68,68,0.6);cursor:pointer;font-size:10px;padding:0 2px;" title="Delete">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    root.innerHTML = `
      <div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);overflow:hidden;">
        <button id="wap-toggle" style="display:flex;width:100%;align-items:center;justify-content:space-between;padding:8px 12px;border:none;background:none;color:rgba(255,255,255,0.55);cursor:pointer;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;">
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="color:#f59e0b;">⚔</span> Weapon Bones
          </span>
          <span>${state.open ? '▲' : '▼'}</span>
        </button>
        ${state.open ? `
          <div style="padding:0 12px 12px;">
            ${state.status ? `<div style="font-size:10px;color:rgba(245,158,11,0.65);margin-bottom:6px;">${state.status}</div>` : ''}
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(245,158,11,0.45);margin-bottom:4px;">Quick Equip</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:8px;">${presetGrid}</div>
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(245,158,11,0.45);margin-bottom:2px;">Bone</div>
            <div style="border:1px solid rgba(255,255,255,0.08);border-radius:4px;background:rgba(0,0,0,0.3);padding:4px 8px;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:8px;">${state.bone}</div>
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(245,158,11,0.45);margin-bottom:2px;">Transform</div>
            ${sliderHtml}
            <div style="display:flex;gap:4px;margin-top:6px;">
              <button id="wap-reset" style="flex:1;padding:5px;border:1px solid rgba(255,255,255,0.08);border-radius:4px;background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.65);cursor:pointer;font-size:10px;font-weight:600;">↺ Reset</button>
              <button id="wap-save" style="flex:1;padding:5px;border:1px solid rgba(245,158,11,0.25);border-radius:4px;background:rgba(120,53,15,0.35);color:#fde68a;cursor:pointer;font-size:10px;font-weight:600;" ${state.loading || !state.presetKey ? 'disabled' : ''}>💾 Save</button>
            </div>
            ${savedHtml}
          </div>
        ` : ''}
      </div>
    `;

    // Bind events
    root.querySelector('#wap-toggle')?.addEventListener('click', () => { state.open = !state.open; render(); if (state.open && !state.saved.length) fetchSaved(); });
    root.querySelector('#wap-reset')?.addEventListener('click', resetTransform);
    root.querySelector('#wap-save')?.addEventListener('click', doSave);
    root.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => applyPreset(btn.dataset.preset)));
    root.querySelectorAll('[data-slider]').forEach(inp => inp.addEventListener('input', (e) => { state[e.target.dataset.slider] = parseFloat(e.target.value); render(); }));
    root.querySelectorAll('[data-load-id]').forEach(row => row.addEventListener('click', (e) => { if (e.target.dataset.delId) return; const a = state.saved.find(x => x.id === row.dataset.loadId); if (a) loadSaved(a); }));
    root.querySelectorAll('[data-del-id]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); doDelete(btn.dataset.delId); }));
  }

  render();
  fetchSaved();
})();
