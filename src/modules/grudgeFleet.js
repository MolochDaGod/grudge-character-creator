/**
 * grudgeFleet.js — ONE TRUTH wiring (vanilla JS copy for grudge6 / character creator).
 * TypeScript canonical source: GrudgeBuilder/client/src/lib/grudgeFleet.ts
 */

export const GAME_DATA_RAILWAY = 'https://grudge-builder-production.up.railway.app';
export const AUTH_GATEWAY = 'https://id.grudge-studio.com';
export const IDENTITY_API = 'https://api.grudge-studio.com';

export const GRUDGE_FLEET = {
  auth: AUTH_GATEWAY,
  identityApi: IDENTITY_API,
  gameData: GAME_DATA_RAILWAY,
  assets: 'https://assets.grudge-studio.com',
  ai: 'https://ai.grudge-studio.com',
  objectStore: 'https://objectstore.grudge-studio.com/api/v1',
  crossmint: { characterCollection: '5061318d-ff65-4893-ac4b-9b28efb18ace' },
};

export function fleetApi(path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean;
}

export function loginWithGrudgeId(returnPath = '/auth/callback') {
  const redirect = encodeURIComponent(`${window.location.origin}${returnPath}`);
  window.location.href = `${AUTH_GATEWAY}?redirect=${redirect}`;
}