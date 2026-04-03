/**
 * phase5-copy-vfx-assets.mjs
 *
 * Phase 5: Copy the 10 approved VFX files into archon-game/public/assets/
 * and update the combat-pack-manifest.json to include them.
 * 
 * Preserves all 17 existing core assets — only adds VFX entries.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_MANIFEST = path.join(__dirname, 'archon-workshop/public/generated/manifests/asset-manifest.json');
const SRC_PUBLIC   = path.join(__dirname, 'archon-workshop/public');
const DST_ASSETS   = path.join(__dirname, 'archon-game/public/assets');
const MANIFEST_DST = path.join(__dirname, 'archon-game/src/combat-pack-manifest.json');

const VFX_IDS = [
  'combat-hit-flash-light',
  'combat-hit-flash-dark',
  'combat-death-burst-light',
  'combat-death-burst-dark',
  'combat-spawn-light',
  'combat-spawn-dark',
  'combat-heal-pulse',
  'combat-status-poison',
  'combat-status-stun',
  'combat-ambient-arena',
];

if (!fs.existsSync(SRC_MANIFEST)) {
  console.error('❌ Workshop manifest not found:', SRC_MANIFEST);
  process.exit(1);
}
if (!fs.existsSync(MANIFEST_DST)) {
  console.error('❌ Game manifest not found:', MANIFEST_DST);
  process.exit(1);
}

fs.mkdirSync(DST_ASSETS, { recursive: true });

const workshopManifest = JSON.parse(fs.readFileSync(SRC_MANIFEST, 'utf-8'));
const gameManifest = JSON.parse(fs.readFileSync(MANIFEST_DST, 'utf-8'));

console.log('Phase 5 — Copy VFX Assets to archon-game');
console.log(`Workshop manifest: ${workshopManifest.assets.length} entries`);
console.log(`Game manifest: ${gameManifest.assets.length} existing assets`);

let copied = 0, skipped = 0, failed = 0;
const newVfxAssets = [];

for (const id of VFX_IDS) {
  const asset = workshopManifest.assets.find(a => a.id === id);

  if (!asset) { console.log(`  ⚠️ ${id}: NOT IN WORKSHOP MANIFEST`); failed++; continue; }
  if (asset.status !== 'approved') { console.log(`  ⚠️ ${id}: status=${asset.status} (not approved) — SKIP`); failed++; continue; }
  if (!asset.path) { console.log(`  ⚠️ ${id}: no path — SKIP`); failed++; continue; }

  const srcFile = path.join(SRC_PUBLIC, asset.path);
  if (!fs.existsSync(srcFile) || fs.statSync(srcFile).size === 0) {
    console.log(`  ❌ ${id}: source file missing or zero-byte: ${srcFile}`);
    failed++;
    continue;
  }

  const filename = path.basename(asset.path);
  const dstFile  = path.join(DST_ASSETS, filename);

  // Check if already up-to-date (same hash)
  const existingEntry = gameManifest.assets.find(a => a.id === id);
  if (existingEntry && existingEntry.hash === asset.hash && fs.existsSync(dstFile)) {
    console.log(`  ⏭ ${id}: already current — skip`);
    skipped++;
    newVfxAssets.push(existingEntry);
    continue;
  }

  fs.copyFileSync(srcFile, dstFile);
  const size = fs.statSync(dstFile).size;
  console.log(`  ✅ ${id} → /assets/${filename} (${Math.round(size/1024)}KB)`);
  copied++;

  newVfxAssets.push({
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

// Merge: keep existing core assets, upsert VFX entries
const coreAssets = gameManifest.assets.filter(a => !VFX_IDS.includes(a.id));
const updatedAssets = [...coreAssets, ...newVfxAssets];

const updatedManifest = {
  ...gameManifest,
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  tags: [...(gameManifest.tags || []), 'vfx'],
  assets: updatedAssets,
};

fs.writeFileSync(MANIFEST_DST, JSON.stringify(updatedManifest, null, 2));

// Verify all VFX files actually exist in game
console.log('\nVerification:');
let allGood = true;
for (const vfx of newVfxAssets) {
  const file = path.join(DST_ASSETS, path.basename(vfx.path));
  const exists = fs.existsSync(file);
  const size = exists ? fs.statSync(file).size : 0;
  const ok = exists && size > 0;
  if (!ok) allGood = false;
  console.log(`  ${ok ? '✅' : '❌'} ${vfx.id}: ${exists ? `${Math.round(size/1024)}KB` : 'MISSING'}`);
}

console.log(`\nResult: copied=${copied} skipped=${skipped} failed=${failed}`);
console.log(`Game manifest now has ${updatedAssets.length} assets (${coreAssets.length} core + ${newVfxAssets.length} VFX)`);
console.log(`Updated: archon-game/src/combat-pack-manifest.json`);

if (failed > 0 || !allGood) {
  console.error('\n🛑 Some VFX failed — review errors above before proceeding to Phase 6');
  process.exit(1);
}
console.log('\n✅ Phase 5 PASSED — VFX assets copied and manifest updated.');
