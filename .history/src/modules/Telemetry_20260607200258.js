/**
 * Telemetry — client-side event batcher for the grudge_events pipeline.
 *
 * Pipeline:  browser → POST /api/events (Worker) → GRUDGE_EVENTS_STREAM → R2 (parquet+zstd)
 *
 * Design:
 *   - Best-effort, silent-fail. Never throws into caller code.
 *   - Auto-flushes every FLUSH_INTERVAL_MS or when QUEUE reaches MAX_BATCH.
 *   - Uses navigator.sendBeacon() on pagehide for reliable last-call delivery.
 *   - Caller identity (grudge_id) is set once via setIdentity() after auth.
 *
 * Usage:
 *   import { telemetry } from './Telemetry.js';
 *   telemetry.init({ endpoint: 'https://models.grudge-studio.com/api/events' });
 *   telemetry.setIdentity({ grudgeId: user.grudgeId });
 *   telemetry.track('equipment_change', { slot: 'body', variant: 'B' });
 */

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 25;
const MAX_QUEUE = 200;

// event_type values must match the Worker's ALLOWED_EVENT_TYPES set.
export const EVENT_TYPES = Object.freeze({
  CHARACTER_SAVE:   'character_save',
  CHARACTER_UPDATE: 'character_update',
  CHARACTER_DELETE: 'character_delete',
  CHARACTER_ACTIVE: 'character_active',
  EQUIPMENT_CHANGE: 'equipment_change',
  WEAPON_EQUIP:     'weapon_equip',
  COMBAT_ACTION:    'combat_action',
  ASSET_LOAD:       'asset_load',
  SESSION_START:    'session_start',
  SESSION_END:      'session_end',
});

// Top-level columns the stream schema knows about; everything else nests in `payload`.
const TOP_LEVEL_KEYS = ['faction_id', 'race_id', 'slot', 'variant'];

function makeSessionId() {
  // 16 hex chars — collision-resistant for per-tab session attribution
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

class Telemetry {
  constructor() {
    this.endpoint = null;
    this.enabled = false;
    this.grudgeId = null;
    this.sessionId = makeSessionId();
    this.queue = [];
    this._timer = null;
    this._unloadBound = false;
  }

  init({ endpoint, enabled = true } = {}) {
    this.endpoint = endpoint || null;
    this.enabled = Boolean(endpoint) && enabled;
    if (!this.enabled) return;
    this._scheduleFlush();
    this._bindUnload();
    this.track(EVENT_TYPES.SESSION_START, {
      payload: { ua: navigator.userAgent, lang: navigator.language },
    });
  }

  setIdentity({ grudgeId } = {}) {
    this.grudgeId = grudgeId || null;
  }

  /**
   * Queue an event. Fields that match TOP_LEVEL_KEYS are lifted out;
   * everything else is nested inside `payload`.
   */
  track(eventType, fields = {}) {
    if (!this.enabled) return;
    if (this.queue.length >= MAX_QUEUE) return; // drop oldest-protected

    const row = {
      event_type: eventType,
      session_id: this.sessionId,
      grudge_id: this.grudgeId || undefined,
    };
    const payload = (fields.payload && typeof fields.payload === 'object')
      ? { ...fields.payload } : {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'payload') continue;
      if (TOP_LEVEL_KEYS.includes(k)) row[k] = v;
      else payload[k] = v;
    }
    if (Object.keys(payload).length > 0) row.payload = payload;
    this.queue.push(row);

    if (this.queue.length >= MAX_BATCH) this.flush();
  }

  async flush() {
    if (!this.enabled || !this.endpoint || this.queue.length === 0) return;
    const batch = this.queue.splice(0, MAX_BATCH);
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // silent-fail: telemetry must never break the app
    }
  }

  /** Synchronous best-effort send used on page unload. */
  _flushBeacon() {
    if (!this.enabled || !this.endpoint || this.queue.length === 0) return;
    const batch = this.queue.splice(0, MAX_BATCH);
    try {
      const blob = new Blob([JSON.stringify({ events: batch })],
        { type: 'application/json' });
      navigator.sendBeacon(this.endpoint, blob);
    } catch { /* ignore */ }
  }

  _scheduleFlush() {
    if (this._timer) return;
    this._timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  _bindUnload() {
    if (this._unloadBound || typeof window === 'undefined') return;
    this._unloadBound = true;
    window.addEventListener('pagehide', () => {
      this.track(EVENT_TYPES.SESSION_END);
      this._flushBeacon();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._flushBeacon();
    });
  }
}

export const telemetry = new Telemetry();
