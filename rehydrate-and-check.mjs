// rehydrate-and-check.mjs
// Rehydrates the manifest so the -v1 VFX files get linked to their manifest entries

const VFX_IDS = [
  'combat-hit-flash-light', 'combat-hit-flash-dark',
  'combat-death-burst-light', 'combat-death-burst-dark',
  'combat-spawn-light', 'combat-spawn-dark',
  'combat-heal-pulse', 'combat-status-poison',
  'combat-status-stun', 'combat-ambient-arena',
];

console.log('Calling /api/rehydrate-manifest...');
const r = await fetch('http://localhost:3000/api/rehydrate-manifest');
const d = await r.json();

console.log(`Total assets: ${d.assets.length}`);
console.log('\nVFX status after rehydrate:');
for (const id of VFX_IDS) {
  const a = d.assets.find(x => x.id === id);
  if (a) {
    console.log(`  ${a.id}: ${a.status} | path: ${a.path || 'NONE'}`);
  } else {
    // Also check versioned orphan
    const orphan = d.assets.find(x => x.id === `${id}-v1`);
    console.log(`  ${id}: NOT FOUND (orphan: ${orphan ? orphan.id + ' ' + orphan.status : 'none'})`);
  }
}

const approved = d.assets.filter(a => VFX_IDS.includes(a.id) && a.status === 'approved').length;
console.log(`\nVFX approved: ${approved}/10`);
