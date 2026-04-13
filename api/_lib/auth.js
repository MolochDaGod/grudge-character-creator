import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'grudge-dev-secret';

/**
 * Extract and verify JWT from Authorization header.
 * Returns decoded payload or null.
 */
export function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), SECRET);
  } catch {
    return null;
  }
}

/**
 * CORS headers for all API routes.
 */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
