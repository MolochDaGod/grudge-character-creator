/**
 * grudgeFleet.js — ONE TRUTH wiring (vanilla JS for grudge6 / character creator).
 * TypeScript canonical: grudge-builder/shared/fleet/manifest.ts
 *
 * Auth UI / Discord: id.grudge-studio.com (working OAuth)
 * Game data / characters: grudge-api Railway (Postgres SSOT)
 */

/** Canonical game-data + accounts implementation (Railway grudge-api). */
export const GAME_DATA_RAILWAY = 'https://grudge-api-production-0d46.up.railway.app';

/** Unified SSO — Discord / Google / Puter / guest all land here. */
export const AUTH_GATEWAY = 'https://id.grudge-studio.com';

/** @deprecated do not use for auth — kept for legacy probes only */
export const IDENTITY_API = 'https://api.grudge-studio.com';

export const GRUDGE_FLEET = {
  auth: AUTH_GATEWAY,
  identityApi: AUTH_GATEWAY,
  gameData: GAME_DATA_RAILWAY,
  assets: 'https://assets.grudge-studio.com',
  ai: 'https://ai.grudge-studio.com',
  objectStore: 'https://objectstore.grudge-studio.com/api/v1',
  colyseus: 'wss://grudge-api-production-0d46.up.railway.app',
  world: 'wss://world.grudge-studio.com',
  charactersHub: 'https://character.grudge-studio.com',
  warlords: 'https://client.grudge-studio.com',
  arena: 'https://grudge-arena.grudge-studio.com',
  fleetManifest: '/api/fleet/manifest',
  supabase: '/api/supabase',
  crossmint: { characterCollection: '5061318d-ff65-4893-ac4b-9b28efb18ace' },
};

/** Fleet token keys — same set as Warlords / id gateway. */
export const FLEET_TOKEN_KEYS = [
  'grudge_token_persist',
  'grudge_auth_token',
  'grudge_session_token',
  'sso_token',
  'grudge_token',
];

export function storeFleetToken(token) {
  if (!token) return;
  for (const k of FLEET_TOKEN_KEYS) {
    try {
      localStorage.setItem(k, token);
    } catch {
      /* ignore quota */
    }
  }
  try {
    sessionStorage.setItem('grudge_token', token);
  } catch {
    /* ignore */
  }
}

export function clearFleetTokens() {
  for (const k of FLEET_TOKEN_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem('grudge_token');
  } catch {
    /* ignore */
  }
}

export function getFleetToken() {
  for (const k of FLEET_TOKEN_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
    } catch {
      /* ignore */
    }
  }
  try {
    return sessionStorage.getItem('grudge_token');
  } catch {
    return null;
  }
}

/** Same-origin /api path (Vercel rewrites → Railway / id). */
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
 * Canonical Discord OAuth — uses existing id.grudge-studio.com Discord app.
 * Do not invent a second Discord client; redirect lands on /auth/callback.
 */
export function loginWithDiscord(returnPath = '/auth/callback?return=/game') {
  const returnUrl = `${window.location.origin}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}`;
  // Prefer same-origin rewrite → id gateway (vercel.json), so cookies/CORS stay simple
  window.location.href = `/api/auth/discord/start?return=${encodeURIComponent(returnUrl)}`;
}

/**
 * Open Grudge ID auth popup (canonical). Falls back to full-page redirect if blocked.
 * Discord is available on that page — same working OAuth as Warlords.
 */
export function openGrudgeAuthPopup(returnPath = '/auth/callback?return=/game', onSuccess) {
  const audience = window.location.origin;
  const redirect = `${audience}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}`;
  // Dual return params for id gateway (redirect_uri + redirect + return + origin)
  const params = new URLSearchParams({
    origin: audience,
    redirect,
    redirect_uri: redirect,
    return: redirect,
    app: 'grudge6',
  });
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
    try {
      popup.postMessage({ type: 'grudge-auth:init', origin: audience }, AUTH_GATEWAY);
    } catch (_) {
      /* ignore */
    }
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
      storeFleetToken(parsed.token);
      onSuccess(parsed);
    } else {
      window.location.href = `${redirect}${redirect.includes('?') ? '&' : '?'}grudge_token=${encodeURIComponent(parsed.token)}`;
    }
  };

  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    clearInterval(poll);
    clearInterval(initRetry);
    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch (_) {
        /* ignore */
      }
    }
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

/** Operational probe list for /game hub */
export const OPERATIONAL_PROBES = [
  {
    id: 'id_auth_page',
    label: 'id.grudge-studio.com auth page',
    url: `${AUTH_GATEWAY}/api/auth/page`,
    expect: [200],
  },
  {
    id: 'discord_oauth',
    label: 'Discord OAuth start (canonical id gateway)',
    url: `${AUTH_GATEWAY}/api/auth/discord/start?return=${encodeURIComponent('https://grudge6.grudge-studio.com/game')}`,
    expect: [302, 301, 307, 308],
    redirect: true,
  },
  {
    id: 'game_data',
    label: 'grudge-api game data',
    url: `${GAME_DATA_RAILWAY}/api/auth/me`,
    expect: [401, 200],
  },
];
