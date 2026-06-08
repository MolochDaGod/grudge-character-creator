/**
 * Simple key-value store abstraction.
 *
 * Uses the Upstash Redis REST API when KV_REST_API_URL + KV_REST_API_TOKEN are
 * set (provision at upstash.com or via the Vercel Marketplace → Upstash Redis).
 * Falls back to an in-memory Map for local dev — data resets on cold start.
 *
 * Required env vars:
 *   KV_REST_API_URL    — e.g. https://<name>.upstash.io
 *   KV_REST_API_TOKEN  — Upstash REST token
 */

// Upstash provides UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
// Also accept the legacy KV_REST_API_* names for compatibility.
const KV_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function kvFetch(cmd, ...args) {
  const resp = await fetch(`${KV_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([cmd, ...args]),
  });
  if (!resp.ok) throw new Error(`KV error: ${resp.status}`);
  const data = await resp.json();
  return data.result;
}

// ── In-memory fallback ──────────────────────────────────────
const memStore = new Map();

// ── Public API ──────────────────────────────────────────────
export async function get(key) {
  if (KV_URL && KV_TOKEN) {
    const raw = await kvFetch('GET', key);
    return raw ? JSON.parse(raw) : null;
  }
  return memStore.get(key) ?? null;
}

export async function set(key, value) {
  if (KV_URL && KV_TOKEN) {
    await kvFetch('SET', key, JSON.stringify(value));
    return;
  }
  memStore.set(key, value);
}

export async function del(key) {
  if (KV_URL && KV_TOKEN) {
    await kvFetch('DEL', key);
    return;
  }
  memStore.delete(key);
}
