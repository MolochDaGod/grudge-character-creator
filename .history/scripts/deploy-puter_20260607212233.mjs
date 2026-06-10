/**
 * deploy-puter.mjs — Deploy the built dist/ folder to Puter hosting.
 *
 * Requires: PUTER_API_TOKEN env var (get from puter.com → Settings → API Keys)
 * Subdomain: grudge-character-creator → https://grudge-character-creator.puter.site
 *
 * Usage:
 *   PUTER_API_TOKEN=<token> npm run deploy:puter
 *   or set PUTER_API_TOKEN in .env and run: npm run deploy:puter
 */

// Requires Node.js 18+ for global FormData, Blob, and fetch (see package.json "engines").
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Node.js >=18 required (current: ${process.versions.node}). Global FormData/Blob/fetch are unavailable.`);
  process.exit(1);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SUBDOMAIN = 'grudge-character-creator';
const PUTER_HOSTING_API = 'https://api.puter.com/hosting';

const token = process.env.PUTER_API_TOKEN;
if (!token) {
  console.error('Error: PUTER_API_TOKEN is not set.');
  console.error('Get your token at puter.com → Settings → API Keys');
  process.exit(1);
}

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, base));
    } else {
      const rel = relative(base, full).replace(/\\/g, '/');
      const content = await readFile(full);
      files.push({ path: rel, content });
    }
  }
  return files;
}

async function deploy() {
  console.log(`Collecting files from dist/...`);
  const files = await collectFiles(DIST_DIR);
  console.log(`  ${files.length} files found`);

  const form = new FormData();
  form.append('subdomain', SUBDOMAIN);
  for (const { path, content } of files) {
    form.append('files', new Blob([content]), path);
  }

  console.log(`Deploying to ${SUBDOMAIN}.puter.site...`);
  const resp = await fetch(`${PUTER_HOSTING_API}/deploy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Deploy failed (${resp.status}):`, err);
    process.exit(1);
  }

  const result = await resp.json().catch(() => ({}));
  console.log(`\nDeployed: https://${SUBDOMAIN}.puter.site`);
  if (result.url) console.log(`URL: ${result.url}`);
}

deploy().catch(err => { console.error(err); process.exit(1); });
