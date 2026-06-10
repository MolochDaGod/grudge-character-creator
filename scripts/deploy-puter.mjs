/**
 * deploy-puter.mjs — Deploy dist/ to Puter hosting via REST API.
 *
 * Flow:
 *   1. GET /whoami         — resolve username for FS paths
 *   2. POST /mkdir         — create app directory tree
 *   3. POST /batch         — upload each file (op:"write")
 *   4. POST /drivers/call  — create or update puter-subdomains entry
 *
 * Requires: PUTER_API_TOKEN env var
 * Result:   https://grudge-character-creator.puter.site
 *
 * Usage:
 *   PUTER_API_TOKEN=<token> npm run deploy:puter
 *   or set PUTER_API_TOKEN in .env and run: npm run deploy:puter
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SUBDOMAIN = 'grudge-character-creator';
const PUTER_API = 'https://api.puter.com';

const token = process.env.PUTER_API_TOKEN;
if (!token) {
  console.error('Error: PUTER_API_TOKEN is not set.');
  console.error('Set it in .env or as an environment variable.');
  process.exit(1);
}

const AUTH_HEADERS = { Authorization: `Bearer ${token}` };

async function apiPost(endpoint, body) {
  const resp = await fetch(`${PUTER_API}${endpoint}`, {
    method: 'POST',
    headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!resp.ok) throw new Error(`${endpoint} failed (${resp.status}): ${text}`);
  return json;
}

async function getUsername() {
  const resp = await fetch(`${PUTER_API}/whoami`, { headers: AUTH_HEADERS });
  if (!resp.ok) throw new Error(`/whoami failed: ${await resp.text()}`);
  const data = await resp.json();
  const username = data.username;
  if (!username) throw new Error('Could not resolve Puter username from /whoami');
  return username;
}

async function mkdirSafe(path) {
  try {
    await apiPost('/mkdir', { path, overwrite: true, dedupe_name: false });
  } catch (e) {
    if (!e.message.includes('already_exists') && !e.message.includes('409')) throw e;
  }
}

const MIME_MAP = {
  html: 'text/html', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
  webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', gltf: 'model/gltf+json',
  glb: 'model/gltf-binary', fbx: 'application/octet-stream',
  txt: 'text/plain', map: 'application/json',
};
function getMime(name) {
  return MIME_MAP[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
}

async function uploadFile(parentPath, name, content) {
  const mime = getMime(name);
  const operation = JSON.stringify({ op: 'write', path: parentPath, name, overwrite: true });
  const form = new FormData();
  form.append('operation', operation);
  form.append('file', new Blob([content], { type: mime }), name);

  const resp = await fetch(`${PUTER_API}/batch`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: form,
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Upload "${name}" failed (${resp.status}): ${text}`);
  let json;
  try { json = JSON.parse(text); } catch { return; }
  const r = json?.results?.[0];
  if (r?.error) throw new Error(`Upload "${name}" error: ${r.message || JSON.stringify(r)}`);
}

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else {
      const rel = relative(base, full).replace(/\\/g, '/');
      const content = await readFile(full);
      files.push({ rel, content });
    }
  }
  return files;
}

async function ensureSubdomain(appDirPath) {
  const list = await apiPost('/drivers/call', {
    interface: 'puter-subdomains',
    method: 'select',
    args: {},
  });
  const existing = list?.result?.find?.(s => s.subdomain === SUBDOMAIN);
  if (existing) {
    await apiPost('/drivers/call', {
      interface: 'puter-subdomains',
      method: 'update',
      args: { id: { subdomain: SUBDOMAIN }, object: { root_dir: appDirPath } },
    });
    return 'updated';
  }
  await apiPost('/drivers/call', {
    interface: 'puter-subdomains',
    method: 'create',
    args: { object: { subdomain: SUBDOMAIN, root_dir: appDirPath } },
  });
  return 'created';
}

async function deploy() {
  process.stdout.write('Resolving Puter account... ');
  const username = await getUsername();
  console.log(username);
  const APP_DIR = `/${username}/Desktop/${SUBDOMAIN}`;

  console.log('Collecting dist/ files...');
  const files = await collectFiles(DIST_DIR);
  console.log(`  ${files.length} files found`);

  // Unique parent directories, sorted so parents are created before children
  const dirs = new Set([APP_DIR]);
  for (const { rel } of files) {
    if (rel.includes('/')) dirs.add(`${APP_DIR}/${dirname(rel)}`);
  }
  const sortedDirs = [...dirs].sort();

  console.log(`Creating ${sortedDirs.length} director${sortedDirs.length === 1 ? 'y' : 'ies'}...`);
  for (const dir of sortedDirs) {
    await mkdirSafe(dir);
  }

  console.log(`Uploading ${files.length} files...`);
  let i = 0;
  for (const { rel, content } of files) {
    const parentInApp = rel.includes('/') ? `${APP_DIR}/${dirname(rel)}` : APP_DIR;
    await uploadFile(parentInApp, basename(rel), content);
    console.log(`  [${++i}/${files.length}] ${rel}`);
  }

  process.stdout.write('Configuring subdomain... ');
  const action = await ensureSubdomain(APP_DIR);
  console.log(action);

  console.log(`\nDeployed: https://${SUBDOMAIN}.puter.site`);
}

deploy().catch(err => {
  console.error('\nDeploy failed:', err.message);
  process.exit(1);
});
