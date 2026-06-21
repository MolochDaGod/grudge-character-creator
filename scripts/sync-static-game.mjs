/**
 * Copy committed static assets into dist/ for Vercel deploy.
 * Run after `vite build`.
 *
 * Usage: node scripts/sync-static-game.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Skip missing: ${path.relative(root, src)}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
      console.log(`Copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
    }
  }
}

const staticRoot = path.join(root, 'static');
if (!fs.existsSync(staticRoot)) {
  console.error('Missing static/ — nothing to sync');
  process.exit(1);
}

for (const name of fs.readdirSync(staticRoot)) {
  copyDir(path.join(staticRoot, name), path.join(root, 'dist', name));
}

const publicDir = path.join(root, 'public');
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(root, 'dist'));
}

console.log('Static sync complete.');