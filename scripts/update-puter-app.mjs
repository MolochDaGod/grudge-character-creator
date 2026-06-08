/**
 * update-puter-app.mjs
 * Repoint a Puter app's index_url to the freshly deployed subdomain.
 *
 * Usage:
 *   PUTER_API_TOKEN=<token> node scripts/update-puter-app.mjs <appName> <newIndexUrl>
 *
 * Example:
 *   node scripts/update-puter-app.mjs grudgeRPG https://grudge-character-creator.puter.site
 */
const token = process.env.PUTER_API_TOKEN;
if (!token) {
  console.error("Error: PUTER_API_TOKEN is not set.");
  process.exit(1);
}

const [, , appName, newIndexUrl] = process.argv;
if (!appName || !newIndexUrl) {
  console.error("Usage: node scripts/update-puter-app.mjs <appName> <newIndexUrl>");
  process.exit(1);
}

const API = "https://api.puter.com/drivers/call";

async function call(body) {
  const r = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!r.ok) {
    console.error(`HTTP ${r.status}:`, json);
    process.exit(1);
  }
  return json;
}

console.log(`Looking up Puter app "${appName}"...`);
const readResp = await call({
  interface: "puter-apps",
  method: "read",
  args: { id: { name: appName } },
});

const current = readResp.result;
if (!current) {
  console.error("App not found:", readResp);
  process.exit(1);
}

console.log("Current:");
console.log("  name      :", current.name);
console.log("  title     :", current.title);
console.log("  index_url :", current.index_url);

if (current.index_url === newIndexUrl) {
  console.log(`\nindex_url already set to ${newIndexUrl} — nothing to do.`);
  process.exit(0);
}

console.log(`\nUpdating index_url -> ${newIndexUrl}`);
const updateResp = await call({
  interface: "puter-apps",
  method: "update",
  args: {
    id: { name: appName },
    object: { index_url: newIndexUrl },
  },
});

if (!updateResp.success) {
  console.error("Update failed:", updateResp);
  process.exit(1);
}

console.log("\nVerifying...");
const verify = await call({
  interface: "puter-apps",
  method: "read",
  args: { id: { name: appName } },
});
console.log("  index_url :", verify.result?.index_url);
console.log("\nDone.");
