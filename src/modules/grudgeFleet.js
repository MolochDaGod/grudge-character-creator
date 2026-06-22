/**
 * grudgeFleet.js — ONE TRUTH wiring (vanilla JS copy for grudge6 / character creator).
 * TypeScript canonical source: GrudgeBuilder/shared/fleet + client/src/lib/grudgeFleet.ts
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
  colyseus: 'wss://api.grudge-studio.com',
  world: 'wss://world.grudge-studio.com',
  charactersHub: 'https://characters.grudge-studio.com',
  fleetManifest: '/api/fleet/manifest',
  supabase: '/api/supabase',
  crossmint: { characterCollection: '5061318d-ff65-4893-ac4b-9b28efb18ace' },
};

export function fleetApi(path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean;
}

const TRUSTED_AUTH_ORIGINS = /^https:\/\/([a-z0-9-]+\.)*grudge-studio\.com$/;

function parsePopupAuthMessage(data) {
  if (!data || typeof data !== 'object' || !data.token) return null;
  if (data.type === 'grudge-auth:success') {
    return { token: data.token, user: data.user || data.player || null };
  }
  if (data.type === 'grudge:auth:success') {
    return { token: data.token, user: data.player || data.user || null };
  }
  return null;
}

/**
 * Open Grudge ID auth popup (canonical). Falls back to full-page redirect if blocked.
 */
export function openGrudgeAuthPopup(returnPath = '/auth/callback?return=/game', onSuccess) {
  const audience = window.location.origin;
  const redirect = `${audience}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}`;
  const params = new URLSearchParams({ origin: audience, redirect });
  const url = `${AUTH_GATEWAY}/api/auth/page?${params.toString()}`;
  const w = 440;
  const h = 720;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  const popup = window.open(url, 'grudge-auth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);

  if (!popup) {
    window.location.href = url;
    return;
  }

  const sendInit = () => {
    try { popup.postMessage({ type: 'grudge-auth:init', origin: audience }, AUTH_GATEWAY); } catch (_) {}
  };

  const onMessage = async (event) => {
    if (event.origin !== AUTH_GATEWAY && !TRUSTED_AUTH_ORIGINS.test(event.origin)) return;
    if (event.data?.type === 'grudge-auth:ready') {
      sendInit();
      return;
    }
    const parsed = parsePopupAuthMessage(event.data);
    if (!parsed) return;
    cleanup();
    if (typeof onSuccess === 'function') {
      onSuccess(parsed);
    } else {
      window.location.href = `${redirect}${redirect.includes('?') ? '&' : '?'}grudge_token=${encodeURIComponent(parsed.token)}`;
    }
  };

  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    clearInterval(poll);
    clearInterval(initRetry);
    if (popup && !popup.closed) try { popup.close(); } catch (_) {}
  };

  const poll = setInterval(() => {
    if (popup.closed) cleanup();
  }, 500);
  const initRetry = setInterval(sendInit, 400);
  setTimeout(() => clearInterval(initRetry), 4000);

  window.addEventListener('message', onMessage);
  sendInit();
}

export function loginWithGrudgeId(returnPath = '/auth/callback?return=/game') {
  openGrudgeAuthPopup(returnPath);
}