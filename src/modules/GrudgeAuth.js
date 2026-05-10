/**
 * GrudgeAuth — Authentication via the Grudge backend (api.grudge-studio.com).
 *
 * Replaces the old Puter-based ApiClient. Supports:
 *   - Guest account creation (auto Grudge UUID)
 *   - Discord OAuth redirect
 *   - Google OAuth redirect
 *   - Solana Web3Auth (future)
 *
 * Character CRUD goes through the Grudge backend, not Puter KV.
 *
 * Usage:
 *   import { grudgeAuth } from './GrudgeAuth.js';
 *   await grudgeAuth.loginAsGuest();
 *   const chars = await grudgeAuth.listCharacters();
 */

import { GRUDGE_API } from './AssetConfig.js';

const TOKEN_KEY = 'grudge_token';
const MAX_CHARACTERS = 20;

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

  // ── Auth headers for API calls ────────────────────────────
  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  }

  async _fetch(path, opts = {}) {
    const url = `${GRUDGE_API}${path}`;
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

  // ── Initialize — restore session from stored token ────────
  async init() {
    try {
      const stored = sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        this._token = stored;
        const data = await this._fetch('/api/auth/me');
        this.user = data.user;
        this._ready = true;
        this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
        return this.user;
      }
    } catch {
      // Token expired or invalid — clear and continue
      sessionStorage.removeItem(TOKEN_KEY);
      this._token = null;
    }
    return null;
  }

  // ── Guest login — auto-creates Grudge UUID ────────────────
  async loginAsGuest(displayName) {
    const data = await this._fetch('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName: displayName || undefined }),
    });

    this._token = data.token;
    this.user = data.user;
    this._ready = true;
    sessionStorage.setItem(TOKEN_KEY, data.token);
    this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
    return this.user;
  }

  // ── Discord OAuth — redirect to backend, which redirects back ──
  loginWithDiscord() {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${GRUDGE_API}/auth/discord?returnUrl=${returnUrl}`;
  }

  // ── Google OAuth ──
  loginWithGoogle() {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${GRUDGE_API}/auth/google?returnUrl=${returnUrl}`;
  }

  // ── Handle OAuth callback (token in URL hash or query) ────
  async handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) return null;

    this._token = token;
    sessionStorage.setItem(TOKEN_KEY, token);

    // Clean URL
    const clean = window.location.pathname;
    window.history.replaceState({}, '', clean);

    const data = await this._fetch('/api/auth/me');
    this.user = data.user;
    this._ready = true;
    this.dispatchEvent(new CustomEvent('login', { detail: this.user }));
    return this.user;
  }

  // ── Logout ────────────────────────────────────────────────
  logout() {
    this.user = null;
    this._token = null;
    this._ready = false;
    sessionStorage.removeItem(TOKEN_KEY);
    this.dispatchEvent(new Event('logout'));
  }

  // ── Character CRUD ────────────────────────────────────────
  async listCharacters() {
    if (!this._token) throw new Error('Not authenticated');
    const data = await this._fetch('/api/characters');
    return data.characters || [];
  }

  async createCharacter(character) {
    if (!this._token) throw new Error('Not authenticated');
    const data = await this._fetch('/api/characters', {
      method: 'POST',
      body: JSON.stringify({
        name: character.name,
        factionId: character.factionId,
        raceId: character.raceId,
        equipped: character.equipped || {},
        attrs: character.attrs || {},
        level: character.level || 1,
      }),
    });
    return data.character;
  }

  async updateCharacter(id, updates) {
    if (!this._token) throw new Error('Not authenticated');
    const data = await this._fetch('/api/characters', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
    return data.character;
  }

  async deleteCharacter(id) {
    if (!this._token) throw new Error('Not authenticated');
    await this._fetch('/api/characters', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    return id;
  }
}

export const grudgeAuth = new GrudgeAuth();
