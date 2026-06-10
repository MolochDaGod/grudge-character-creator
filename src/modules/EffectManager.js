/**
 * EffectManager — reusable runtime VFX primitives for Grudge Studio.
 *
 * First pass impact/core effects:
 *   - explosionBurst
 *   - dustImpact
 *   - sparkShower
 *   - energyPulse
 *   - debrisScatter
 *   - smokeTrail
 *   - shockwaveRipple
 *   - lightFlash
 *
 * This module is vanilla Three.js so it works in the current character creator.
 * R3F/Rapier front-ends can call the same effect names/options through an adapter.
 */

import * as THREE from 'three';

export const IMPACT_EFFECTS = Object.freeze({
  EXPLOSION_BURST: 'explosionBurst',
  DUST_IMPACT: 'dustImpact',
  SPARK_SHOWER: 'sparkShower',
  ENERGY_PULSE: 'energyPulse',
  DEBRIS_SCATTER: 'debrisScatter',
  SMOKE_TRAIL: 'smokeTrail',
  SHOCKWAVE_RIPPLE: 'shockwaveRipple',
  LIGHT_FLASH: 'lightFlash',
});

const EFFECT_ALIASES = new Map([
  ['explosion', IMPACT_EFFECTS.EXPLOSION_BURST],
  ['burst', IMPACT_EFFECTS.EXPLOSION_BURST],
  ['dust', IMPACT_EFFECTS.DUST_IMPACT],
  ['sparks', IMPACT_EFFECTS.SPARK_SHOWER],
  ['spark', IMPACT_EFFECTS.SPARK_SHOWER],
  ['pulse', IMPACT_EFFECTS.ENERGY_PULSE],
  ['ring', IMPACT_EFFECTS.ENERGY_PULSE],
  ['debris', IMPACT_EFFECTS.DEBRIS_SCATTER],
  ['smoke', IMPACT_EFFECTS.SMOKE_TRAIL],
  ['shockwave', IMPACT_EFFECTS.SHOCKWAVE_RIPPLE],
  ['shockwaveRing', IMPACT_EFFECTS.SHOCKWAVE_RIPPLE],
  ['flash', IMPACT_EFFECTS.LIGHT_FLASH],
  ['light', IMPACT_EFFECTS.LIGHT_FLASH],
]);

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _tmpObject = new THREE.Object3D();
const _tmpQuat = new THREE.Quaternion();
const _tmpDir = new THREE.Vector3();

function normalizeEffectType(type) {
  return EFFECT_ALIASES.get(type) || type || IMPACT_EFFECTS.SPARK_SHOWER;
}

function toVector3(position) {
  if (position?.isVector3) return position.clone();
  if (Array.isArray(position)) return new THREE.Vector3(position[0] || 0, position[1] || 0, position[2] || 0);
  if (position && typeof position === 'object') {
    return new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
  }
  return new THREE.Vector3();
}

function colorOf(value, fallback = 0xffffff) {
  if (value?.isColor) return value.clone();
  return new THREE.Color(value ?? fallback);
}

function randomDirection(scaleX = 1, scaleY = 1, scaleZ = 1) {
  const v = new THREE.Vector3(
    (Math.random() - 0.5) * scaleX,
    (Math.random() - 0.15) * scaleY,
    (Math.random() - 0.5) * scaleZ,
  );
  return v.lengthSq() > 0.0001 ? v.normalize() : new THREE.Vector3(0, 1, 0);
}

function createSoftCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.75, 'rgba(255,255,255,0.14)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function disposeObject(object) {
  object.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose?.());
    else material?.dispose?.();
  });
}

export class EffectManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{ enableLights?: boolean }} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enableLights = options.enableLights ?? true;
    this.active = [];
    this._smokeTexture = null;
  }

  /**
   * Spawn an effect by name.
   * @param {string} type
   * @param {THREE.Vector3|number[]} position
   * @param {object} [options]
   * @returns {object|null}
   */
  play(type, position, options = {}) {
    const effectType = normalizeEffectType(type);
    const pos = toVector3(position);

    let effect = null;
    switch (effectType) {
      case IMPACT_EFFECTS.EXPLOSION_BURST:
        effect = this._createExplosionBurst(pos, options);
        break;
      case IMPACT_EFFECTS.DUST_IMPACT:
        effect = this._createDustImpact(pos, options);
        break;
      case IMPACT_EFFECTS.SPARK_SHOWER:
        effect = this._createSparkShower(pos, options);
        break;
      case IMPACT_EFFECTS.ENERGY_PULSE:
        effect = this._createEnergyPulse(pos, options);
        break;
      case IMPACT_EFFECTS.DEBRIS_SCATTER:
        effect = this._createDebrisScatter(pos, options);
        break;
      case IMPACT_EFFECTS.SMOKE_TRAIL:
        effect = this._createSmokeTrail(pos, options);
        break;
      case IMPACT_EFFECTS.SHOCKWAVE_RIPPLE:
        effect = this._createShockwaveRipple(pos, options);
        break;
      case IMPACT_EFFECTS.LIGHT_FLASH:
        effect = this._createLightFlash(pos, options);
        break;
      default:
        console.warn(`[EffectManager] Unknown effect "${effectType}", using sparkShower.`);
        effect = this._createSparkShower(pos, options);
        break;
    }

    if (!effect) return null;
    this.active.push(effect);
    return effect;
  }

  /** Spawn several effect layers at the same position. */
  playCombo(types, position, options = {}) {
    return types.map((type) => this.play(type, position, options)).filter(Boolean);
  }

  /** Update all active effects. Call once per frame. */
  update(delta) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      effect.age += delta;
      const t = Math.min(effect.age / effect.duration, 1);
      effect.update?.(delta, effect.age, t);

      if (effect.age >= effect.duration) {
        this._removeEffect(effect);
        this.active.splice(i, 1);
      }
    }
  }

  clear() {
    for (const effect of this.active) this._removeEffect(effect);
    this.active.length = 0;
  }

  dispose() {
    this.clear();
    this._smokeTexture?.dispose();
    this._smokeTexture = null;
  }

  _track(objects, duration, update, dispose) {
    for (const object of objects) this.scene.add(object);
    return { age: 0, duration, objects, update, dispose };
  }

  _removeEffect(effect) {
    for (const object of effect.objects) {
      if (object.parent) object.parent.remove(object);
    }
    effect.dispose?.();
  }

  _createExplosionBurst(origin, options = {}) {
    const count = options.count ?? 80;
    const duration = options.duration ?? 0.85;
    const color = colorOf(options.color, 0xffaa22);
    const scale = options.scale ?? 1;
    const gravity = options.gravity ?? 18;
    const velocities = Array.from({ length: count }, () => randomDirection(18, 20, 18).multiplyScalar(4.5 + Math.random() * 5.5));
    const sizes = Array.from({ length: count }, () => (0.08 + Math.random() * 0.18) * scale);

    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const update = (_dt, age, t) => {
      material.opacity = Math.max(0, 1 - t);
      for (let i = 0; i < count; i++) {
        const v = velocities[i];
        _tmpObject.position.set(
          origin.x + v.x * age,
          origin.y + v.y * age - 0.5 * gravity * age * age,
          origin.z + v.z * age,
        );
        const s = sizes[i] * (1.0 - t * 0.75);
        _tmpObject.scale.setScalar(Math.max(0.001, s));
        _tmpObject.quaternion.identity();
        _tmpObject.updateMatrix();
        mesh.setMatrixAt(i, _tmpObject.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(0, 0, 0);

    return this._track([mesh], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createDustImpact(origin, options = {}) {
    const count = options.count ?? 55;
    const duration = options.duration ?? 1.15;
    const color = colorOf(options.color, 0x9b8062);
    const scale = options.scale ?? 1;
    const gravity = options.gravity ?? 9;
    const positions = new Float32Array(count * 3);
    const velocities = Array.from({ length: count }, () => randomDirection(10, 5, 10).multiplyScalar(0.8 + Math.random() * 3.0));

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y + 0.04;
      positions[i * 3 + 2] = origin.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.16 * scale,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const points = new THREE.Points(geometry, material);

    const update = (_dt, age, t) => {
      material.opacity = 0.55 * Math.max(0, 1 - t);
      for (let i = 0; i < count; i++) {
        const v = velocities[i];
        positions[i * 3] = origin.x + v.x * age;
        positions[i * 3 + 1] = origin.y + 0.04 + v.y * age - 0.5 * gravity * age * age;
        positions[i * 3 + 2] = origin.z + v.z * age;
      }
      geometry.attributes.position.needsUpdate = true;
    };

    return this._track([points], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createSparkShower(origin, options = {}) {
    const count = options.count ?? 44;
    const duration = options.duration ?? 0.55;
    const color = colorOf(options.color, 0xffdd66);
    const scale = options.scale ?? 1;
    const velocities = Array.from({ length: count }, () => randomDirection(14, 12, 14).multiplyScalar(7.0 + Math.random() * 9.0));
    const sizes = Array.from({ length: count }, () => (0.45 + Math.random() * 0.7) * scale);

    const geometry = new THREE.CylinderGeometry(0.018, 0.008, 1, 6);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const light = new THREE.PointLight(color, 0, 4);
    light.position.copy(origin);

    const update = (_dt, age, t) => {
      material.opacity = Math.max(0, 1 - t);
      light.intensity = this.enableLights ? 2.0 * (1 - t) * (0.75 + Math.random() * 0.25) : 0;
      for (let i = 0; i < count; i++) {
        const v = velocities[i];
        _tmpObject.position.set(
          origin.x + v.x * age,
          origin.y + v.y * age - 9 * age * age,
          origin.z + v.z * age,
        );
        _tmpDir.copy(v).normalize();
        _tmpQuat.setFromUnitVectors(Y_AXIS, _tmpDir);
        _tmpObject.quaternion.copy(_tmpQuat);
        _tmpObject.scale.set(1, sizes[i] * (1 - t), 1);
        _tmpObject.updateMatrix();
        mesh.setMatrixAt(i, _tmpObject.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(0, 0, 0);

    return this._track([mesh, light], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createEnergyPulse(origin, options = {}) {
    const duration = options.duration ?? 0.75;
    const color = colorOf(options.color, 0x00aaff);
    const startRadius = options.startRadius ?? 0.25;
    const endRadius = options.endRadius ?? 3.0 * (options.scale ?? 1);
    const vertical = options.vertical ?? false;
    const geometry = new THREE.RingGeometry(0.72, 1.0, 96);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(origin);
    ring.position.y += vertical ? 0 : 0.04;
    if (!vertical) ring.rotation.x = -Math.PI / 2;

    const update = (_dt, _age, t) => {
      const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
      ring.scale.setScalar(radius);
      material.opacity = Math.max(0, (1 - t) * 0.95);
    };
    update(0, 0, 0);

    return this._track([ring], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createDebrisScatter(origin, options = {}) {
    const count = options.count ?? 18;
    const duration = options.duration ?? 1.4;
    const color = colorOf(options.color, 0x5a5348);
    const scale = options.scale ?? 1;
    const gravity = options.gravity ?? 15;
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.18 * scale, 0.14 * scale, 0.16 * scale);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    const debris = [];

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.position.copy(origin);
      mesh.position.y += 0.05;
      mesh.scale.setScalar(0.65 + Math.random() * 1.4);
      group.add(mesh);
      debris.push({
        mesh,
        velocity: randomDirection(10, 7, 10).multiplyScalar(1.5 + Math.random() * 4.0),
        angular: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 10,
        ),
      });
    }

    const update = (dt, age, t) => {
      group.visible = t < 0.98;
      for (const d of debris) {
        d.mesh.position.set(
          origin.x + d.velocity.x * age,
          Math.max(0.03, origin.y + 0.05 + d.velocity.y * age - 0.5 * gravity * age * age),
          origin.z + d.velocity.z * age,
        );
        d.mesh.rotation.x += d.angular.x * dt;
        d.mesh.rotation.y += d.angular.y * dt;
        d.mesh.rotation.z += d.angular.z * dt;
      }
    };

    return this._track([group], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createSmokeTrail(origin, options = {}) {
    const count = options.count ?? 40;
    const duration = options.duration ?? 1.45;
    const color = colorOf(options.color, 0x6b6f78);
    const scale = options.scale ?? 1;
    if (!this._smokeTexture) this._smokeTexture = createSoftCircleTexture();

    const positions = new Float32Array(count * 3);
    const velocities = Array.from({ length: count }, () => randomDirection(3, 8, 3).multiplyScalar(0.4 + Math.random() * 1.6));
    const delays = Array.from({ length: count }, () => Math.random() * 0.4);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.38 * scale,
      map: this._smokeTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
      alphaTest: 0.02,
    });
    const points = new THREE.Points(geometry, material);

    const update = (_dt, age, t) => {
      material.opacity = 0.42 * (1 - t);
      material.size = 0.38 * scale * (1 + t * 2.0);
      for (let i = 0; i < count; i++) {
        const localAge = Math.max(0, age - delays[i]);
        const v = velocities[i];
        positions[i * 3] = origin.x + v.x * localAge + Math.sin(localAge * 3 + i) * 0.08;
        positions[i * 3 + 1] = origin.y + v.y * localAge + localAge * 0.35;
        positions[i * 3 + 2] = origin.z + v.z * localAge + Math.cos(localAge * 2 + i) * 0.08;
      }
      geometry.attributes.position.needsUpdate = true;
    };

    return this._track([points], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createShockwaveRipple(origin, options = {}) {
    const duration = options.duration ?? 0.85;
    const color = colorOf(options.color, 0xffcc88);
    const endRadius = options.endRadius ?? 4.2 * (options.scale ?? 1);
    const geometry = new THREE.RingGeometry(0.9, 1.0, 128);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(origin);
    ring.position.y += 0.035;
    ring.rotation.x = -Math.PI / 2;

    const update = (_dt, _age, t) => {
      const eased = 1 - Math.pow(1 - t, 3);
      ring.scale.setScalar(0.08 + eased * endRadius);
      material.opacity = 0.9 * Math.pow(1 - t, 1.7);
    };
    update(0, 0, 0);

    return this._track([ring], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }

  _createLightFlash(origin, options = {}) {
    const duration = options.duration ?? 0.28;
    const color = colorOf(options.color, 0xffffff);
    const intensity = options.intensity ?? 35;
    const scale = options.scale ?? 1;

    const geometry = new THREE.SphereGeometry(0.18 * scale, 24, 12);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(origin);

    const light = new THREE.PointLight(color, this.enableLights ? intensity : 0, 7 * scale, 2);
    light.position.copy(origin);

    const update = (_dt, _age, t) => {
      const fade = Math.exp(-t * 5.0);
      material.opacity = fade;
      sphere.scale.setScalar(1 + t * 5);
      light.intensity = this.enableLights ? intensity * fade : 0;
    };

    return this._track([sphere, light], duration, update, () => {
      geometry.dispose();
      material.dispose();
    });
  }
}
