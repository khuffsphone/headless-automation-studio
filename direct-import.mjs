/**
 * direct-import.mjs
 * 
 * Bypasses the file-picker UI. Directly:
 * 1. Reads asset-manifest.json from the extracted zip
 * 2. Copies asset files into archon-workshop/public/generated/images/ and /audio/
 * 3. Calls /api/rehydrate-manifest to scan and update the live manifest
 * 4. Calls /api/materialize-assets to verify non-zero files and generate thumbnails
 * 5. Calls /api/verify-manifest to get valid + combat_ready
 * 6. Prints a full report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PACK_MANIFEST = 'C:/Temp/archon-pack-extract/asset-manifest.json';
const PACK_ASSETS   = 'C:/Temp/archon-pack-extract/assets';
const WORKSHOP_IMG  = path.join(__dirname, 'archon-workshop/public/generated/images');
const WORKSHOP_AUD  = path.join(__dirname, 'archon-workshop/public/generated/audio');
const WORKSHOP_URL  = 'http://localhost:3000';

// ── 1. Ensure destination dirs ──────────────────────────────────────────────
fs.mkdirSync(WORKSHOP_IMG, { recursive: true });
fs.mkdirSync(WORKSHOP_AUD, { recursive: true });

// ── 2. Read pack manifest ───────────────────────────────────────────────────
console.log('\n=== STEP 1: Reading pack manifest ===');
if (!fs.existsSync(PACK_MANIFEST)) {
  console.error('❌ Pack manifest not found at', PACK_MANIFEST);
  process.exit(1);
}
const packData = JSON.parse(fs.readFileSync(PACK_MANIFEST, 'utf-8'));
const packAssets = packData.assets || [];
console.log(`Found ${packAssets.length} assets in pack manifest`);

const byStatus = { approved: 0, other: 0 };
packAssets.forEach(a => {
  if (a.status === 'approved') byStatus.approved++;
  else byStatus.other++;
});
console.log(`  approved: ${byStatus.approved}  other: ${byStatus.other}`);

// ── 3. Copy files ─────────────────────────────────────────────────────────
console.log('\n=== STEP 2: Copying files ===');
let copied = 0, skipped = 0, zero = 0, missing = 0;

for (const asset of packAssets) {
  if (asset.status !== 'approved') { skipped++; continue; }
  
  // Find the file — pack uses flat names in /assets/
  const filename = asset.path?.split('/').pop();
  if (!filename) { missing++; continue; }
  
  const srcPath = path.join(PACK_ASSETS, filename);
  if (!fs.existsSync(srcPath)) { 
    // Try without version suffix
    const altName = filename.replace(/-v\d+/, '');
    const altPath = path.join(PACK_ASSETS, altName);
    if (!fs.existsSync(altPath)) { missing++; continue; }
  }
  
  const actualSrc = fs.existsSync(path.join(PACK_ASSETS, filename)) 
    ? path.join(PACK_ASSETS, filename) 
    : path.join(PACK_ASSETS, filename.replace(/-v\d+/, ''));
  
  if (fs.statSync(actualSrc).size === 0) { zero++; continue; }
  
  const isAudio = asset.type === 'audio' || /\.(wav|mp3)$/i.test(filename);
  const destDir = isAudio ? WORKSHOP_AUD : WORKSHOP_IMG;
  const destPath = path.join(destDir, filename);
  
  fs.copyFileSync(actualSrc, destPath);
  copied++;
}

console.log(`  copied: ${copied}  skipped (non-approved): ${skipped}  zero-byte: ${zero}  missing: ${missing}`);

// ── 4. Copy the manifest itself ─────────────────────────────────────────
console.log('\n=== STEP 3: Installing pack manifest ===');
const manifestDir = path.join(__dirname, 'archon-workshop/public/generated/manifests');
fs.mkdirSync(manifestDir, { recursive: true });

// Rewrite asset paths to match the workshop's served paths
const rewrittenAssets = packAssets.filter(a => a.status === 'approved').map(a => {
  const filename = a.path?.split('/').pop() || `${a.id}.png`;
  const isAudio  = a.type === 'audio' || /\.(wav|mp3)$/i.test(filename);
  const subDir   = isAudio ? 'audio' : 'images';
  return {
    ...a,
    path: `/generated/${subDir}/${filename}`,
    thumbnail_64:  a.thumbnail_64  || null,
    thumbnail_256: a.thumbnail_256 || null,
    candidate_versions: a.candidate_versions || [],
  };
});

const newManifest = { assets: rewrittenAssets };
const manifestPath = path.join(manifestDir, 'asset-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2));
console.log(`  Wrote manifest with ${rewrittenAssets.length} approved entries`);

// ── 5. Call rehydrate ─────────────────────────────────────────────────────
console.log('\n=== STEP 4: Calling /api/rehydrate-manifest ===');
try {
  const r = await fetch(`${WORKSHOP_URL}/api/rehydrate-manifest`);
  const d = await r.json();
  const approved = d.assets?.filter(a => a.status === 'approved').length || 0;
  const total    = d.assets?.length || 0;
  console.log(`  rehydrate: ${total} total, ${approved} approved`);
} catch(e) {
  console.error('  rehydrate failed:', e.message);
}

// ── 6. Call materialize ────────────────────────────────────────────────────
console.log('\n=== STEP 5: Calling /api/materialize-assets ===');
try {
  const r = await fetch(`${WORKSHOP_URL}/api/materialize-assets`, { method: 'POST' });
  const d = await r.json();
  console.log(`  materialize: verified=${d.results?.verified} repaired=${d.results?.repaired} failed=${d.results?.failed} thumbnails=${d.results?.thumbnails}`);
  if ((d.results?.failed || 0) > 0) {
    console.warn('  ⚠️ Some assets failed materialization');
  }
} catch(e) {
  console.error('  materialize failed:', e.message);
}

// ── 7. Verify manifest ─────────────────────────────────────────────────────
console.log('\n=== STEP 6: Calling /api/verify-manifest ===');
try {
  const r = await fetch(`${WORKSHOP_URL}/api/verify-manifest`);
  const d = await r.json();
  console.log(`  valid: ${d.valid}`);
  console.log(`  combat_ready: ${d.combat_ready}`);
  if (d.errors?.length > 0) {
    console.log(`  errors (${d.errors.length}):`);
    d.errors.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }
  
  if (!d.valid) {
    console.error('\n❌ STOP GATE: valid=false. Fix errors before proceeding.');
    process.exit(1);
  }
  if (!d.combat_ready) {
    console.error('\n❌ STOP GATE: combat_ready=false. Required IDs missing.');
    process.exit(1);
  }
  
  console.log('\n✅ PHASE 1 GATE PASSED: valid=true, combat_ready=true');
} catch(e) {
  console.error('  verify failed:', e.message);
  process.exit(1);
}
