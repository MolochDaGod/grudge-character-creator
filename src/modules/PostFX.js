/**
 * PostFX — Post-processing pipeline for combat VFX.
 *
 * Patterns from threejs-skills/threejs-postprocessing + threejs-shaders:
 * - EffectComposer with RenderPass
 * - UnrealBloomPass for weapon glow / spell VFX
 * - OutlinePass for target selection (tab-target system)
 * - FXAAShader for anti-aliasing
 * - Custom DamageFlash shader (red screen pulse on hit)
 * - All passes toggleable, resize-aware
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

// ── Custom Damage Flash Shader ──────────────────────────────
const DamageFlashShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.0 },
    color: { value: new THREE.Color(0.8, 0.05, 0.05) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
      vec4 texColor = texture2D(tDiffuse, vUv);
      // Vignette-weighted flash — stronger at edges
      vec2 uv = vUv - 0.5;
      float vignette = dot(uv, uv) * 2.0;
      float flash = intensity * (0.4 + vignette);
      gl_FragColor = vec4(mix(texColor.rgb, color, flash), texColor.a);
    }
  `,
};

export class PostFX {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();

    // ── Composer ──
    this.composer = new EffectComposer(renderer);

    // 1. Render pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // 2. Bloom (weapon glow, spell VFX, boss aura)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.6,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Outline pass (target selection highlighting)
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(size.x, size.y),
      scene, camera
    );
    this.outlinePass.edgeStrength = 4;
    this.outlinePass.edgeGlow = 0.5;
    this.outlinePass.edgeThickness = 2;
    this.outlinePass.pulsePeriod = 2;
    this.outlinePass.visibleEdgeColor.set(0xff4444);
    this.outlinePass.hiddenEdgeColor.set(0x442222);
    this.outlinePass.selectedObjects = [];
    this.composer.addPass(this.outlinePass);

    // 4. Damage flash
    this.damagePass = new ShaderPass(DamageFlashShader);
    this.damagePass.uniforms.intensity.value = 0;
    this.composer.addPass(this.damagePass);

    // 5. Gamma correction
    this.gammaPass = new ShaderPass(GammaCorrectionShader);
    this.composer.addPass(this.gammaPass);

    // 6. FXAA (always last)
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (size.x * pixelRatio),
      1 / (size.y * pixelRatio)
    );
    this.composer.addPass(this.fxaaPass);

    // Damage flash decay state
    this._damageIntensity = 0;
  }

  // ── Controls ──────────────────────────────────────────────

  /** Enable/disable entire post-processing pipeline. */
  setEnabled(on) {
    this.enabled = on;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /** Adjust bloom intensity. */
  setBloom(strength, radius, threshold) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }

  // ── Target Outline (Tab-target) ───────────────────────────

  /**
   * Set the objects to highlight with the outline effect.
   * @param {THREE.Object3D[]} objects
   */
  setTargets(objects) {
    this.outlinePass.selectedObjects = objects;
  }

  /** Clear all targets. */
  clearTargets() {
    this.outlinePass.selectedObjects = [];
  }

  /**
   * Set outline color.
   * @param {number} hex - e.g. 0xff0000
   */
  setOutlineColor(hex) {
    this.outlinePass.visibleEdgeColor.set(hex);
    this.outlinePass.hiddenEdgeColor.set(hex);
  }

  // ── Damage Flash ──────────────────────────────────────────

  /**
   * Trigger a damage flash (decays automatically in update()).
   * @param {number} [intensity=0.6] - 0–1 flash intensity
   * @param {number} [hexColor=0xcc0d0d] - flash color
   */
  triggerDamageFlash(intensity = 0.6, hexColor) {
    this._damageIntensity = Math.min(intensity, 1);
    if (hexColor !== undefined) {
      this.damagePass.uniforms.color.value.set(hexColor);
    }
  }

  // ── Render / Update ───────────────────────────────────────

  /**
   * Call every frame. Handles flash decay and renders.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    // Decay damage flash
    if (this._damageIntensity > 0) {
      this._damageIntensity = Math.max(0, this._damageIntensity - dt * 3.0);
      this.damagePass.uniforms.intensity.value = this._damageIntensity;
    }

    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ── Resize ────────────────────────────────────────────────

  /**
   * Call on window resize.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
  }

  // ── Dispose ───────────────────────────────────────────────

  dispose() {
    this.composer.dispose();
  }
}
