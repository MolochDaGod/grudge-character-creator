#!/usr/bin/env node
/**
 * Grudge Character Creator — Local game server.
 *
 * Serves:
 *   /           → dist/ (Vite build output)
 *   /assets/*   → parent directory (factioncharacters, animationsweapons, environment)
 *
 * Usage:
 *   npm run serve            # port 4010
 *   node server.js --port 8080
 */

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '4010', 10);
const DIST = path.join(__dirname, 'dist');
const PARENT = path.resolve(__dirname, '..');

const app = express();

// ── Compression ──
app.use(compression());

// ── CORS for all routes ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  next();
});

// ── MIME types for 3D assets ──
const MIME_OVERRIDES = {
  '.gltf': 'model/gltf+json',
  '.glb':  'model/gltf-binary',
  '.fbx':  'application/octet-stream',
  '.bin':  'application/octet-stream',
  '.tga':  'application/octet-stream',
  '.hdr':  'application/octet-stream',
};

function setCustomMime(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (MIME_OVERRIDES[ext]) {
    res.setHeader('Content-Type', MIME_OVERRIDES[ext]);
  }
}

// ── /assets/* → serve from parent directory (3D models, textures, animations) ──
app.use('/assets', express.static(PARENT, {
  setHeaders: setCustomMime,
  maxAge: '1h',
  index: false,
  dotfiles: 'ignore',
}));

// ── / → serve the built app from dist/ ──
app.use(express.static(DIST, {
  maxAge: '10m',
  index: 'index.html',
}));

// ── SPA fallback → index.html for client-side routing ──
app.use((req, res) => {
  // Don't fallback for asset requests that genuinely 404
  if (req.path.startsWith('/assets/')) {
    return res.status(404).json({ error: 'Asset not found', path: req.path });
  }
  res.sendFile(path.join(DIST, 'index.html'));
});

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ⚔️  Grudge Character Creator');
  console.log('  ────────────────────────────');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Assets:  http://localhost:${PORT}/assets/`);
  console.log('');
  console.log('  /assets/factioncharacters/ADDITIONAL_MODELS/  → GLTF character models');
  console.log('  /assets/animationsweapons/                    → animation packs');
  console.log('  /environment/boss_wukong/                     → boss fight arena');
  console.log('');
});
