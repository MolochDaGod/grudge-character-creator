/**
 * ApiClient — Puter-backed auth & KV storage for the Grudge Character Creator.
 *
 * Uses Puter SDK for authentication (puter.auth) and key-value persistence (puter.kv).
 * Each puter ID automatically maps to a Grudge ID stored in KV.
 */

const CHARS_KEY = 'grudge_characters';
const PROFILE_KEY = 'grudge_profile';
const MAX_CHARACTERS = 20;

class ApiClient {
  constructor() {
    this.user = null;
    this._ready = false;
  }

  get isLoggedIn() {
    return this._ready && !!this.user;
  }

  /**
   * Ensure Puter auth is active. Signs in if needed, then loads/creates Grudge profile.
   */
  async ensureAuth() {
    if (this._ready && this.user) return this.user;

    // Wait for puter SDK to be available
    const puter = window.puter;
    if (!puter) throw new Error('Puter SDK not loaded');

    // Check if already authenticated
    let isSignedIn = puter.auth.isSignedIn();
    if (!isSignedIn) {
      // Trigger Puter sign-in
      await puter.auth.signIn();
      isSignedIn = puter.auth.isSignedIn();
      if (!isSignedIn) throw new Error('Sign-in was cancelled');
    }

    // Get puter user info
    const puterUser = await puter.auth.getUser();

    // Load or create Grudge profile from Puter KV
    let profile = null;
    try {
      const raw = await puter.kv.get(PROFILE_KEY);
      if (raw) profile = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* first time */ }

    if (!profile) {
      // Auto-create Grudge ID from puter username
      const tag = (puterUser.username || 'user').slice(0, 8).toUpperCase();
      profile = {
        grudgeId: `GRUDGE-${tag}-${Date.now().toString(36).toUpperCase()}`,
        puterId: puterUser.username,
        displayName: puterUser.username || 'Warlord',
        role: 'member',
        createdAt: new Date().toISOString(),
      };
      await puter.kv.set(PROFILE_KEY, JSON.stringify(profile));
    }

    this.user = {
      id: puterUser.uuid || puterUser.username,
      grudgeId: profile.grudgeId,
      displayName: profile.displayName,
      role: profile.role,
    };
    this._ready = true;
    return this.user;
  }

  // ── Character CRUD via Puter KV ──

  async _getChars() {
    try {
      const raw = await window.puter.kv.get(CHARS_KEY);
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
  }

  async _setChars(chars) {
    await window.puter.kv.set(CHARS_KEY, JSON.stringify(chars));
  }

  async listCharacters() {
    await this.ensureAuth();
    return this._getChars();
  }

  async createCharacter(character) {
    await this.ensureAuth();
    const chars = await this._getChars();
    if (chars.length >= MAX_CHARACTERS) {
      throw new Error(`Max ${MAX_CHARACTERS} characters per account`);
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newChar = {
      id,
      name: character.name || `Character ${chars.length + 1}`,
      factionId: character.factionId,
      raceId: character.raceId,
      equipped: character.equipped || {},
      attrs: character.attrs || {},
      level: character.level || 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    chars.push(newChar);
    await this._setChars(chars);
    return newChar;
  }

  async updateCharacter(id, updates) {
    await this.ensureAuth();
    const chars = await this._getChars();
    const idx = chars.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Character not found');

    const allowed = ['name', 'equipped', 'attrs', 'level', 'factionId', 'raceId'];
    for (const field of allowed) {
      if (updates[field] !== undefined) {
        chars[idx][field] = updates[field];
      }
    }
    chars[idx].updatedAt = new Date().toISOString();

    await this._setChars(chars);
    return chars[idx];
  }

  async deleteCharacter(id) {
    await this.ensureAuth();
    let chars = await this._getChars();
    const before = chars.length;
    chars = chars.filter(c => c.id !== id);
    if (chars.length === before) throw new Error('Character not found');
    await this._setChars(chars);
    return id;
  }

  /** Sign out of Puter and clear local state. */
  logout() {
    this.user = null;
    this._ready = false;
    try { window.puter.auth.signOut(); } catch { /* ignore */ }
  }
}

export const apiClient = new ApiClient();
