/**
 * AssetConfig — Centralized R2 asset URL resolution.
 *
 * In production, models/animations load from R2 CDN (assets.grudge-studio.com).
 * In local dev, Vite serves them from /assets/ (parent directory).
 *
 * Usage:
 *   import { assetUrl, modelUrl, animationUrl } from './AssetConfig.js';
 *   const url = modelUrl('human.glb');        // → https://assets.grudge-studio.com/models/characters/human.glb
 *   const url = animationUrl('1hweaponandshield', 'idle.fbx');
 */

const R2_BASE = import.meta.env.VITE_R2_BASE_URL || '';
const MANIFEST_API = import.meta.env.VITE_MANIFEST_API || '';
const GRUDGE_API = import.meta.env.VITE_GRUDGE_API || 'https://api.grudge-studio.com';
const LOCAL_ASSET_BASE = '/assets';

/** True when running against R2 CDN (production) */
export const isProduction = !!R2_BASE;

/** Base URL for all assets */
export const ASSET_BASE = R2_BASE || LOCAL_ASSET_BASE;

/**
 * Build a URL for any asset path.
 * @param {string} path  e.g. 'models/characters/human.glb'
 */
export function assetUrl(path) {
  const base = ASSET_BASE.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}

/**
 * Build a character model URL.
 * @param {string} filename  e.g. 'human.glb'
 */
export function modelUrl(filename) {
  if (isProduction) {
    return assetUrl(`models/characters/${filename}`);
  }
  // Local dev: FBX models served from parent via Vite plugin
  return null; // SmartLoader will use the FactionRegistry path directly
}

/**
 * Build an animation file URL.
 * @param {string} packDir  e.g. '1hweaponandshield'
 * @param {string} filename e.g. 'sword and shield idle.fbx'
 */
export function animationUrl(packDir, filename) {
  return assetUrl(`animationsweapons/${packDir}/${filename}`);
}

/**
 * Build a weapon model URL.
 * @param {string} packDir  e.g. '3dswords/fbx'
 * @param {string} filename
 */
export function weaponModelUrl(packDir, filename) {
  return assetUrl(`animationsweapons/${packDir}/${filename}`);
}

/** Grudge backend API base URL */
export { GRUDGE_API };

/** D1 manifest API base URL (Cloudflare Worker) */
export { MANIFEST_API };
