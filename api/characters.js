import { v4 as uuidv4 } from 'uuid';
import { verifyToken, setCors } from './_lib/auth.js';
import { get, set } from './_lib/store.js';

const MAX_CHARACTERS = 20;

function userKey(userId) {
  return `characters:${userId}`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const key = userKey(user.sub);

  try {
    // ── GET: list characters ──
    if (req.method === 'GET') {
      const chars = (await get(key)) || [];
      return res.status(200).json({ characters: chars });
    }

    // ── POST: create character ──
    if (req.method === 'POST') {
      const chars = (await get(key)) || [];
      if (chars.length >= MAX_CHARACTERS) {
        return res.status(400).json({ error: `Max ${MAX_CHARACTERS} characters per account` });
      }

      const { name, factionId, raceId, equipped, attrs, level } = req.body || {};
      if (!factionId || !raceId) {
        return res.status(400).json({ error: 'factionId and raceId are required' });
      }

      const character = {
        id: uuidv4(),
        name: name || `Character ${chars.length + 1}`,
        factionId,
        raceId,
        equipped: equipped || {},
        attrs: attrs || {},
        level: level || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      chars.push(character);
      await set(key, chars);
      return res.status(201).json({ character });
    }

    // ── PUT: update character ──
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Character id is required' });

      const chars = (await get(key)) || [];
      const idx = chars.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Character not found' });

      // Only allow updating safe fields
      const allowed = ['name', 'equipped', 'attrs', 'level', 'factionId', 'raceId'];
      for (const field of allowed) {
        if (updates[field] !== undefined) {
          chars[idx][field] = updates[field];
        }
      }
      chars[idx].updatedAt = new Date().toISOString();

      await set(key, chars);
      return res.status(200).json({ character: chars[idx] });
    }

    // ── DELETE: remove character ──
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Character id is required' });

      let chars = (await get(key)) || [];
      const before = chars.length;
      chars = chars.filter(c => c.id !== id);
      if (chars.length === before) {
        return res.status(404).json({ error: 'Character not found' });
      }

      await set(key, chars);
      return res.status(200).json({ deleted: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Characters API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
