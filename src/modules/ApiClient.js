/**
 * ApiClient — thin fetch wrapper for the Grudge Character Creator API.
 *
 * Handles JWT auth via localStorage, auto-creates guest account on first use.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'grudge_token';
const USER_KEY = 'grudge_user';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
    try {
      this.user = JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      this.user = null;
    }
  }

  get isLoggedIn() {
    return !!this.token;
  }

  /** Ensure we have a guest token. */
  async ensureAuth() {
    if (this.token) return this.user;
    return this.createGuestAccount();
  }

  /** Create a guest account and store token. */
  async createGuestAccount(displayName) {
    const resp = await fetch(`${API_BASE}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    if (!resp.ok) throw new Error('Failed to create guest account');
    const data = await resp.json();
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }

  /** Authenticated fetch. */
  async _fetch(path, options = {}) {
    await this.ensureAuth();
    const resp = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    });
    if (resp.status === 401) {
      // Token expired — re-auth
      this.token = null;
      localStorage.removeItem(TOKEN_KEY);
      await this.ensureAuth();
      return this._fetch(path, options);
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return resp.json();
  }

  // ── Character CRUD ──

  async listCharacters() {
    const data = await this._fetch('/characters');
    return data.characters;
  }

  async createCharacter(character) {
    const data = await this._fetch('/characters', {
      method: 'POST',
      body: JSON.stringify(character),
    });
    return data.character;
  }

  async updateCharacter(id, updates) {
    const data = await this._fetch('/characters', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
    return data.character;
  }

  async deleteCharacter(id) {
    await this._fetch('/characters', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    return id;
  }

  /** Clear local auth (logout). */
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export const apiClient = new ApiClient();
