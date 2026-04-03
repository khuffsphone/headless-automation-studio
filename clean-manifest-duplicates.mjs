/**
 * clean-manifest-duplicates.mjs
 * One-time cleanup: remove versioned orphan entries from the workshop
 * manifest where a canonical entry already exists.
 * e.g. "combat-hit-flash-light-v1" is removed when "combat-hit-flash-light" exists.
 */
import fs from 'fs';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

const assets = manifest.assets;
const allIds = new Set(assets.map(a => a.id));
const stripVersion = id => id.replace(/-v\d+$/, '');

// Find pairs: versioned+canonical both exist
const toRemove = new Set();
let pairCount = 0;
for (const a of assets) {
  const canonical = stripVersion(a.id);
  if (canonical !== a.id && allIds.has(canonical)) {
    toRemove.add(a.id);
    pairCount++;
  }
}

console.log(`Total assets before cleanup: ${assets.length}`);
console.log(`Versioned duplicates of canonical entries: ${pairCount}`);

const cleaned = assets.filter(a => !toRemove.has(a.id));
console.log(`Total assets after cleanup: ${cleaned.length}`);
console.log(`Removed: ${assets.length - cleaned.length}`);

// Write back
const BACKUP_PATH = MANIFEST_PATH + '.bak';
fs.copyFileSync(MANIFEST_PATH, BACKUP_PATH);
console.log(`Backup saved: ${BACKUP_PATH}`);

fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ assets: cleaned }, null, 2));
console.log(`Manifest cleaned and saved.`);

// Spot-check VFX
const VFX_IDS = [
  'combat-hit-flash-light','combat-hit-flash-dark',
  'combat-death-burst-light','combat-death-burst-dark',
  'combat-spawn-light','combat-spawn-dark',
  'combat-heal-pulse','combat-status-poison',
  'combat-status-stun','combat-ambient-arena',
];
console.log('\nVFX canonical entries after cleanup:');
for (const id of VFX_IDS) {
  const entry = cleaned.find(a => a.id === id);
  console.log(`  ${entry ? '✅' : '❌'} ${id}: ${entry ? entry.status : 'MISSING'}`);
}

// Verify no more pairs
const remaining = cleaned.filter(a => {
  const c = stripVersion(a.id);
  return c !== a.id && cleaned.some(b => b.id === c);
});
console.log(`\nRemaining duplicate pairs: ${remaining.length} ${remaining.length === 0 ? '✅' : '❌'}`);
