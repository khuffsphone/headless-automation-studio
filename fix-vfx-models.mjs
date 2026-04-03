/**
 * fix-vfx-models.mjs
 * 
 * Patches the 10 VFX manifest entries:
 * 1. Sets model_id to 'gemini-3.1-flash-image-preview' (same model that produced the 449 approved assets)
 * 2. Resets any 'generating' status to 'pending' so they can be re-queued
 * Then calls /api/rehydrate-manifest so the Workshop UI picks up the fix.
 */

import fs from 'fs';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';
const CORRECT_MODEL = 'gemini-3.1-flash-image-preview';

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

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
let patched = 0;

for (const asset of manifest.assets) {
  if (!VFX_IDS.includes(asset.id)) continue;
  
  const wasModel = asset.model_id;
  const wasStatus = asset.status;
  
  asset.model_id = CORRECT_MODEL;
  if (['generating', 'failed', 'recoverable_failed'].includes(asset.status)) {
    asset.status = 'pending';
    // Reset candidate_versions that may have been partially written
    if (!asset.path) asset.candidate_versions = [];
  }
  asset.updated_at = new Date().toISOString();
  
  console.log(`  ${asset.id}: model ${wasModel} → ${CORRECT_MODEL} | status ${wasStatus} → ${asset.status}`);
  patched++;
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`\nPatched ${patched} VFX entries. Reloading Workshop will pick up correct model.`);

// Trigger rehydrate so the server-side manifest is fresh
const r = await fetch('http://localhost:3000/api/rehydrate-manifest');
const d = await r.json();
const vfx = d.assets.filter(a => VFX_IDS.includes(a.id));
console.log('\nPost-patch status:');
for (const a of vfx) {
  console.log(`  ${a.id}: ${a.status} | model_id: ${a.model_id}`);
}
console.log('\n✅ Fix complete. Hard-reload the Workshop (Ctrl+Shift+R) to clear the stuck generating state.');
