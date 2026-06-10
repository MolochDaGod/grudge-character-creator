import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.JWT_SECRET || 'grudge-dev-secret';
const TOKEN_EXPIRY = '30d';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { puterId, displayName } = req.body || {};

    const userId = uuidv4();
    const grudgeId = `GRUDGE-${userId.split('-')[0].toUpperCase()}`;

    const payload = {
      sub: userId,
      grudgeId,
      // puterId links this JWT to a Puter identity for the Puter bridge flow.
      // null when the user signs in as a plain guest without Puter.
      puterId: puterId || null,
      displayName: displayName || `Warlord_${grudgeId.slice(-4)}`,
      role: puterId ? 'puter' : 'guest',
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, SECRET, { expiresIn: TOKEN_EXPIRY });

    return res.status(200).json({
      token,
      user: {
        id: userId,
        grudgeId,
        displayName: payload.displayName,
        role: payload.role,
        puterId: payload.puterId,
      },
    });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
