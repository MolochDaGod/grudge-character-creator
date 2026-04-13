/**
 * CharacterStore — manages saved character builds with local cache and API sync.
 *
 * Emits events so the UI can react to changes:
 *   'change'  — characters list updated
 *   'active'  — active character changed
 *   'error'   — API error occurred
 */

import { apiClient } from './ApiClient.js';

const ACTIVE_KEY = 'grudge_active_character';

class CharacterStore extends EventTarget {
  constructor() {
    super();
    this.characters = [];
    this.activeId = localStorage.getItem(ACTIVE_KEY) || null;
    this._loaded = false;
  }

  get active() {
    return this.characters.find(c => c.id === this.activeId) || null;
  }

  /** Load characters from API. */
  async load() {
    try {
      this.characters = await apiClient.listCharacters();
      this._loaded = true;
      this._emit('change');

      // Auto-select active if still valid
      if (this.activeId && !this.active) {
        this.activeId = this.characters[0]?.id || null;
        localStorage.setItem(ACTIVE_KEY, this.activeId || '');
      }
      if (this.activeId) this._emit('active');
    } catch (err) {
      console.error('CharacterStore.load:', err);
      this._emit('error', err);
    }
  }

  /** Save a new character build. */
  async save(data) {
    try {
      const char = await apiClient.createCharacter(data);
      this.characters.push(char);
      this.activeId = char.id;
      localStorage.setItem(ACTIVE_KEY, char.id);
      this._emit('change');
      this._emit('active');
      return char;
    } catch (err) {
      console.error('CharacterStore.save:', err);
      this._emit('error', err);
      throw err;
    }
  }

  /** Update the active character. */
  async update(updates) {
    if (!this.activeId) return;
    try {
      const updated = await apiClient.updateCharacter(this.activeId, updates);
      const idx = this.characters.findIndex(c => c.id === this.activeId);
      if (idx !== -1) this.characters[idx] = updated;
      this._emit('change');
      return updated;
    } catch (err) {
      console.error('CharacterStore.update:', err);
      this._emit('error', err);
      throw err;
    }
  }

  /** Delete a character by id. */
  async remove(id) {
    try {
      await apiClient.deleteCharacter(id);
      this.characters = this.characters.filter(c => c.id !== id);
      if (this.activeId === id) {
        this.activeId = this.characters[0]?.id || null;
        localStorage.setItem(ACTIVE_KEY, this.activeId || '');
        this._emit('active');
      }
      this._emit('change');
    } catch (err) {
      console.error('CharacterStore.remove:', err);
      this._emit('error', err);
      throw err;
    }
  }

  /** Set active character by id. */
  setActive(id) {
    this.activeId = id;
    localStorage.setItem(ACTIVE_KEY, id || '');
    this._emit('active');
  }

  /** Serialize current editor state into a saveable object. */
  static serialize({ factionId, raceId, name, equipped, attrs, level }) {
    return {
      name: name || 'Unnamed',
      factionId,
      raceId,
      equipped: equipped || {},
      attrs: attrs || {},
      level: level || 1,
    };
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const characterStore = new CharacterStore();
