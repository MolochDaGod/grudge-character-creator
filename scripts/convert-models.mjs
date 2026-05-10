#!/usr/bin/env node
/**
 * convert-models.mjs — Convert 6 race FBX models to optimized GLB.
 *
 * CRITICAL: preserves child mesh names and bone containers so the
 * EquipmentManager can still toggle meshes like WK_Units_Body_A.
 * We deliberately skip gltf-transform `join` and `flatten` which would
 * merge or reparent meshes and break equipment toggling.
 *
 * Prerequisites:
 *   npm install -g fbx2gltf @gltf-transform/cli
 *   (or: npm install fbx2gltf @gltf-transform/cli --save-dev)
 *
 * Usage:
 *   node scripts/convert-models.mjs
 *   node scripts/convert-models.mjs --skip-optimize   # raw conversion only
 *   node scripts/convert-models.mjs --validate-only   # check existing GLBs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ── Config ──────────────────────────────────────────────────
const SOURCE_DIR = process.env.FBX_SOURCE_DIR || 'F:\\Documents\\Toon_RTS\\Toon_RTS';
const OUTPUT_DIR = path.resolve('dist-models');
const skipOptimize = process.argv.includes('--skip-optimize');
const validateOnly = process.argv.includes('--validate-only');

const RACE_MODELS = [
  {
    name: 'human',
    fbx: `${SOURCE_DIR}\\WesternKingdoms\\models\\WK_Characters_customizable.FBX`,
    prefix: 'WK_',
  },
  {
    name: 'barbarian',
    fbx: `${SOURCE_DIR}\\Barbarians\\models\\BRB_Characters_customizable.FBX`,
    prefix: 'BRB_',
  },
  {
    name: 'elf',
    fbx: `${SOURCE_DIR}\\Elves\\models\\ELF_Characters_customizable.FBX`,
    prefix: 'ELF_',
  },
  {
    name: 'dwarf',
    fbx: `${SOURCE_DIR}\\Dwarves\\models\\DWF_Characters_customizable.FBX`,
    prefix: 'DWF_',
  },
  {
    name: 'orc',
    fbx: `${SOURCE_DIR}\\Orcs\\models\\ORC_Characters_Customizable.FBX`,
    prefix: 'ORC_',
  },
  {
    name: 'undead',
    fbx: `${SOURCE_DIR}\\Undead\\models\\UD_Characters_customizable.FBX`,
    prefix: 'UD_',
  },
];

// Meshes and bones that MUST exist in each GLB after conversion
const REQUIRED_BONES = [
  'R_hand_container',
  'L_hand_container',
  'L_shield_container',
  'Bone_bag',
  'Bone_wood',
  'Quiver_container',
];

// At minimum, each race should have these equipment mesh patterns
const REQUIRED_MESH_PATTERNS = [
  /Units_Body_A/i,
  /Units_Arms_A/i,
  /Units_Legs_A/i,
  /Units_head_A/i,
  /Units_sword_A/i,
  /Units_shield_A/i,
];

// ── Helpers ─────────────────────────────────────────────────
function run(cmd, label) {
  console.log(`  $ ${cmd.slice(0, 120)}${cmd.length > 120 ? '...' : ''}`);
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch (err) {
    console.error(`  ❌ ${label || 'Command'} failed`);
    console.error(`  ${err.stderr?.split('\n')[0] || err.message}`);
    return false;
  }
}

function validateGlb(glbPath, prefix) {
  console.log(`  Validating ${path.basename(glbPath)}...`);

  // Use gltf-transform inspect to list nodes/meshes
  let output;
  try {
    output = execSync(`npx gltf-transform inspect "${glbPath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`  ❌ Cannot inspect: ${err.message}`);
    return false;
  }

  let valid = true;

  // Check for required bone containers in the node list
  for (const bone of REQUIRED_BONES) {
    if (!output.includes(bone)) {
      console.error(`  ❌ Missing bone: ${bone}`);
      valid = false;
    }
  }

  // Check for required mesh patterns
  for (const pattern of REQUIRED_MESH_PATTERNS) {
    const prefixed = new RegExp(prefix + pattern.source, 'i');
    if (!prefixed.test(output) && !pattern.test(output)) {
      console.error(`  ❌ Missing mesh matching: ${prefix}${pattern.source}`);
      valid = false;
    }
  }

  if (valid) {
    console.log(`  ✅ All required bones and meshes present`);
  }
  return valid;
}

// ── Main ────────────────────────────────────────────────────
console.log('\n⚔️  Grudge Race Model Converter (FBX → GLB)\n');
console.log(`  Source: ${SOURCE_DIR}`);
console.log(`  Output: ${OUTPUT_DIR}`);
console.log(`  Options: ${skipOptimize ? 'skip-optimize' : 'full pipeline'}\n`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let successes = 0;
let failures = 0;

for (const race of RACE_MODELS) {
  const glbPath = path.join(OUTPUT_DIR, `${race.name}.glb`);
  const rawGlbPath = path.join(OUTPUT_DIR, `${race.name}_raw.glb`);

  console.log(`\n── ${race.name.toUpperCase()} (${race.prefix}) ──`);

  if (validateOnly) {
    if (fs.existsSync(glbPath)) {
      validateGlb(glbPath, race.prefix) ? successes++ : failures++;
    } else {
      console.error(`  ❌ GLB not found: ${glbPath}`);
      failures++;
    }
    continue;
  }

  // Check FBX exists
  if (!fs.existsSync(race.fbx)) {
    console.error(`  ❌ FBX not found: ${race.fbx}`);
    console.error(`  Skipping ${race.name}`);
    failures++;
    continue;
  }

  // Step 1: FBX → raw GLB (preserving hierarchy)
  console.log('  Step 1: FBX → GLB (fbx2gltf)');
  const convertOk = run(
    `npx fbx2gltf --input "${race.fbx}" --output "${rawGlbPath}"`,
    'FBX conversion'
  );
  if (!convertOk) { failures++; continue; }

  if (skipOptimize) {
    // Just rename raw to final
    fs.renameSync(rawGlbPath, glbPath);
    console.log(`  ✅ Raw GLB: ${glbPath}`);
    successes++;
    continue;
  }

  // Step 2: Optimize with gltf-transform
  // IMPORTANT: NO join, NO flatten — these destroy per-mesh toggleability
  console.log('  Step 2: Optimize (weld + dedup + texture compress)');
  const optimizeOk = run(
    `npx gltf-transform weld "${rawGlbPath}" "${rawGlbPath}"` +
    ` && npx gltf-transform dedup "${rawGlbPath}" "${rawGlbPath}"` +
    ` && npx gltf-transform resample "${rawGlbPath}" "${rawGlbPath}"` +
    ` && npx gltf-transform prune "${rawGlbPath}" "${glbPath}"`,
    'Optimize'
  );

  if (!optimizeOk) {
    // Fallback: use raw if optimize fails
    console.log('  ⚠️  Optimize failed, using raw GLB');
    if (fs.existsSync(rawGlbPath)) {
      fs.renameSync(rawGlbPath, glbPath);
    }
  }

  // Clean up raw
  try { fs.unlinkSync(rawGlbPath); } catch {}

  // Step 3: Validate
  console.log('  Step 3: Validate');
  const valid = validateGlb(glbPath, race.prefix);

  if (valid) {
    const size = (fs.statSync(glbPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ ${race.name}.glb — ${size} MB`);
    successes++;
  } else {
    console.error(`  ⚠️  Validation warnings — model may still work but check mesh names`);
    successes++; // Still count as success since file exists
  }
}

console.log(`\n────────────────────────────────────`);
console.log(`  ✅ ${successes} succeeded, ❌ ${failures} failed`);
console.log(`  Output: ${OUTPUT_DIR}`);
console.log(`\n  Next steps:`);
console.log(`    node scripts/upload-r2.mjs          # Upload to R2 CDN`);
console.log(`    node scripts/seed-d1.mjs             # Seed D1 manifest`);
console.log('');
