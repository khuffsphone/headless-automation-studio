/**
 * link-vfx-to-files.mjs
 *
 * The 10 VFX files were saved as combat-*-v1.png by the Workshop.
 * The manifest entries are combat-* (no suffix) and still show pending/no-path.
 * The rehydrate created orphan entries for the -v1 files.
 *
 * This script:
 * 1. Finds each combat-* entry in the manifest
 * 2. Links it to the -v1 file on disk
 * 3. Marks it 'approved' (generation first-pass auto-approval, same as Workshop behavior)
 * 4. Removes the duplicate -v1 orphan entries
 * 5. Saves the manifest
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';
const IMAGES_DIR = 'C:/Dev/archon-workshop/public/generated/images';

const VFX_IDS = [
  'combat-hit-flash-light', 'combat-hit-flash-dark',
  'combat-death-burst-light', 'combat-death-burst-dark',
  'combat-spawn-light', 'combat-spawn-dark',
  'combat-heal-pulse', 'combat-status-poison',
  'combat-status-stun', 'combat-ambient-arena',
];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const now = new Date().toISOString();
let linked = 0;

for (const id of VFX_IDS) {
  const assetIdx = manifest.assets.findIndex(a => a.id === id);
  if (assetIdx === -1) { console.log(`  ⚠️ ${id}: not in manifest`); continue; }

  // Find the -v1 file
  const filePath = path.join(IMAGES_DIR, `${id}-v1.png`);
  if (!fs.existsSync(filePath)) { console.log(`  ⚠️ ${id}: no -v1 file on disk`); continue; }
  const size = fs.statSync(filePath).size;
  if (size === 0) { console.log(`  ⚠️ ${id}: -v1 file is zero bytes`); continue; }

  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const servePath = `/generated/images/${id}-v1.png`;

  const version = { version: 1, path: servePath, created_at: now, hash, mime_type: 'image/png' };

  manifest.assets[assetIdx] = {
    ...manifest.assets[assetIdx],
    status: 'approved',
    path: servePath,
    version: 1,
    approved_version: 1,
    current_display_version: 1,
    candidate_versions: [version],
    asset_protected: true,
    hash,
    mime_type: 'image/png',
    updated_at: now,
  };

  console.log(`  ✅ ${id}: linked to ${servePath} (${Math.round(size/1024)}KB)`);
  linked++;
}

// Remove the -v1 orphan duplicates (they were created by rehydrate)
const before = manifest.assets.length;
manifest.assets = manifest.assets.filter(a => {
  return !VFX_IDS.some(id => a.id === `${id}-v1`);
});
const removed = before - manifest.assets.length;

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`\nLinked: ${linked}/10 | Orphans removed: ${removed} | Total assets: ${manifest.assets.length}`);

// Verify
const m2 = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
console.log('\nFinal VFX status:');
for (const id of VFX_IDS) {
  const a = m2.assets.find(x => x.id === id);
  console.log(`  ${a?.id}: ${a?.status} | ${a?.path || 'NO PATH'}`);
}
