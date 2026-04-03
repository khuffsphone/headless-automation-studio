/**
 * phase1-vfx-readiness.mjs
 * Confirms the 4 rejected IDs exist, resets them to pending.
 * Confirms the 6 approved IDs are untouched.
 */
import fs from 'fs';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';

const APPROVED_IDS = [
  'combat-hit-flash-light',
  'combat-hit-flash-dark',
  'combat-heal-pulse',
  'combat-status-poison',
  'combat-status-stun',
  'combat-ambient-arena',
];

const REJECTED_IDS = [
  'combat-death-burst-light',
  'combat-death-burst-dark',
  'combat-spawn-light',
  'combat-spawn-dark',
];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const now = new Date().toISOString();
const report = { approved: [], rejected: [], errors: [] };

// ── Verify approved assets are untouched ─────────────────────────────────────
console.log('=== APPROVED VFX (must NOT be modified) ===');
for (const id of APPROVED_IDS) {
  const a = manifest.assets.find(x => x.id === id);
  if (!a) { report.errors.push(`MISSING approved: ${id}`); console.log(`  ❌ MISSING: ${id}`); continue; }
  if (a.status !== 'approved') { report.errors.push(`Wrong status on approved: ${id} = ${a.status}`); }
  console.log(`  ✅ ${id}: ${a.status} | ${a.path || 'NO PATH'}`);
  report.approved.push({ id, status: a.status, path: a.path });
}

// ── Reset rejected assets to pending ─────────────────────────────────────────
console.log('\n=== REJECTED VFX (reset to pending) ===');
for (const id of REJECTED_IDS) {
  const idx = manifest.assets.findIndex(x => x.id === id);
  if (idx === -1) { report.errors.push(`MISSING rejected: ${id}`); console.log(`  ❌ MISSING: ${id}`); continue; }
  const a = manifest.assets[idx];
  const prev = a.status;
  manifest.assets[idx] = {
    ...a,
    status: 'pending',
    path: undefined,
    hash: undefined,
    version: 0,
    approved_version: undefined,
    current_display_version: 0,
    candidate_versions: [],
    asset_protected: false,
    updated_at: now,
    thumbnail_64: undefined,
    thumbnail_256: undefined,
  };
  console.log(`  ↩️  ${id}: ${prev} → pending`);
  report.rejected.push({ id, prev_status: prev, new_status: 'pending' });
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n=== PHASE 1 SUMMARY ===');
console.log(`Approved preserved: ${report.approved.filter(a => a.status === 'approved').length}/6`);
console.log(`Rejected reset to pending: ${report.rejected.filter(r => r.new_status === 'pending').length}/4`);
if (report.errors.length > 0) {
  console.error('ERRORS:', report.errors);
  process.exit(1);
}
console.log('\n✅ Phase 1 PASSED — Manifest ready for regeneration.');
