#!/usr/bin/env node
/**
 * upload-r2.mjs — Upload optimized GLB models to Cloudflare R2.
 *
 * Uses wrangler CLI or @aws-sdk/client-s3 (S3-compatible API).
 *
 * Usage:
 *   node scripts/upload-r2.mjs                  # upload all from dist-models/
 *   node scripts/upload-r2.mjs --dry-run        # list files without uploading
 *   node scripts/upload-r2.mjs --sdk            # use S3 SDK instead of wrangler
 *
 * Env vars (for --sdk mode):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const INPUT_DIR = path.resolve('dist-models');
const R2_BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const R2_PREFIX = 'models/characters/';
const dryRun = process.argv.includes('--dry-run');
const useSdk = process.argv.includes('--sdk');

const MIME_TYPES = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

console.log('\n⚔️  Grudge R2 Asset Uploader\n');
console.log(`  Source:  ${INPUT_DIR}`);
console.log(`  Bucket:  ${R2_BUCKET}`);
console.log(`  Prefix:  ${R2_PREFIX}`);
console.log(`  Mode:    ${dryRun ? 'DRY RUN' : useSdk ? 'S3 SDK' : 'wrangler CLI'}\n`);

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`❌ Input directory not found: ${INPUT_DIR}`);
  console.error('   Run: node scripts/convert-models.mjs');
  process.exit(1);
}

const files = fs.readdirSync(INPUT_DIR).filter(f => {
  const ext = path.extname(f).toLowerCase();
  return ['.glb', '.gltf', '.bin', '.png', '.jpg', '.webp'].includes(ext);
});

if (files.length === 0) {
  console.error('❌ No uploadable files found');
  process.exit(1);
}

console.log(`  Found ${files.length} files to upload:\n`);

// ── Wrangler upload ─────────────────────────────────────────
async function uploadWithWrangler(file) {
  const filePath = path.join(INPUT_DIR, file);
  const r2Key = `${R2_PREFIX}${file}`;
  const ext = path.extname(file).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);

  console.log(`  📦 ${file} (${size} MB) → ${r2Key}`);

  if (dryRun) return true;

  try {
    execSync(
      `npx wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file="${filePath}" --content-type="${contentType}"`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    return true;
  } catch (err) {
    console.error(`  ❌ Upload failed: ${err.stderr?.split('\n')[0] || err.message}`);
    return false;
  }
}

// ── S3 SDK upload ───────────────────────────────────────────
async function uploadWithSdk(file) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const filePath = path.join(INPUT_DIR, file);
  const r2Key = `${R2_PREFIX}${file}`;
  const ext = path.extname(file).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);

  console.log(`  📦 ${file} (${size} MB) → ${r2Key}`);

  if (dryRun) return true;

  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: fs.readFileSync(filePath),
      ContentType: contentType,
    }));
    return true;
  } catch (err) {
    console.error(`  ❌ Upload failed: ${err.message}`);
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────
const uploadFn = useSdk ? uploadWithSdk : uploadWithWrangler;
let successes = 0;
let failures = 0;

for (const file of files) {
  const ok = await uploadFn(file);
  ok ? successes++ : failures++;
}

console.log(`\n────────────────────────────────────`);
console.log(`  ✅ ${successes} uploaded, ❌ ${failures} failed`);
if (dryRun) console.log('  (dry run — nothing was uploaded)');
console.log(`\n  Assets available at: https://assets.grudge-studio.com/${R2_PREFIX}`);
console.log('');
