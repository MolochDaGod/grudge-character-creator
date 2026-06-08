import { verifyToken, setCors } from '../_lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    user: {
      id: user.sub,
      grudgeId: user.grudgeId,
      displayName: user.displayName,
      role: user.role,
      puterId: user.puterId || null,
    },
  });
}
