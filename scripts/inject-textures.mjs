#!/usr/bin/env node
/**
 * inject-textures.mjs — Replace placeholder textures in GLBs with real race textures.
 *
 * FBX2glTF creates a 1×1 placeholder when it can't resolve 3ds Max texture map
 * references (Map #9, etc.). This script:
 *   1. Converts the TGA texture → WebP via sharp (smaller, faster, web-native)
 *   2. Replaces the placeholder in the GLB using gltf-transform
 *   3. Writes the final textured GLB
 *
 * Usage:
 *   node scripts/inject-textures.mjs
 *   node scripts/inject-textures.mjs --resize 1024   # downscale textures to 1024px
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import TGA from 'tga';
import fs from 'fs';
import path from 'path';

const DIST = path.resolve('dist-models');
const RESIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--resize') || '2048');

// Each race's main diffuse texture and all color variants
const RACE_TEXTURES = {
  human: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\textures\\WK_Standard_Units.tga',
    variants: {
      black: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_black.tga',
      blue:  'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_blue.tga',
      brown: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_brown.tga',
      green: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_green.tga',
      red:   'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_red.tga',
      white: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\WesternKingdoms\\models\\Materials\\Colors\\textures\\WK_StandardUnits_white.tga',
    },
  },
  barbarian: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Barbarians\\models\\Materials\\BRB_StandardUnits_texture.tga',
    variants: {
      brown: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Barbarians\\models\\Materials\\Color\\textures\\BRB_Standard_Units_brown.tga',
    },
  },
  elf: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\ELF_HighElves_Texture.tga',
    variants: {
      dark:      'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\ELF_DarkElves_Texture.tga',
      wood:      'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\ELF_WoodElves_Texture.tga',
      dark_blue: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\Color\\DarkElves\\textures\\ELF_DarkElves_Blue.tga',
      dark_green:'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\Color\\DarkElves\\textures\\ELF_DarkElves_Green.tga',
      dark_red:  'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\Color\\DarkElves\\textures\\ELF_DarkElves_Red.tga',
      wood_brown:'F:\\Documents\\Toon_RTS\\Toon_RTS\\Elves\\models\\Materials\\Color\\WoodElves\\textures\\ELF_WoodElves_Brown.tga',
    },
  },
  dwarf: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Dwarves\\models\\Materials\\DWF_Standard_Units.tga',
    variants: {
      brown: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Dwarves\\models\\Materials\\Colors\\Textures\\DWF_Units_Brown.tga',
    },
  },
  orc: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\textures\\ORC_StandardUnits.tga',
    variants: {
      black: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\color\\textures\\ORC_StandardUnits_black.tga',
      blue:  'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\color\\textures\\ORC_StandardUnits_blue.tga',
      brown: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\color\\textures\\ORC_StandardUnits_brown.tga',
      green: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\color\\textures\\ORC_StandardUnits_green.tga',
      red:   'F:\\Documents\\Toon_RTS\\Toon_RTS\\Orcs\\models\\Materials\\color\\textures\\ORC_StandardUnits_red.tga',
    },
  },
  undead: {
    main: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Undead\\models\\Materials\\UD_Standard_Units.tga',
    variants: {
      brown: 'F:\\Documents\\Toon_RTS\\Toon_RTS\\Undead\\models\\Materials\\Colors\\textures\\UD_Standard_Units_brown.tga',
    },
  },
};

async function tgaToPng(tgaPath, maxSize) {
  console.log(`    TGA → PNG: ${path.basename(tgaPath)}`);

  // Decode TGA to raw RGBA pixel buffer
  const tgaData = fs.readFileSync(tgaPath);
  const tga = new TGA(tgaData);
  const { width, height } = tga;
  console.log(`    TGA decoded: ${width}×${height}`);

  // Pipe raw RGBA pixels into sharp for resize + PNG encode
  const buf = await sharp(Buffer.from(tga.pixels), {
    raw: { width, height, channels: 4 },
  })
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toBuffer();

  console.log(`    PNG: ${(buf.length / 1024).toFixed(0)} KB`);
  return buf;
}

async function injectTexture(glbPath, pngBuffer, raceName) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(glbPath);

  const root = doc.getRoot();
  const textures = root.listTextures();

  if (textures.length === 0) {
    // No texture slot exists — create one and assign to all materials
    console.log(`    Creating new texture slot`);
    const tex = doc.createTexture(`${raceName}_diffuse`)
      .setImage(pngBuffer)
      .setMimeType('image/png');

    for (const mat of root.listMaterials()) {
      mat.setBaseColorTexture(tex);
    }
  } else {
    // Replace existing placeholder texture(s)
    for (const tex of textures) {
      const oldSize = tex.getImage()?.byteLength || 0;
      console.log(`    Replacing texture "${tex.getName()}" (${oldSize} bytes → ${pngBuffer.length} bytes)`);
      tex.setImage(pngBuffer);
      tex.setMimeType('image/png');
    }
  }

  // Write back
  const glb = await io.writeBinary(doc);
  fs.writeFileSync(glbPath, Buffer.from(glb));
  const finalSize = (fs.statSync(glbPath).size / 1024 / 1024).toFixed(2);
  console.log(`    GLB written: ${finalSize} MB`);
}

// ── Also upload color variants as separate PNGs to R2 ───────
async function convertVariants(raceName, variants) {
  const variantDir = path.join(DIST, 'textures', raceName);
  fs.mkdirSync(variantDir, { recursive: true });

  for (const [name, tgaPath] of Object.entries(variants)) {
    if (!fs.existsSync(tgaPath)) {
      console.log(`    ⚠ Variant ${name}: TGA not found`);
      continue;
    }
    const pngPath = path.join(variantDir, `${name}.png`);
    // Decode TGA → raw RGBA → sharp → PNG
    const tgaData = fs.readFileSync(tgaPath);
    const tga = new TGA(tgaData);
    await sharp(Buffer.from(tga.pixels), {
      raw: { width: tga.width, height: tga.height, channels: 4 },
    })
      .resize(RESIZE, RESIZE, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toFile(pngPath);
    const size = (fs.statSync(pngPath).size / 1024).toFixed(0);
    console.log(`    Variant ${name}: ${size} KB`);
  }
}

// ── Main ────────────────────────────────────────────────────
console.log(`\n⚔️  Texture Injection Pipeline\n`);
console.log(`  Max texture size: ${RESIZE}px`);
console.log(`  Output: ${DIST}\n`);

for (const [raceName, raceData] of Object.entries(RACE_TEXTURES)) {
  const glbPath = path.join(DIST, `${raceName}.glb`);

  console.log(`\n── ${raceName.toUpperCase()} ──`);

  if (!fs.existsSync(glbPath)) {
    console.log(`  ❌ GLB not found: ${glbPath}`);
    continue;
  }

  if (!fs.existsSync(raceData.main)) {
    console.log(`  ❌ Main texture not found: ${raceData.main}`);
    continue;
  }

  // Step 1: Convert main TGA → PNG
  console.log(`  Main texture:`);
  const pngBuffer = await tgaToPng(raceData.main, RESIZE);

  // Step 2: Inject into GLB
  console.log(`  Injecting into GLB:`);
  await injectTexture(glbPath, pngBuffer, raceName);

  // Step 3: Convert color variants to PNG (for R2 upload + runtime swapping)
  if (raceData.variants && Object.keys(raceData.variants).length > 0) {
    console.log(`  Color variants:`);
    await convertVariants(raceName, raceData.variants);
  }
}

// Summary
console.log(`\n────────────────────────────────────`);
const glbs = fs.readdirSync(DIST).filter(f => f.endsWith('.glb'));
for (const f of glbs) {
  const size = (fs.statSync(path.join(DIST, f)).size / 1024 / 1024).toFixed(2);
  console.log(`  ${f}: ${size} MB`);
}
console.log(`\n  Next: node scripts/upload-r2.mjs --remote`);
console.log(`  Variants: wrangler r2 object put for dist-models/textures/*`);
console.log('');
