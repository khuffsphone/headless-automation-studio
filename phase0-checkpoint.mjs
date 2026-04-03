/**
 * phase0-checkpoint.mjs
 * PHASE 0: Live verification after server restart.
 * 1. Rehydrate manifest and count entries (should NOT inflate with -v1 duplicates)
 * 2. Verify all 10 VFX are still approved
 * 3. Test the automation-safe import endpoint
 * 4. Freeze the baseline record
 */
import fs from 'fs';

const BASE = 'http://localhost:3000';

async function json(url, opts={}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${url}: ${r.status} ${await r.text().catch(()=>'')}`);
  return r.json();
}

console.log('=== PHASE 0 CHECKPOINT ===\n');

// 1. Pre-rehydrate count
const preLoad = await json(`${BASE}/api/load-manifest`);
const preCount = preLoad.assets?.length ?? 0;
console.log(`Pre-rehydrate manifest count: ${preCount}`);

// 2. Run rehydrate
console.log('Calling /api/rehydrate-manifest...');
const rehydrated = await json(`${BASE}/api/rehydrate-manifest`);
const postCount = rehydrated.assets?.length ?? 0;
console.log(`Post-rehydrate manifest count: ${postCount}`);

// Check dedup: delta should be 0 (no new orphan -v1 entries)
const delta = postCount - preCount;
console.log(`Delta: ${delta > 0 ? '+'+delta : delta}`);

// 3. VFX status
const VFX_IDS = [
  'combat-hit-flash-light','combat-hit-flash-dark',
  'combat-death-burst-light','combat-death-burst-dark',
  'combat-spawn-light','combat-spawn-dark',
  'combat-heal-pulse','combat-status-poison',
  'combat-status-stun','combat-ambient-arena',
];
console.log('\nVFX status after rehydrate:');
let vfxApproved = 0;
for (const id of VFX_IDS) {
  const a = rehydrated.assets.find(a => a.id === id);
  const status = a ? a.status : 'MISSING';
  if (status === 'approved') vfxApproved++;
  console.log(`  ${status === 'approved' ? '✅' : '❌'} ${id}: ${status}`);
}
console.log(`\nVFX approved: ${vfxApproved}/10`);

// 4. Check for versioned orphan duplicates
const versionedOrphans = rehydrated.assets.filter(a => /-v\d+$/.test(a.id));
const hasVersionedDuplicates = versionedOrphans.some(a => {
  const canonical = a.id.replace(/-v\d+$/, '');
  return rehydrated.assets.some(b => b.id === canonical);
});
console.log(`\nVersioned orphan entries: ${versionedOrphans.length}`);
console.log(`Dedup working (no canonical+versioned pairs): ${!hasVersionedDuplicates ? '✅ YES' : '❌ NO — STOP'}`);

// 5. Test automation-safe import endpoint
const ZIP_PATH = 'C:\\Dev\\archon-workshop\\public\\exports\\combat-pack-v1.1.zip';
if (fs.existsSync(ZIP_PATH)) {
  console.log('\nTesting /api/import-pack-from-path...');
  const importResult = await json(`${BASE}/api/import-pack-from-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zipPath: ZIP_PATH }),
  });
  console.log(`  Success: ${importResult.success}`);
  console.log(`  Imported: ${importResult.imported} files`);
  console.log(`  Failed: ${importResult.failed} files`);
  console.log(`  Assets in pack: ${importResult.assetCount}`);
  console.log(`  Automation import: ${importResult.success ? '✅ PASS' : '❌ FAIL'}`);
} else {
  console.log(`\n⚠️  Export ZIP not found at ${ZIP_PATH} — skipping import test`);
}

// 6. Summary
console.log('\n=== CHECKPOINT RESULT ===');
const dedupOk = !hasVersionedDuplicates;
const vfxOk = vfxApproved === 10;
console.log(`Dedup fix live: ${dedupOk ? '✅ PASS' : '❌ FAIL'}`);
console.log(`VFX 10/10 approved: ${vfxOk ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Post-rehydrate count: ${postCount}`);

if (!dedupOk || !vfxOk) {
  console.error('\n🛑 PHASE 0 BLOCKED — resolve issues above before launching lanes');
  process.exit(1);
}
console.log('\n✅ PHASE 0 CHECKPOINT PASSED — Concurrent lanes may launch');
