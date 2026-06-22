#!/usr/bin/env node
/**
 * Upload grudge6 animations + weapon FBX packs to R2 (models/animationsweapons/).
 *
 * Usage:
 *   node scripts/upload-playground-assets.mjs --dry-run
 *   node scripts/upload-playground-assets.mjs
 *
 * Env: R2_BUCKET (default grudge-assets), requires wrangler auth.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const R2_BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const R2_PREFIX = 'models/animationsweapons/';
const dryRun = process.argv.includes('--dry-run');

const SOURCE_ROOTS = [
  process.env.ANIMATIONS_SOURCE || 'D:\\Games\\Models\\grudgeracecharacters\\animationsweapons',
  path.resolve('..', 'animationsweapons'),
  path.resolve('..', 'factioncharacters', 'animationsweapons'),
];

function findSourceRoot() {
  for (const root of SOURCE_ROOTS) {
    if (root && fs.existsSync(root)) return root;
  }
  return null;
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(fbx|glb|gltf)$/i.test(name)) files.push(full);
  }
  return files;
}

const source = findSourceRoot();
if (!source) {
  console.error('No animationsweapons source found. Set ANIMATIONS_SOURCE or place assets at:');
  SOURCE_ROOTS.forEach((r) => console.error('  -', r));
  process.exit(1);
}

const files = walk(source);
console.log(`Source: ${source}`);
console.log(`Files:  ${files.length}`);
console.log(`Target: ${R2_BUCKET}/${R2_PREFIX}\n`);

let ok = 0;
let fail = 0;

for (const filePath of files) {
  const rel = path.relative(source, filePath).replace(/\\/g, '/');
  const r2Key = `${R2_PREFIX}${rel}`;
  const sizeMb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
  console.log(`${dryRun ? '[dry-run] ' : ''}${rel} (${sizeMb} MB)`);
  if (dryRun) { ok++; continue; }
  try {
    execSync(
      `npx wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file="${filePath}" --content-type="application/octet-stream"`,
      { stdio: 'pipe', encoding: 'utf8' },
    );
    ok++;
  } catch (err) {
    console.error('  FAILED:', err.stderr?.split('\n')[0] || err.message);
    fail++;
  }
}

console.log(`\nDone: ${ok} uploaded, ${fail} failed`);
if (fail) process.exit(1);