/**
 * BossFight — Souls-like boss fight test arena.
 *
 * Loads the scary_forest map, spawns the Yin Bing Li Shi (Black Myth Wukong) boss,
 * and wires the player character into a third-person souls-like combat loop:
 * - W/A/S/D movement relative to camera
 * - Left-click light attack, right-click heavy attack
 * - Q block, E dodge roll, Space jump
 * - Tab lock-on target
 * - Boss AI cycles through 42 attack/idle animations
 * - Health bars, stamina, damage flash on hit
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationBlender } from './AnimationBlender.js';

// ── Boss Animation Mapping ──────────────────────────────────
// Categorize the 42 boss animations by purpose
const BOSS_ANIMS = {
  // Attacks (8 combo attacks)
  attacks: [
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_01',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_02',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_03',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_04',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_05',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_06',
    'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_07',
  ],
  // Multi-phase attack (start → loop → end)
  chargedAttack: {
    start: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_08_start',
    loop:  'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_08_loop',
    end:   'SK_HYS_HuiJing|AS_HYS_HuiJing_Atk_08_end',
  },
  // Idles
  idle:       'SK_HYS_HuiJing|AS_HYS_HuiJing_Idle_01',
  battleIdle: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Bidle_01',
  battleIdle2:'SK_HYS_HuiJing|AS_HYS_HuiJing_Bidle_02',
  battleIdle3:'SK_HYS_HuiJing|AS_HYS_HuiJing_Bidle_03',
  stance:     'SK_HYS_HuiJing|AS_HYS_HuiJing_Bstd_01',
  // Hit reactions
  hitFrontLeft:  'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl1_df_hl',
  hitFrontRight: 'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl1_df_hr',
  hitBack:       'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl1_db_hb',
  // Stagger (heavier hits)
  staggerFrontLeft:  'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl2_df_hl',
  staggerFrontRight: 'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl2_df_hr',
  staggerBack:       'SK_HYS_HuiJing|AS_HYS_HuiJing_bh_dep01_sl2_db_hb',
  // Death
  death: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Die_Gen_01',
  // Enter (cinematic)
  enter1: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Enter_01',
  enter2: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Enter_02',
  // Counter
  counter: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Ct_01',
  // Turns
  turnL1: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Turn_L_01',
  turnR1: 'SK_HYS_HuiJing|AS_HYS_HuiJing_Turn_R_01',
  // Collapse
  collapse: 'SK_HYS_HuiJing|AS_HYS_HuiJing_TanDao_01',
  // Engage stances
  engageFront: 'SK_HYS_HuiJing|AS_HYS_HuiJing_JieZhan_F_01',
  engageBack:  'SK_HYS_HuiJing|AS_HYS_HuiJing_JieZhan_B_01',
};

// ── Boss AI States ──────────────────────────────────────────
const BOSS_STATE = {
  ENTERING: 'entering',
  IDLE: 'idle',
  ATTACKING: 'attacking',
  RECOVERING: 'recovering',
  HIT: 'hit',
  DEAD: 'dead',
};

export class BossFight {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {object} deps - { postfx, updateStatus }
   */
  constructor(scene, camera, deps = {}) {
    this.scene = scene;
    this.camera = camera;
    this.postfx = deps.postfx || null;
    this.updateStatus = deps.updateStatus || (() => {});

    this.active = false;
    this.gltfLoader = new GLTFLoader();

    // ── Arena ──
    this.arenaGroup = new THREE.Group();
    this.arenaGroup.name = 'BossFightArena';

    // ── Boss ──
    this.bossModel = null;
    this.bossMixer = null;
    this.bossBlender = null;
    this.bossState = BOSS_STATE.IDLE;
    this.bossHP = 1000;
    this.bossMaxHP = 1000;
    this.bossStateTimer = 0;
    this.bossComboIndex = 0;

    // ── Player combat state ──
    this.playerHP = 200;
    this.playerMaxHP = 200;
    this.playerStamina = 100;
    this.playerMaxStamina = 100;
    this.playerBlocking = false;
    this.playerDodging = false;
    this.playerDodgeTimer = 0;
    this.playerAttacking = false;
    this.lockedOn = false;

    // ── Movement ──
    this.keys = {};
    this.playerVelocity = new THREE.Vector3();
    this.moveSpeed = 5;
    this.dodgeSpeed = 12;

    // ── UI elements (created dynamically) ──
    this.uiContainer = null;

    // ── Stored scene state for cleanup ──
    this._savedFog = null;
    this._savedBg = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  /**
   * Enter the boss fight arena. Loads map + boss, sets up controls.
   * @param {THREE.Object3D} playerModel - the currently loaded character model
   * @param {THREE.AnimationMixer} playerMixer
   */
  async enter(playerModel, playerMixer) {
    this.updateStatus('Loading boss arena...');
    this.active = true;

    // Save scene state
    this._savedFog = this.scene.fog;
    this._savedBg = this.scene.background;

    // Dark, moody atmosphere
    this.scene.fog = new THREE.FogExp2(0x0a0a12, 0.04);
    this.scene.background = new THREE.Color(0x0a0a12);

    // Add arena lighting
    this._setupArenaLighting();

    this.scene.add(this.arenaGroup);

    // Load map and boss in parallel
    await Promise.all([
      this._loadForestMap(),
      this._loadBoss(),
    ]);

    // Position player at arena center
    if (playerModel) {
      playerModel.position.set(0, 0, 3);
    }

    // Position boss facing player
    if (this.bossModel) {
      this.bossModel.lookAt(0, 0, 3);
    }

    // Lock on to boss
    if (this.postfx && this.bossModel) {
      this.postfx.setTargets([this.bossModel]);
      this.postfx.setOutlineColor(0xff2222);
      this.postfx.setEnabled(true);
      this.postfx.setBloom(0.8, 0.3, 0.8);
    }

    // Setup controls
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    // Create HUD
    this._createHUD();

    // Play boss entrance
    this._setBossState(BOSS_STATE.ENTERING);

    this.updateStatus('⚔️ BOSS FIGHT — Yin Bing Li Shi');
  }

  /**
   * Exit the boss fight, clean up.
   */
  exit() {
    this.active = false;

    // Remove arena
    this.scene.remove(this.arenaGroup);
    this.arenaGroup.clear();

    // Dispose boss
    if (this.bossModel) {
      this.bossModel.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => m.dispose());
        }
      });
      this.bossModel = null;
      this.bossMixer = null;
      this.bossBlender?.dispose();
      this.bossBlender = null;
    }

    // Restore scene
    this.scene.fog = this._savedFog;
    this.scene.background = this._savedBg;

    // Remove controls
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);

    // Remove HUD
    if (this.uiContainer) {
      this.uiContainer.remove();
      this.uiContainer = null;
    }

    if (this.postfx) {
      this.postfx.clearTargets();
    }

    // Reset player state
    this.playerHP = this.playerMaxHP;
    this.playerStamina = this.playerMaxStamina;
    this.bossHP = this.bossMaxHP;

    this.updateStatus('Exited boss arena');
  }

  // ═══════════════════════════════════════════════════════════
  // Update (call every frame when active)
  // ═══════════════════════════════════════════════════════════

  /**
   * @param {number} dt - delta time
   * @param {THREE.Object3D} playerModel
   */
  update(dt, playerModel) {
    if (!this.active) return;

    // Update boss mixer
    if (this.bossMixer) this.bossMixer.update(dt);

    // Boss AI
    this._updateBossAI(dt, playerModel);

    // Player movement
    this._updatePlayerMovement(dt, playerModel);

    // Stamina regen
    if (!this.playerBlocking && !this.playerDodging) {
      this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + 15 * dt);
    }

    // Dodge timer
    if (this.playerDodging) {
      this.playerDodgeTimer -= dt;
      if (this.playerDodgeTimer <= 0) this.playerDodging = false;
    }

    // Update HUD
    this._updateHUD();
  }

  // ═══════════════════════════════════════════════════════════
  // Asset Loading
  // ═══════════════════════════════════════════════════════════

  /** @private */
  async _loadForestMap() {
    try {
      const gltf = await this._loadGLTF('environment/scary_forest/scene.gltf');
      const map = gltf.scene;

      // Scale and position the forest
      const box = new THREE.Box3().setFromObject(map);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 30 / maxDim; // Scale to ~30 units wide
      map.scale.setScalar(scale);
      map.position.y = -0.1;

      // Enable shadows
      map.traverse(child => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.castShadow = true;
        }
      });

      map.name = 'ForestMap';
      this.arenaGroup.add(map);
      this.updateStatus('Forest map loaded');
    } catch (err) {
      console.error('Failed to load forest map:', err);
      this.updateStatus('Map load failed — using flat arena');
      this._createFallbackArena();
    }
  }

  /** @private */
  async _loadBoss() {
    try {
      const gltf = await this._loadGLTF('environment/boss_wukong/scene.gltf');
      this.bossModel = gltf.scene;

      // Scale boss — should be imposing, ~3.5m tall
      const box = new THREE.Box3().setFromObject(this.bossModel);
      const height = box.max.y - box.min.y;
      const bossScale = 3.5 / height;
      this.bossModel.scale.setScalar(bossScale);

      // Center on ground
      const scaledBox = new THREE.Box3().setFromObject(this.bossModel);
      this.bossModel.position.y = -scaledBox.min.y;
      this.bossModel.position.z = -4;

      // Shadows
      this.bossModel.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.bossModel.name = 'Boss_YinBingLiShi';
      this.arenaGroup.add(this.bossModel);

      // Setup animation
      this.bossMixer = new THREE.AnimationMixer(this.bossModel);
      this.bossBlender = new AnimationBlender(this.bossMixer, this.bossModel);

      // Register all 42 animations
      if (gltf.animations?.length > 0) {
        for (const clip of gltf.animations) {
          // Register attacks as one-shot, idles as looping
          const isAttack = clip.name.includes('Atk_') && !clip.name.includes('_loop');
          const isHit = clip.name.includes('_bh_') || clip.name.includes('Die') || clip.name.includes('TanDao');
          const isOneShot = isAttack || isHit || clip.name.includes('Enter') || clip.name.includes('Ct_');
          this.bossBlender.register(clip.name, clip, {
            loop: !isOneShot,
            clampWhenFinished: isOneShot,
          });
        }
      }

      this.updateStatus(`Boss loaded: ${gltf.animations?.length || 0} animations`);
    } catch (err) {
      console.error('Failed to load boss:', err);
      this.updateStatus('Boss load failed: ' + err.message);
    }
  }

  /** @private */
  _loadGLTF(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }

  /** @private */
  _createFallbackArena() {
    // Simple dark arena floor
    const geo = new THREE.CircleGeometry(15, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, roughness: 0.9, metalness: 0.1,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.arenaGroup.add(floor);
  }

  // ═══════════════════════════════════════════════════════════
  // Arena Lighting
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _setupArenaLighting() {
    // Dim ambient — dark souls atmosphere
    const ambient = new THREE.AmbientLight(0x151525, 0.3);
    ambient.name = 'bossAmbient';
    this.arenaGroup.add(ambient);

    // Moonlight — cold blue directional
    const moon = new THREE.DirectionalLight(0x4466aa, 0.8);
    moon.position.set(-5, 15, 5);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 40;
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 15;
    moon.shadow.camera.bottom = -15;
    moon.name = 'bossMoon';
    this.arenaGroup.add(moon);

    // Boss spotlight — red-orange ominous glow
    const bossSpot = new THREE.SpotLight(0xff4422, 2, 20, Math.PI / 6, 0.5, 1);
    bossSpot.position.set(0, 8, -4);
    bossSpot.target.position.set(0, 0, -4);
    bossSpot.castShadow = true;
    bossSpot.name = 'bossSpotlight';
    this.arenaGroup.add(bossSpot);
    this.arenaGroup.add(bossSpot.target);

    // Rim lights for player visibility
    const rim1 = new THREE.PointLight(0x6688cc, 0.5, 15);
    rim1.position.set(5, 3, 5);
    this.arenaGroup.add(rim1);

    const rim2 = new THREE.PointLight(0x6688cc, 0.5, 15);
    rim2.position.set(-5, 3, 5);
    this.arenaGroup.add(rim2);
  }

  // ═══════════════════════════════════════════════════════════
  // Boss AI
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _updateBossAI(dt, playerModel) {
    if (!this.bossBlender || this.bossState === BOSS_STATE.DEAD) return;

    this.bossStateTimer -= dt;

    // Face player
    if (playerModel && this.bossModel && this.bossState !== BOSS_STATE.ENTERING) {
      const toPlayer = new THREE.Vector3()
        .subVectors(playerModel.position, this.bossModel.position);
      toPlayer.y = 0;
      if (toPlayer.lengthSq() > 0.01) {
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          toPlayer.normalize()
        );
        this.bossModel.quaternion.slerp(targetQuat, dt * 3);
      }
    }

    switch (this.bossState) {
      case BOSS_STATE.ENTERING:
        if (this.bossStateTimer <= 0) {
          this.bossBlender.crossFadeTo(BOSS_ANIMS.enter1, 0.1);
          this._setBossState(BOSS_STATE.IDLE, 3.0);
        }
        break;

      case BOSS_STATE.IDLE:
        if (this.bossStateTimer <= 0) {
          // Decide: attack or reposition
          const dist = playerModel
            ? this.bossModel.position.distanceTo(playerModel.position) : 10;

          if (dist < 6) {
            // Attack!
            this._bossAttack();
          } else {
            // Idle taunt / stance
            const taunts = [BOSS_ANIMS.battleIdle, BOSS_ANIMS.battleIdle2, BOSS_ANIMS.stance];
            const pick = taunts[Math.floor(Math.random() * taunts.length)];
            this.bossBlender.crossFadeTo(pick, 0.3);
            this._setBossState(BOSS_STATE.IDLE, 1.5 + Math.random() * 2);
          }
        }
        break;

      case BOSS_STATE.ATTACKING:
        if (this.bossStateTimer <= 0) {
          // Recovery after attack
          this.bossBlender.crossFadeTo(BOSS_ANIMS.battleIdle, 0.3);
          this._setBossState(BOSS_STATE.RECOVERING, 0.8 + Math.random() * 0.5);
        }
        break;

      case BOSS_STATE.RECOVERING:
        if (this.bossStateTimer <= 0) {
          this._setBossState(BOSS_STATE.IDLE, 0.5 + Math.random());
        }
        break;

      case BOSS_STATE.HIT:
        if (this.bossStateTimer <= 0) {
          this._setBossState(BOSS_STATE.IDLE, 0.3);
        }
        break;
    }

    // Check boss attack hitbox
    if (this.bossState === BOSS_STATE.ATTACKING && playerModel) {
      const dist = this.bossModel.position.distanceTo(playerModel.position);
      if (dist < 3.5 && this.bossStateTimer < 0.5 && this.bossStateTimer > 0.1) {
        this._playerTakeHit(25 + Math.random() * 15);
      }
    }
  }

  /** @private */
  _bossAttack() {
    // Pick from the 7 combo attacks, cycling through them
    const attack = BOSS_ANIMS.attacks[this.bossComboIndex % BOSS_ANIMS.attacks.length];
    this.bossComboIndex++;

    this.bossBlender.playOnce(attack, 0.15);
    this._setBossState(BOSS_STATE.ATTACKING, 1.2 + Math.random() * 0.8);
  }

  /** @private */
  _setBossState(state, duration = 1) {
    this.bossState = state;
    this.bossStateTimer = duration;
  }

  // ═══════════════════════════════════════════════════════════
  // Player Combat
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _playerTakeHit(damage) {
    // I-frames during dodge
    if (this.playerDodging) return;

    // Blocking reduces damage
    if (this.playerBlocking && this.playerStamina > 10) {
      damage *= 0.2; // 80% reduction
      this.playerStamina -= 20;
    }

    this.playerHP = Math.max(0, this.playerHP - damage);

    // Damage flash
    if (this.postfx) {
      this.postfx.triggerDamageFlash(0.5);
    }

    if (this.playerHP <= 0) {
      this.updateStatus('💀 YOU DIED');
      // Could trigger death animation / respawn here
    }
  }

  /**
   * Player attacks the boss.
   * @param {string} type - 'light' or 'heavy'
   */
  playerAttackBoss(type = 'light') {
    if (!this.bossModel || this.bossState === BOSS_STATE.DEAD) return;
    if (this.playerStamina < 15) return;

    this.playerStamina -= type === 'heavy' ? 30 : 15;
    const damage = type === 'heavy' ? 40 + Math.random() * 20 : 15 + Math.random() * 10;

    this.bossHP = Math.max(0, this.bossHP - damage);

    // Boss hit reaction
    if (this.bossState !== BOSS_STATE.ATTACKING) {
      const hitAnims = [BOSS_ANIMS.hitFrontLeft, BOSS_ANIMS.hitFrontRight];
      const pick = hitAnims[Math.floor(Math.random() * hitAnims.length)];
      this.bossBlender?.playOnce(pick, 0.1);
      this._setBossState(BOSS_STATE.HIT, 0.6);
    }

    // Boss death
    if (this.bossHP <= 0) {
      this.bossBlender?.playOnce(BOSS_ANIMS.death, 0.2);
      this.bossState = BOSS_STATE.DEAD;
      this.updateStatus('🏆 BOSS DEFEATED — Yin Bing Li Shi');

      if (this.postfx) {
        this.postfx.setOutlineColor(0x44ff44); // Green outline on death
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Player Movement (WASD relative to camera)
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _updatePlayerMovement(dt, playerModel) {
    if (!playerModel) return;

    const dir = new THREE.Vector3();

    // Camera-relative movement
    const camForward = new THREE.Vector3();
    this.camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.keys['KeyW']) dir.add(camForward);
    if (this.keys['KeyS']) dir.sub(camForward);
    if (this.keys['KeyD']) dir.add(camRight);
    if (this.keys['KeyA']) dir.sub(camRight);

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const speed = this.playerDodging ? this.dodgeSpeed : this.moveSpeed;
      playerModel.position.addScaledVector(dir, speed * dt);

      // Face movement direction (Fortnite style — forward from camera)
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), dir
      );
      playerModel.quaternion.slerp(targetQuat, dt * 10);
    }

    // Clamp to arena bounds
    const pos = playerModel.position;
    const maxDist = 14;
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (dist > maxDist) {
      pos.x *= maxDist / dist;
      pos.z *= maxDist / dist;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Input Handlers
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _onKeyDown(e) {
    if (!this.active || e.target !== document.body) return;
    this.keys[e.code] = true;

    switch (e.code) {
      case 'KeyQ':
        this.playerBlocking = true;
        break;
      case 'KeyE':
        if (this.playerStamina >= 25 && !this.playerDodging) {
          this.playerDodging = true;
          this.playerDodgeTimer = 0.4;
          this.playerStamina -= 25;
        }
        break;
      case 'Tab':
        e.preventDefault();
        this.lockedOn = !this.lockedOn;
        this.updateStatus(this.lockedOn ? '🎯 Locked on' : '🎯 Lock-off');
        break;
    }
  }

  /** @private */
  _onKeyUp(e) {
    if (!this.active) return;
    this.keys[e.code] = false;

    if (e.code === 'KeyQ') {
      this.playerBlocking = false;
    }
  }

  /** @private */
  _onMouseDown(e) {
    if (!this.active) return;
    if (e.button === 0) {
      // Left click — light attack
      this.playerAttackBoss('light');
    } else if (e.button === 2) {
      // Right click — heavy attack
      this.playerAttackBoss('heavy');
    }
  }

  /** @private */
  _onMouseUp(e) {
    // Reserved for charge attack release
  }

  // ═══════════════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════════════

  /** @private */
  _createHUD() {
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'bossFightHUD';
    this.uiContainer.innerHTML = `
      <style>
        #bossFightHUD {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          pointer-events: none; font-family: 'Segoe UI', sans-serif;
        }
        .boss-bar-container {
          width: 50%; max-width: 500px; margin: 16px auto 0;
          background: rgba(0,0,0,0.7); border: 1px solid #444; border-radius: 4px;
          padding: 6px 10px;
        }
        .boss-name { color: #ff4444; font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .bar-track { background: #222; height: 10px; border-radius: 3px; overflow: hidden; }
        .bar-fill-boss { background: linear-gradient(90deg, #cc2222, #ff4444); height: 100%; transition: width 0.2s; }
        .player-bars {
          position: fixed; bottom: 20px; left: 20px;
          background: rgba(0,0,0,0.7); border: 1px solid #333; border-radius: 4px;
          padding: 8px 12px; min-width: 200px;
        }
        .bar-label { color: #aaa; font-size: 11px; margin-bottom: 2px; }
        .bar-fill-hp { background: linear-gradient(90deg, #22aa22, #44cc44); height: 100%; transition: width 0.15s; }
        .bar-fill-stam { background: linear-gradient(90deg, #aaaa22, #cccc44); height: 100%; transition: width 0.1s; }
        .fight-controls {
          position: fixed; bottom: 20px; right: 20px;
          background: rgba(0,0,0,0.7); border: 1px solid #333; border-radius: 4px;
          padding: 8px; color: #888; font-size: 11px; line-height: 1.6;
        }
      </style>
      <div class="boss-bar-container">
        <div class="boss-name">⚔️ YIN BING LI SHI</div>
        <div class="bar-track"><div class="bar-fill-boss" id="bossHPBar" style="width:100%"></div></div>
      </div>
      <div class="player-bars">
        <div class="bar-label">HP</div>
        <div class="bar-track"><div class="bar-fill-hp" id="playerHPBar" style="width:100%"></div></div>
        <div class="bar-label" style="margin-top:4px;">Stamina</div>
        <div class="bar-track"><div class="bar-fill-stam" id="playerStamBar" style="width:100%"></div></div>
      </div>
      <div class="fight-controls">
        WASD Move · LMB Light · RMB Heavy<br>
        Q Block · E Dodge · Tab Lock-on
      </div>
    `;
    document.body.appendChild(this.uiContainer);
  }

  /** @private */
  _updateHUD() {
    const bossBar = document.getElementById('bossHPBar');
    const hpBar = document.getElementById('playerHPBar');
    const stamBar = document.getElementById('playerStamBar');

    if (bossBar) bossBar.style.width = `${(this.bossHP / this.bossMaxHP) * 100}%`;
    if (hpBar) hpBar.style.width = `${(this.playerHP / this.playerMaxHP) * 100}%`;
    if (stamBar) stamBar.style.width = `${(this.playerStamina / this.playerMaxStamina) * 100}%`;
  }

  // ═══════════════════════════════════════════════════════════
  // State Query
  // ═══════════════════════════════════════════════════════════

  get isActive() { return this.active; }
  get isBossDead() { return this.bossState === BOSS_STATE.DEAD; }
  get isPlayerDead() { return this.playerHP <= 0; }
}
