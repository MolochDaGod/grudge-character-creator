/**
 * GrudgeAuth — Grudge ID + character API for grudge6 character creator.
 *
 * Auth hub:  id.grudge-studio.com (OAuth, login page)
 * Game API:  grudge-builder Railway (characters, wallets, cNFT mint)
 *
 * Flow:
 *   Guest  → POST /api/auth/puter (device id) → Bearer JWT
 *   OAuth  → id.grudge-studio.com → ?grudge_token= → session/exchange → puter bridge → JWT
 *   CRUD   → /api/characters with Bearer token (Vercel rewrites → Railway)
 */

import { GRUDGE_API } from './AssetConfig.js';

const TOKEN_KEY = 'grudge_token';
const STORAGE_KEY_PERSISTENT = 'grudge_token_persist';
const DEVICE_KEY = 'grudge_device_id';
const AUTH_GATEWAY = 'https://id.grudge-studio.com';

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

class GrudgeAuth extends EventTarget {
  constructor() {
    super();
    this.user = null;
    this._token = null;
    this._ready = false;
  }

  get isLoggedIn() {
    return this._ready && !!this.user;
  }

  get token() {
    return this._token;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  }

  async _fetch(path, opts = {}) {
    const url = path.startsWith('http') ? path : `${GRUDGE_API}${path}`;
    const resp = await fetch(url, {
      ...opts,
      headers: { ...this._headers(), ...(opts.headers || {}) },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `API error ${resp.status}`);
    }
    return resp.json();
  }

  _applyAuth(data) {
    const token = data.token || data.sessionToken;
    if (!token) throw new Error('No auth token in response');
    this._token = token;
    this.user = data.user || {
      id: data.userId || data.id,
      grudgeId: data.grudgeId,
      username: data.username || data.displayName,
      displayName: data.displayName || data.username,
    };
    this._ready = true;
    localStorage.setItem(STORAGE_KEY_PERSISTENT, token);
    localStorage.setItem('grudge_id', this.user.grudgeId || '');
    this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
    return this.user;
  }

  async init() {
    const stored = localStorage.getItem(STORAGE_KEY_PERSISTENT) || sessionStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    try {
      this._token = stored;
      const data = await this._fetch('/api/auth/me');
      this.user = data.user || data;
      this._ready = true;
      this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
      return this.user;
    } catch {
      localStorage.removeItem(STORAGE_KEY_PERSISTENT);
      sessionStorage.removeItem(TOKEN_KEY);
      this._token = null;
    }
    return null;
  }

  /** Guest login — device-bound Puter bridge on GrudgeBuilder API */
  async loginAsGuest(displayName) {
    const data = await this._fetch('/api/auth/puter', {
      method: 'POST',
      body: JSON.stringify({
        puterId: `guest_${deviceId()}`,
        puterUuid: `guest_${deviceId()}`,
        displayName: displayName || 'Guest',
      }),
    });
    return this._applyAuth(data);
  }

  /** Bridge a Grudge ID launch token (from id.grudge-studio.com OAuth) to a game JWT */
  async bridgeLaunchToken(launchToken) {
    const exchange = await fetch(`${GRUDGE_API}/api/auth/session/exchange`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: launchToken, audience: window.location.origin }),
    });
    if (!exchange.ok) throw new Error('Launch token exchange failed');
    const profile = await exchange.json();

    const data = await this._fetch('/api/auth/puter', {
      method: 'POST',
      body: JSON.stringify({
        puterId: `grudge_${profile.grudgeId}`,
        puterUuid: `grudge_${profile.grudgeId}`,
        displayName: profile.displayName || profile.username,
      }),
    });
    return this._applyAuth(data);
  }

  loginWithDiscord() {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_GATEWAY}/auth/discord/start?returnUrl=${returnUrl}`;
  }

  loginWithGoogle() {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_GATEWAY}/auth/google/start?returnUrl=${returnUrl}`;
  }

  loginWithGrudgeId() {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_GATEWAY}?redirect=${returnUrl}`;
  }

  async handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);

    const launchToken = params.get('grudge_token');
    if (launchToken) {
      params.delete('grudge_token');
      const clean = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''));
      return this.bridgeLaunchToken(launchToken);
    }

    const legacyToken = params.get('token') || params.get('sso_token');
    if (legacyToken) {
      this._token = legacyToken;
      localStorage.setItem(STORAGE_KEY_PERSISTENT, legacyToken);
      params.delete('token');
      params.delete('sso_token');
      const clean = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (clean ? `?${clean}` : ''));
      const data = await this._fetch('/api/auth/me');
      this.user = data.user || data;
      this._ready = true;
      this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
      return this.user;
    }

    return null;
  }

  logout() {
    this.user = null;
    this._token = null;
    this._ready = false;
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_KEY_PERSISTENT);
    localStorage.removeItem('grudge_id');
    this.dispatchEvent(new Event('logout'));
  }

  async listCharacters() {
    if (!this._token) throw new Error('Not authenticated');
    const data = await this._fetch('/api/characters');
    return Array.isArray(data) ? data : (data.characters || []);
  }

  async createCharacter(character) {
    if (!this._token) throw new Error('Not authenticated');
    const attrs = character.attrs || character.attributes || {};
    const body = {
      name: character.name,
      raceId: character.raceId || character.race,
      classId: character.classId || character.class || 'warrior',
      factionId: character.factionId,
      equipment: character.equipped || character.equipment || {},
      attributes: Object.keys(attrs).length ? attrs : {
        Strength: 10, Vitality: 10, Endurance: 10, Intellect: 10,
        Wisdom: 10, Dexterity: 10, Agility: 10, Tactics: 10,
      },
      level: character.level || 1,
      gameOrigin: 'grudge6',
    };
    const data = await this._fetch('/api/characters', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data.character || data;
  }

  async updateCharacter(id, updates) {
    if (!this._token) throw new Error('Not authenticated');
    const data = await this._fetch(`/api/characters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.character || data;
  }

  async deleteCharacter(id) {
    if (!this._token) throw new Error('Not authenticated');
    await this._fetch(`/api/characters/${id}`, { method: 'DELETE' });
    return id;
  }
}

export const grudgeAuth = new GrudgeAuth();