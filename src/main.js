import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { SkeletonHelper } from 'three';

import { EquipmentManager } from './modules/EquipmentManager.js';
import { getAllRaces, WEAPON_ANIMATION_PACKS } from './modules/FactionRegistry.js';
import {
  ATTRIBUTES, ATTR_KEYS, MAX_POINTS,
  calculateDerivedStats, simulateCombat, createDefaultCharacter
} from './modules/StatsEngine.js';
import { apiClient } from './modules/ApiClient.js';
import { characterStore } from './modules/CharacterStore.js';
import {
  CLASSES, CLASS_SKILLS, PROFESSIONS, WORGE_FORMS, MAGIC_VFX,
  WEAPON_TYPES, WEAPON_SKILLS, MASTERY_TIERS, getMasteryProgress,
  WEAPON_ANIM_MAP, COMBAT_ACTIONS,
} from './modules/GameData.js';
import { WeaponAnimController } from './modules/WeaponAnimController.js';

// ── New modules from threejs-skills integration ──
import { assetCache } from './modules/AssetCache.js';
import { PostFX } from './modules/PostFX.js';
import { BoneAttachment } from './modules/BoneAttachment.js';
import { BossFight } from './modules/BossFight.js';

// ════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════
let scene, camera, renderer, controls, clock;
let mixer = null;
let currentModel = null;
let currentActions = {};
let currentAction = null;
let equipMgr = null;
let skeletonHelper = null;
let wireframeMode = false;
let character = createDefaultCharacter(10);
const fbxLoader = new FBXLoader();
const dummies = [];

// Track current editor state for persistence
let currentFactionId = null;
let currentRaceId = null;

// Weapon animation controller
let weaponCtrl = null;

// Post-processing, bone attachment, boss fight
let postfx = null;
let boneAttach = new BoneAttachment();
let bossFight = null;

// ════════════════════════════════════════════════════════════
// Scene Setup
// ════════════════════════════════════════════════════════════
function initScene() {
  const container = document.getElementById('viewport');
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

  // Camera
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 2.5, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
    if (postfx) postfx.resize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minDistance = 1.5;
  controls.maxDistance = 20;
  controls.update();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-3, 5, -5);
  scene.add(fillLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3e, roughness: 0.9, metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(40, 40, 0x3a3a5e, 0x2a2a4e);
  grid.position.y = 0.01;
  scene.add(grid);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Init post-processing pipeline
  postfx = new PostFX(renderer, scene, camera);

  // Init boss fight controller
  bossFight = new BossFight(scene, camera, { postfx, updateStatus });
}

// ════════════════════════════════════════════════════════════
// Model Loading
// ════════════════════════════════════════════════════════════
async function loadCharacterModel(raceConfig) {
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  overlay.classList.remove('hidden');
  loadingText.textContent = `Loading ${raceConfig.factionName} ${raceConfig.name}...`;

  // Clean up previous
  if (currentModel) {
    scene.remove(currentModel);
    if (skeletonHelper) { scene.remove(skeletonHelper); skeletonHelper = null; }
    mixer?.stopAllAction();
    mixer = null;
    currentActions = {};
    currentAction = null;
  }

  try {
    const fbx = await new Promise((resolve, reject) => {
      fbxLoader.load(raceConfig.model, resolve, (e) => {
        loadingText.textContent = `Loading... ${Math.floor((e.loaded / e.total) * 100)}%`;
      }, reject);
    });

    // Scale — FBX models from Unity are typically in cm, we need meters
    const box = new THREE.Box3().setFromObject(fbx);
    const height = box.max.y - box.min.y;
    const targetHeight = 2.0;
    const scale = targetHeight / height;
    fbx.scale.setScalar(scale);

    // Center on ground
    const scaledBox = new THREE.Box3().setFromObject(fbx);
    fbx.position.y = -scaledBox.min.y;
    fbx.position.x = -(scaledBox.min.x + scaledBox.max.x) / 2;
    fbx.position.z = -(scaledBox.min.z + scaledBox.max.z) / 2;

    // Enable shadows
    fbx.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { m.side = THREE.DoubleSide; });
        }
      }
    });

    scene.add(fbx);
    currentModel = fbx;

    // Setup AnimationMixer
    mixer = new THREE.AnimationMixer(fbx);
    if (fbx.animations?.length > 0) {
      fbx.animations.forEach(clip => {
        currentActions[clip.name] = mixer.clipAction(clip);
      });
    }

    // Equipment Manager
    equipMgr = new EquipmentManager(raceConfig.prefix);
    const slots = equipMgr.catalog(fbx);

    // Weapon Animation Controller — binds weapon equips to animation packs
    weaponCtrl = new WeaponAnimController(mixer, fbxLoader, updateStatus);
    weaponCtrl.onChange(() => buildHotbarUI());

    updateStatus(`Loaded ${raceConfig.name}: ${equipMgr.meshCount} equipment meshes found`);
    buildEquipmentUI(slots);
    buildHotbarUI();
    overlay.classList.add('hidden');

  } catch (err) {
    loadingText.textContent = `Error: ${err.message}`;
    updateStatus(`Failed to load model: ${err.message}`);
    console.error(err);
  }
}

// ════════════════════════════════════════════════════════════
// Animation Loading
// ════════════════════════════════════════════════════════════
async function loadAnimation(packKey, fileName) {
  const pack = WEAPON_ANIMATION_PACKS[packKey];
  if (!pack || !currentModel || !mixer) return;

  const url = pack.path + fileName;
  updateStatus(`Loading animation: ${fileName}`);

  try {
    const fbx = await new Promise((resolve, reject) => {
      fbxLoader.load(url, resolve, undefined, reject);
    });

    if (fbx.animations?.length > 0) {
      const clip = fbx.animations[0];
      clip.name = fileName.replace('.fbx', '').replace('.FBX', '');

      // Store and play
      if (currentActions[clip.name]) {
        currentActions[clip.name].stop();
      }
      const action = mixer.clipAction(clip, currentModel);
      currentActions[clip.name] = action;

      fadeToAction(clip.name);
      updateStatus(`Playing: ${clip.name}`);
      highlightAnimButton(clip.name);
    }
  } catch (err) {
    updateStatus(`Failed to load animation: ${err.message}`);
    console.error(err);
  }
}

function fadeToAction(name, duration = 0.2) {
  const nextAction = currentActions[name];
  if (!nextAction) return;

  nextAction.reset().play();
  nextAction.timeScale = parseFloat(document.getElementById('animSpeed').value) || 1.0;

  if (currentAction && currentAction !== nextAction) {
    currentAction.crossFadeTo(nextAction, duration, false);
  }
  currentAction = nextAction;
}

// ════════════════════════════════════════════════════════════
// UI Builders
// ════════════════════════════════════════════════════════════
function buildRaceSelector() {
  const container = document.getElementById('raceSelector');
  const races = getAllRaces();

  container.innerHTML = races.map(r => `
    <button class="faction-btn" data-faction="${r.factionId}" data-race="${r.raceId}">
      <span class="faction-dot" style="background:${r.factionColor}"></span>
      <span>${r.factionName} — ${r.name}</span>
    </button>
  `).join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.faction-btn');
    if (!btn) return;
    container.querySelectorAll('.faction-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const race = races.find(r => r.factionId === btn.dataset.faction && r.raceId === btn.dataset.race);
    if (race) {
      currentFactionId = race.factionId;
      currentRaceId = race.raceId;
      loadCharacterModel(race);
    }
  });
}

function buildEquipmentUI(slots) {
  const container = document.getElementById('equipmentPanel');
  const grouped = equipMgr.getGroupedSlots();

  let html = '';
  for (const [groupName, groupSlots] of Object.entries(grouped)) {
    const slotEntries = Object.entries(groupSlots);
    if (slotEntries.length === 0) continue;

    html += `<div class="slot-group"><h4>${groupName}</h4>`;
    for (const [slot, info] of slotEntries) {
      html += `<div class="slot-row"><span class="slot-label">${slot}</span>`;
      for (const variant of info.variants) {
        const label = variant === '_default' ? '●' : variant;
        const isEquipped = info.equipped === variant;
        html += `<button class="slot-btn ${isEquipped ? 'equipped' : ''}"
          data-slot="${slot}" data-variant="${variant}">${label}</button>`;
      }
      html += `<button class="slot-btn" data-slot="${slot}" data-variant="_none" title="Unequip">✕</button>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.slot-btn');
    if (!btn) return;
    const { slot, variant } = btn.dataset;

    if (variant === '_none') {
      equipMgr.unequip(slot);
      // If unequipping a weapon, sheath animations
      if (WEAPON_ANIM_MAP[slot] && weaponCtrl) {
        weaponCtrl.sheathWeapon();
      }
    } else {
      // Use equipWeapon for weapon/shield slots for mutual exclusion
      const isWeaponSlot = ['axe','hammer','sword','pick','spear','bow','staff','shield'].includes(slot);
      if (isWeaponSlot) {
        equipMgr.equipWeapon(slot, variant);
        // Auto-switch to weapon's animation pack
        if (WEAPON_ANIM_MAP[slot] && weaponCtrl && currentModel && mixer) {
          await weaponCtrl.equipWeapon(slot, WEAPON_ANIMATION_PACKS, currentModel);
          // Auto-select the animation pack in the dropdown
          const packSelect = document.getElementById('weaponPackSelect');
          if (packSelect) {
            packSelect.value = WEAPON_ANIM_MAP[slot].animPack;
            packSelect.dispatchEvent(new Event('change'));
          }
        }
      } else {
        equipMgr.equip(slot, variant);
      }
    }
    // Refresh UI
    buildEquipmentUI(equipMgr.getSlotSummary());
  });
}

function buildAnimationUI() {
  const select = document.getElementById('weaponPackSelect');
  for (const [key, pack] of Object.entries(WEAPON_ANIMATION_PACKS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = pack.name;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const pack = WEAPON_ANIMATION_PACKS[select.value];
    const list = document.getElementById('animList');
    if (!pack) { list.innerHTML = ''; return; }

    list.innerHTML = pack.files.map(f => {
      const label = f.replace('.fbx', '').replace('.FBX', '');
      return `<button class="anim-btn" data-pack="${select.value}" data-file="${f}" title="${label}">${label}</button>`;
    }).join('');
  });

  document.getElementById('animList').addEventListener('click', (e) => {
    const btn = e.target.closest('.anim-btn');
    if (!btn) return;
    loadAnimation(btn.dataset.pack, btn.dataset.file);
  });

  // Speed control
  document.getElementById('animSpeed').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('animSpeedVal').textContent = val.toFixed(1) + 'x';
    if (currentAction) currentAction.timeScale = val;
  });

  // Pause/Stop
  document.getElementById('animPause').addEventListener('click', () => {
    if (currentAction) {
      currentAction.paused = !currentAction.paused;
      document.getElementById('animPause').textContent = currentAction.paused ? '▶ Play' : '⏸ Pause';
    }
  });
  document.getElementById('animStop').addEventListener('click', () => {
    if (currentAction) { currentAction.stop(); currentAction = null; }
    document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('playing'));
  });
}

function highlightAnimButton(name) {
  document.querySelectorAll('.anim-btn').forEach(b => {
    b.classList.toggle('playing', b.textContent === name);
  });
}

// ════════════════════════════════════════════════════════════
// Stats Panel
// ════════════════════════════════════════════════════════════
function buildStatsPanel() {
  const container = document.getElementById('attributeSliders');
  container.innerHTML = ATTR_KEYS.map(key => {
    const attr = ATTRIBUTES[key];
    return `<div class="attr-row">
      <label style="color:${attr.color}" title="${attr.desc}">${attr.icon} ${key}</label>
      <input type="range" min="0" max="80" value="${character.attrs[key]}" data-attr="${key}">
      <span class="val" data-val="${key}">${character.attrs[key]}</span>
    </div>`;
  }).join('');

  container.addEventListener('input', (e) => {
    const slider = e.target.closest('input[data-attr]');
    if (!slider) return;
    const key = slider.dataset.attr;
    character.attrs[key] = parseInt(slider.value);
    document.querySelector(`[data-val="${key}"]`).textContent = slider.value;
    recalcStats();
  });

  recalcStats();
}

function recalcStats() {
  const total = ATTR_KEYS.reduce((sum, k) => sum + (character.attrs[k] || 0), 0);
  document.getElementById('pointsDisplay').textContent = `${total} / ${MAX_POINTS}`;
  document.getElementById('pointsDisplay').style.color = total > MAX_POINTS ? '#ef4444' : total === MAX_POINTS ? '#6ee7b7' : '#e8eaf6';

  character.stats = calculateDerivedStats(character.attrs, character.level);

  const statsEl = document.getElementById('derivedStats');
  const statLabels = {
    meleeAttack: 'Melee ATK', rangedAttack: 'Ranged ATK', spellPower: 'Spell Power',
    attackSpeed: 'ATK Speed', critChance: 'Crit %', critDamage: 'Crit DMG %',
    maxHP: 'Max HP', maxMana: 'Max Mana', maxStamina: 'Max Stam',
    defense: 'Defense', magicResist: 'Magic Res', blockChance: 'Block %',
    blockFactor: 'Block Factor', dodgeChance: 'Dodge %',
    hpRegen: 'HP/s', manaRegen: 'Mana/s', staminaRegen: 'Stam/s',
    moveSpeed: 'Move Spd', combatPower: 'Combat Pwr',
  };

  statsEl.innerHTML = Object.entries(statLabels).map(([key, label]) => {
    const val = character.stats[key] ?? 0;
    return `<div class="stat-item"><span class="label">${label}</span><span class="value">${typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}</span></div>`;
  }).join('');
}

// Combat test
function setupCombatTest() {
  const dummy = createDefaultCharacter(10);
  // Dummy has even stats but lower
  ATTR_KEYS.forEach(k => dummy.attrs[k] = 15);
  dummy.stats = calculateDerivedStats(dummy.attrs, 10);

  document.getElementById('combatTestBtn').addEventListener('click', () => {
    const result = simulateCombat(character, dummy);
    const logEl = document.getElementById('combatLog');
    logEl.innerHTML = result.log.map(line => {
      if (line.includes('CRITICAL')) return `<div class="crit">${line}</div>`;
      if (line.includes('BLOCKED')) return `<div class="block">${line}</div>`;
      return `<div>${line}</div>`;
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  });
}

// ════════════════════════════════════════════════════════════
// Admin Panel
// ════════════════════════════════════════════════════════════
function setupAdminPanel() {
  // Toggle wireframe
  document.getElementById('toggleWireframe').addEventListener('click', () => {
    wireframeMode = !wireframeMode;
    currentModel?.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { m.wireframe = wireframeMode; });
      }
    });
    updateStatus(`Wireframe: ${wireframeMode ? 'ON' : 'OFF'}`);
  });

  // Toggle skeleton helper
  document.getElementById('toggleSkeleton').addEventListener('click', () => {
    if (skeletonHelper) {
      scene.remove(skeletonHelper);
      skeletonHelper = null;
    } else if (currentModel) {
      let skeleton = null;
      currentModel.traverse(c => { if (c.isSkinnedMesh && !skeleton) skeleton = c; });
      if (skeleton) {
        skeletonHelper = new SkeletonHelper(currentModel);
        scene.add(skeletonHelper);
      }
    }
  });

  // Show all equipment
  document.getElementById('showAllParts').addEventListener('click', () => {
    if (equipMgr) {
      equipMgr.showAll();
      buildEquipmentUI(equipMgr.getSlotSummary());
      updateStatus('All equipment visible');
    }
  });

  // Reset camera
  document.getElementById('resetCamera').addEventListener('click', () => {
    camera.position.set(0, 2.5, 5);
    controls.target.set(0, 1, 0);
    controls.update();
  });

  // Spawn test dummy
  document.getElementById('spawnDummy').addEventListener('click', () => {
    const geo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.6 });
    const dummy = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 3;
    dummy.position.set(Math.cos(angle) * dist, 0.9, Math.sin(angle) * dist);
    dummy.castShadow = true;
    scene.add(dummy);
    dummies.push(dummy);
    updateStatus(`Spawned dummy (${dummies.length} total)`);
  });

  // Toggle PostFX
  const pfxBtn = document.getElementById('togglePostFX');
  if (pfxBtn) pfxBtn.addEventListener("click", () => {
    if (postfx) {
      const on = postfx.toggle();
      updateStatus("Post-processing: " + (on ? "ON" : "OFF"));
    }
  });

  // Boss Fight button
  const bossBtn = document.getElementById('startBossFight');
  if (bossBtn) bossBtn.addEventListener("click", async () => {
    if (!bossFight) return;
    if (bossFight.isActive) {
      bossFight.exit();
    } else {
      if (!currentModel) { updateStatus("Load a character first!"); return; }
      await bossFight.enter(currentModel, mixer);
    }
  });

  // List bones (debug)
  const bonesBtn = document.getElementById('listBones');
  if (bonesBtn) bonesBtn.addEventListener("click", () => {
    if (!currentModel) return;
    const bones = BoneAttachment.listBones(currentModel);
    console.log("Bones:", bones);
    updateStatus(bones.length + " bones — see console");
  });
}

// ════════════════════════════════════════════════════════════
// Utility
// ════════════════════════════════════════════════════════════
function updateStatus(msg) {
  document.getElementById('statusBar').textContent = msg;
}

// ════════════════════════════════════════════════════════════
// Render Loop
// ════════════════════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  controls.update();
  if (mixer) mixer.update(dt);

  // Boss fight update
  if (bossFight && bossFight.isActive) {
    bossFight.update(dt, currentModel);
  }

  // Render via PostFX pipeline (falls back to direct render when disabled)
  if (postfx) {
    postfx.update(dt);
  } else {
    renderer.render(scene, camera);
  }
}

// ════════════════════════════════════════════════════════════
// Tab System
// ════════════════════════════════════════════════════════════
function setupTabs() {
  const tabBar = document.getElementById('mainTabBar');
  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tabId = btn.dataset.tab;
    tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#rightPanel .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
  });
}

// ════════════════════════════════════════════════════════════
// Class Skills Tab
// ════════════════════════════════════════════════════════════
let selectedClass = null;

function buildClassSelector() {
  const container = document.getElementById('classSelector');
  container.innerHTML = Object.entries(CLASSES).map(([id, cls]) => `
    <div class="class-card" data-class="${id}">
      <div class="class-header">
        <span style="color:${cls.color}">${cls.icon}</span>
        <span style="color:${cls.color}">${cls.name}</span>
        <span style="font-size:.6rem;color:var(--muted);margin-left:auto;">${cls.primaryAttr}/${cls.secondaryAttr}</span>
      </div>
      <div class="class-desc">${cls.desc}</div>
    </div>
  `).join('');

  container.addEventListener('click', (e) => {
    const card = e.target.closest('.class-card');
    if (!card) return;
    selectedClass = card.dataset.class;
    container.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    buildClassSkillTrees(selectedClass);
  });
}

function buildClassSkillTrees(classId) {
  const container = document.getElementById('classSkillTrees');
  const classData = CLASS_SKILLS[classId];
  if (!classData) { container.innerHTML = ''; return; }

  const cls = CLASSES[classId];
  let html = `<p style="font-size:.7rem;color:var(--muted);margin-bottom:6px;">${cls.passive}</p>`;
  html += `<p style="font-size:.65rem;color:var(--muted);margin-bottom:8px;">Weapons: ${cls.weaponTypes.map(w => WEAPON_TYPES[w]?.name || w).join(', ')}</p>`;

  for (const [treeId, tree] of Object.entries(classData.trees)) {
    html += `<div class="tree-section">`;
    html += `<div class="tree-header">${tree.icon} ${tree.name} <span style="font-size:.6rem;color:var(--muted);margin-left:auto;">${tree.desc}</span></div>`;
    for (const skill of tree.skills) {
      const modelBadge = skill.model ? ' <span style="color:#fbbf24;font-size:.6rem;">[3D]</span>' : '';
      html += `<div class="skill-node">
        <span class="skill-lvl">Lv${skill.level}</span>
        <span class="skill-name">${skill.name}${modelBadge}</span>
        <span class="skill-cost">${skill.cost}pt</span>
        <div class="skill-desc">${skill.desc}${skill.model ? '<br><em style="color:#fbbf24;">Has 3D form model</em>' : ''}</div>
      </div>`;
    }
    html += `</div>`;
  }

  // Show Worge forms preview if Worge class
  if (classId === 'worge') {
    html += `<h3 style="margin-top:10px;">Form Models</h3>`;
    for (const [fid, form] of Object.entries(WORGE_FORMS)) {
      const hasModel = form.model ? '\u2705' : '\u274c';
      html += `<div class="skill-node">
        <span class="skill-lvl">${form.icon}</span>
        <span class="skill-name">${form.name} ${hasModel}</span>
        <div class="skill-desc">${form.desc}</div>
      </div>`;
    }
  }

  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// Weapon Skills Tab
// ════════════════════════════════════════════════════════════
function buildWeaponTypeGrid() {
  const grid = document.getElementById('weaponTypeGrid');
  grid.innerHTML = Object.entries(WEAPON_TYPES).map(([id, wep]) =>
    `<button class="wep-type-btn" data-wep="${id}" title="${wep.name}">${wep.icon}<br>${wep.name.split(' ').pop()}</button>`
  ).join('');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.wep-type-btn');
    if (!btn) return;
    grid.querySelectorAll('.wep-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildWeaponSkillTree(btn.dataset.wep);
  });
}

function buildWeaponSkillTree(weaponId) {
  const container = document.getElementById('weaponSkillTree');
  const wepData = WEAPON_SKILLS[weaponId];
  const wepType = WEAPON_TYPES[weaponId];
  if (!wepData) { container.innerHTML = ''; return; }

  let html = `<p style="font-size:.65rem;color:var(--muted);margin-bottom:6px;">Classes: ${wepType.classes.map(c => CLASSES[c]?.name || c).join(', ')} • ${wepType.hand.toUpperCase()}</p>`;
  html += `<div class="tree-section">`;
  html += `<div class="tree-header">${wepData.icon} ${wepData.name} Skill Tree</div>`;
  for (const skill of wepData.skills) {
    html += `<div class="skill-node">
      <span class="skill-lvl">Lv${skill.level}</span>
      <span class="skill-name">${skill.name}</span>
      <span class="skill-cost" style="color:var(--muted);">${skill.bonus}</span>
      <div class="skill-desc">${skill.desc}</div>
    </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// Professions Tab
// ════════════════════════════════════════════════════════════
function buildProfessionsPanel() {
  const container = document.getElementById('professionsList');
  container.innerHTML = Object.entries(PROFESSIONS).map(([id, prof]) => {
    const tiers = prof.tiers.map(t =>
      `<div class="prof-tier">
        <span class="tier-lvl">Lv${t.level}</span>
        <span class="tier-name">${t.name}</span>
        <span class="tier-res">${t.resources.join(', ')}</span>
      </div>`
    ).join('');
    return `<div class="prof-card">
      <div class="prof-header">
        <span>${prof.icon}</span>
        <span style="color:${prof.color}">${prof.name}</span>
        <span style="font-size:.6rem;color:var(--muted);margin-left:auto;">Bonus: ${prof.attr}</span>
      </div>
      <p style="font-size:.65rem;color:var(--muted);margin-bottom:4px;">${prof.desc}</p>
      ${tiers}
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════
// Weapon Mastery Tab
// ════════════════════════════════════════════════════════════
function buildMasteryPanel() {
  const container = document.getElementById('masteryList');
  // Simulated mastery XP per weapon (in real game, this comes from server)
  const simulatedXP = {};
  for (const id of Object.keys(WEAPON_TYPES)) {
    simulatedXP[id] = Math.floor(Math.random() * 15000);
  }

  container.innerHTML = Object.entries(WEAPON_TYPES).map(([id, wep]) => {
    const xp = simulatedXP[id];
    const { current, next, progress } = getMasteryProgress(xp);
    const pct = Math.floor(progress * 100);
    const nextLabel = next ? `${next.name} (${next.xp} XP)` : 'MAX';
    return `<div class="mastery-row">
      <span class="mastery-icon">${wep.icon}</span>
      <div class="mastery-info">
        <div class="mastery-name">${wep.name}</div>
        <div class="mastery-tier">${current.name} — ${current.bonus}</div>
        <div class="mastery-bar"><div class="mastery-fill" style="width:${pct}%"></div></div>
      </div>
      <span class="mastery-xp">${xp} XP</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════
// Persistence UI
// ════════════════════════════════════════════════════════════
function buildSavedCharactersList() {
  const container = document.getElementById('savedCharactersList');
  const countEl = document.getElementById('charCount');
  const chars = characterStore.characters;
  countEl.textContent = `(${chars.length})`;

  if (chars.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:.8rem;">No saved characters yet</p>';
    return;
  }

  container.innerHTML = chars.map(c => `
    <div class="saved-char ${c.id === characterStore.activeId ? 'active' : ''}" data-id="${c.id}">
      <span class="char-name">${c.name}</span>
      <span class="char-race">${c.factionId}/${c.raceId}</span>
      <span class="char-delete" data-delete="${c.id}" title="Delete">✕</span>
    </div>
  `).join('');

  container.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-delete]');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.delete;
      if (confirm('Delete this character?')) {
        await characterStore.remove(id);
        updateStatus('Character deleted');
      }
      return;
    }
    const row = e.target.closest('.saved-char');
    if (!row) return;
    const id = row.dataset.id;
    characterStore.setActive(id);
    loadSavedCharacter(id);
  });
}

function loadSavedCharacter(id) {
  const char = characterStore.characters.find(c => c.id === id);
  if (!char) return;

  const races = getAllRaces();
  const race = races.find(r => r.factionId === char.factionId && r.raceId === char.raceId);
  if (!race) {
    updateStatus(`Race ${char.factionId}/${char.raceId} not found`);
    return;
  }

  // Restore faction/race
  currentFactionId = char.factionId;
  currentRaceId = char.raceId;

  // Highlight the race button
  document.querySelectorAll('.faction-btn').forEach(b => {
    b.classList.toggle('active',
      b.dataset.faction === char.factionId && b.dataset.race === char.raceId);
  });

  // Restore attributes
  if (char.attrs) {
    for (const key of ATTR_KEYS) {
      if (char.attrs[key] !== undefined) {
        character.attrs[key] = char.attrs[key];
        const slider = document.querySelector(`input[data-attr="${key}"]`);
        if (slider) slider.value = char.attrs[key];
        const valEl = document.querySelector(`[data-val="${key}"]`);
        if (valEl) valEl.textContent = char.attrs[key];
      }
    }
    character.level = char.level || 1;
    recalcStats();
  }

  // Load model and restore equipment after load
  loadCharacterModel(race).then(() => {
    if (char.equipped && equipMgr) {
      for (const [slot, variant] of Object.entries(char.equipped)) {
        equipMgr.equip(slot, variant);
      }
      buildEquipmentUI(equipMgr.getSlotSummary());
    }
    updateStatus(`Loaded: ${char.name}`);
    document.getElementById('updateBuildBtn').style.display = '';
  });
}

function getEditorState() {
  return {
    factionId: currentFactionId,
    raceId: currentRaceId,
    equipped: equipMgr ? { ...equipMgr.equipped } : {},
    attrs: { ...character.attrs },
    level: character.level,
  };
}

function setupPersistence() {
  // Save button
  document.getElementById('saveBuildBtn').addEventListener('click', async () => {
    if (!currentFactionId || !currentRaceId) {
      updateStatus('Select a race first');
      return;
    }
    const name = prompt('Character name:', `Character ${characterStore.characters.length + 1}`);
    if (name === null) return;

    const state = getEditorState();
    state.name = name;
    await characterStore.save(state);
    document.getElementById('updateBuildBtn').style.display = '';
    updateStatus(`Saved: ${name}`);
  });

  // Update button
  document.getElementById('updateBuildBtn').addEventListener('click', async () => {
    if (!characterStore.activeId) return;
    const state = getEditorState();
    await characterStore.update(state);
    updateStatus('Build updated');
  });

  // React to store changes
  characterStore.addEventListener('change', () => buildSavedCharactersList());
  characterStore.addEventListener('error', (e) => updateStatus(`Error: ${e.detail?.message || 'Unknown'}`));
}

async function initPersistence() {
  try {
    const user = await apiClient.ensureAuth();
    document.getElementById('userDisplay').textContent = user.displayName || user.grudgeId || '';
    await characterStore.load();
    buildSavedCharactersList();
  } catch (err) {
    console.error('Persistence init failed (offline mode):', err);
    document.getElementById('savedCharactersList').innerHTML =
      '<p style="color:var(--muted);font-size:.8rem;">Offline — save unavailable</p>';
  }
}

// ════════════════════════════════════════════════════════════
// Boot
// ════════════════════════════════════════════════════════════
initScene();
buildRaceSelector();
buildAnimationUI();
buildStatsPanel();
setupCombatTest();
setupAdminPanel();
setupTabs();
buildClassSelector();
buildWeaponTypeGrid();
buildProfessionsPanel();
buildMasteryPanel();
setupCombatHotkeys();
setupPersistence();
animate();
updateStatus('Ready — select a faction race to load');
initPersistence();

// ════════════════════════════════════════════════════════════
// Combat Hotkeys & Hotbar
// ════════════════════════════════════════════════════════════
function setupCombatHotkeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target !== document.body) return;
    if (!weaponCtrl) return;

    switch (e.code) {
      case 'Digit1': weaponCtrl.triggerAction('slot1'); break;
      case 'Digit2': weaponCtrl.triggerAction('slot2'); break;
      case 'Digit3': weaponCtrl.triggerAction('slot3'); break;
      case 'Digit4': weaponCtrl.triggerAction('slot4'); break;
      case 'KeyQ':   weaponCtrl.triggerAction('block'); break;
      case 'KeyE':   weaponCtrl.triggerAction('dodge'); break;
      case 'KeyZ':   // Z-key combat mechanic
        updateStatus('⚡ Battle Cry!');
        weaponCtrl.triggerAction('slot4');
        break;
      case 'Tab':
        e.preventDefault();
        weaponCtrl.toggleMode();
        buildHotbarUI();
        break;
      case 'KeyX':
        weaponCtrl.sheathWeapon();
        buildHotbarUI();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyQ' && weaponCtrl) {
      weaponCtrl.releaseBlock();
    }
  });
}

function buildHotbarUI() {
  const container = document.getElementById('hotbarDisplay');
  if (!container) return;

  if (!weaponCtrl || !weaponCtrl.equippedWeaponType) {
    container.innerHTML = '<p style="color:var(--muted);font-size:.7rem;">Equip a weapon to see hotbar</p>';
    return;
  }

  const hotbar = weaponCtrl.getHotbar();
  if (!hotbar) { container.innerHTML = ''; return; }

  const modeLabel = weaponCtrl.mode === 'combat' ? '⚔️ Combat' : '🪨 Harvest';
  const stateLabel = weaponCtrl.state;
  const wpnName = WEAPON_TYPES[weaponCtrl.equippedWeaponType]?.name || weaponCtrl.equippedWeaponType;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:.7rem;color:var(--accent);">${wpnName}</span>
      <span style="font-size:.6rem;color:var(--muted);">${modeLabel} • ${stateLabel}</span>
      <span style="font-size:.6rem;color:var(--muted);margin-left:auto;">Tab=mode X=sheath</span>
    </div>
    <div style="display:flex;gap:3px;">
      ${['slot1','slot2','slot3','slot4'].map((key, i) => {
        const a = hotbar[key];
        return `<button class="action-btn" onclick="window._wc?.triggerAction('${key}')" style="flex:1;font-size:.65rem;" title="Key ${i+1}">
          <b>${i+1}</b> ${a?.name || '—'}
        </button>`;
      }).join('')}
      <button class="action-btn" onclick="window._wc?.triggerAction('block')" style="font-size:.65rem;" title="Hold Q">
        Q ${hotbar.block?.name || 'Block'}
      </button>
      <button class="action-btn" onclick="window._wc?.triggerAction('dodge')" style="font-size:.65rem;" title="E">
        E ${hotbar.dodge?.name || 'Dodge'}
      </button>
    </div>
  `;

  // Expose controller for hotbar button onclick
  window._wc = weaponCtrl;
}
