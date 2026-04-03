#!/usr/bin/env node
/**
 * copy-combat-assets.mjs
 *
 * One-time helper: copies approved Knight + Sorceress assets from the
 * archon-workshop generated folder into archon-game/public/assets/.
 *
 * Run from c:\Dev after importing the timestamped zip into archon-workshop:
 *   node copy-combat-assets.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_MANIFEST = path.join(__dirname, 'archon-workshop/public/generated/manifests/asset-manifest.json');
const SRC_PUBLIC   = path.join(__dirname, 'archon-workshop/public');
const DST_ASSETS   = path.join(__dirname, 'archon-game/public/assets');

const REQUIRED_IDS = [
  'unit-light-knight-token',
  'unit-light-knight-portrait',
  'unit-light-knight-defeated',
  'unit-dark-sorceress-token',
  'unit-dark-sorceress-portrait',
  'unit-dark-sorceress-defeated',
  'arena-light',
  'arena-dark',
  'music-battle-loop',
  'sfx-melee-hit',
  'sfx-death-light',
  'sfx-death-dark',
  'voice-light-turn',
  'voice-dark-turn',
  'voice-battle',
  'voice-victory',
  'voice-defeat',
];

if (!fs.existsSync(SRC_MANIFEST)) {
  console.error('❌ No manifest found at', SRC_MANIFEST);
  console.error('   Run archon-workshop first and import the timestamped zip.');
  process.exit(1);
}

fs.mkdirSync(DST_ASSETS, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(SRC_MANIFEST, 'utf-8'));
const assets = manifest.assets || [];

let copied = 0, missing = 0, skipped = 0;
const packAssets = [];

for (const id of REQUIRED_IDS) {
  const asset = assets.find(a => a.id === id);

  if (!asset || asset.status !== 'approved' || !asset.path) {
    console.warn(`⚠️  ${id}: not approved or missing path — skipped`);
    missing++;
    continue;
  }

  const srcFile = path.join(SRC_PUBLIC, asset.path);
  if (!fs.existsSync(srcFile) || fs.statSync(srcFile).size === 0) {
    console.warn(`⚠️  ${id}: file missing on disk at ${srcFile}`);
    missing++;
    continue;
  }

  const filename = path.basename(asset.path);
  const dstFile  = path.join(DST_ASSETS, filename);
  fs.copyFileSync(srcFile, dstFile);
  console.log(`✅  ${id} → /assets/${filename}`);
  copied++;

  packAssets.push({
    id: asset.id,
    category: asset.category,
    subcategory: asset.subcategory,
    faction: asset.faction,
    type: asset.type,
    path: `/assets/${filename}`,
    hash: asset.hash || 'unknown',
    mime_type: asset.mime_type || 'image/png',
  });
}

// Regenerate combat-pack-manifest.json with real paths + hashes
const manifestOut = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  tags: ['knight', 'sorceress', 'arena', 'battle', 'sfx', 'voice'],
  assets: packAssets,
};

const manifestDst = path.join(__dirname, 'archon-game/src/combat-pack-manifest.json');
fs.writeFileSync(manifestDst, JSON.stringify(manifestOut, null, 2));

console.log();
console.log(`Copied: ${copied}  Missing: ${missing}  Skipped: ${skipped}`);
console.log(`Updated: archon-game/src/combat-pack-manifest.json`);
if (missing > 0) {
  console.log(`\nℹ️  Import the timestamped zip first via Workshop → Export → Import Pack`);
  console.log(`   Then run: node copy-combat-assets.mjs`);
}
