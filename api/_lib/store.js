/**
 * Simple key-value store abstraction.
 *
 * In production with Vercel KV env vars set, uses the Vercel KV REST API.
 * Otherwise falls back to an in-memory Map (dev only — resets on cold start).
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// ── Vercel KV REST helpers ──────────────────────────────────
async function kvFetch(cmd, ...args) {
  const body = [cmd, ...args];
  const resp = await fetch(`${KV_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
