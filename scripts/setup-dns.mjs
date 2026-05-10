#!/usr/bin/env node
/**
 * setup-dns.mjs — Create Cloudflare DNS records for grudge-studio.com subdomains.
 *
 * Worker routes need DNS records to exist. This script creates proxied A records
 * pointing to 192.0.2.1 (dummy) — Cloudflare Workers intercept before hitting origin.
 *
 * Usage:
 *   1. Create a Cloudflare API Token at https://dash.cloudflare.com/profile/api-tokens
 *      - Permission: Zone > DNS > Edit
 *      - Zone resource: grudge-studio.com
 *   2. Set the token:
 *      $env:CF_DNS_TOKEN = "your-token-here"
 *   3. Run:
 *      node scripts/setup-dns.mjs
 *
 * Or add manually in Cloudflare Dashboard → DNS → Add Record:
 *   Type: A | Name: characters | Content: 192.0.2.1 | Proxy: ON (orange cloud)
 *   Type: A | Name: grudachain  | Content: 192.0.2.1 | Proxy: ON (orange cloud)
 */

const ZONE_ID = 'e8c0c2ee3063f24eb31affddabf9730a';
const TOKEN = process.env.CF_DNS_TOKEN;

if (!TOKEN) {
  console.log(`
⚔️  Grudge Studio DNS Setup

No CF_DNS_TOKEN found. You have two options:

OPTION A — Cloudflare Dashboard (fastest):
  1. Go to https://dash.cloudflare.com → grudge-studio.com → DNS → Records
  2. Add these records:

     Type   Name          Content       Proxy
     ─────  ────────────  ────────────  ─────
     A      characters    192.0.2.1     ON (orange cloud)
     A      grudachain    192.0.2.1     ON (orange cloud)

OPTION B — API Token:
  1. Go to https://dash.cloudflare.com/profile/api-tokens
  2. Create Token → Custom Token:
     - Permission: Zone > DNS > Edit
     - Zone: grudge-studio.com
  3. Run:
     $env:CF_DNS_TOKEN = "your-token"; node scripts/setup-dns.mjs
`);
  process.exit(0);
}

const RECORDS = [
  { type: 'A', name: 'characters', content: '192.0.2.1', proxied: true },
  { type: 'A', name: 'grudachain', content: '192.0.2.1', proxied: true },
];

async function createRecord(record) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...record, ttl: 1 }),
    }
  );
  const data = await resp.json();
  if (data.success) {
    console.log(`  ✅ ${record.name}.grudge-studio.com → ${record.content} [proxied]`);
  } else {
    const err = data.errors?.[0];
    if (err?.code === 81057) {
      console.log(`  ⚡ ${record.name}.grudge-studio.com already exists`);
    } else {
      console.log(`  ❌ ${record.name}: ${err?.message || JSON.stringify(data.errors)}`);
    }
  }
}

console.log('\n⚔️  Creating DNS records for grudge-studio.com\n');
for (const record of RECORDS) {
  await createRecord(record);
}
console.log('\nDone. Worker routes will now intercept traffic on these subdomains.\n');
