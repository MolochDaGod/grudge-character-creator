/**
 * Copy committed static/game assets into dist/game for Vercel deploy.
 * Run after copying or building the main gametest dist bundle.
 *
 * Usage: node scripts/sync-static-game.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'static', 'game');
const destDir = path.join(root, 'dist', 'game');

if (!fs.existsSync(srcDir)) {
  console.error('Missing static/game/ — nothing to sync');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

for (const name of fs.readdirSync(srcDir)) {
  const from = path.join(srcDir, name);
  const to = path.join(destDir, name);
  fs.copyFileSync(from, to);
  console.log(`Copied ${name} -> dist/game/`);
}