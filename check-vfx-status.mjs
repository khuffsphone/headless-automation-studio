// check-vfx-status.mjs
import fs from 'fs';

const MANIFEST = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';
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

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
console.log('VFX Status Check:');
for (const id of VFX_IDS) {
  const a = m.assets.find(x => x.id === id);
  console.log(`  ${id}: ${a ? a.status : 'NOT FOUND'} ${a?.path ? `(${a.path})` : ''}`);
}

// Also check core slice assets
const CORE = [
  'unit-light-knight-token', 'unit-light-knight-portrait', 'unit-light-knight-defeated',
  'unit-dark-sorceress-token', 'unit-dark-sorceress-portrait', 'unit-dark-sorceress-defeated',
  'arena-light', 'arena-dark',
  'music-battle-loop', 'sfx-melee-hit', 'sfx-death-light', 'sfx-death-dark',
  'voice-light-turn', 'voice-dark-turn', 'voice-battle', 'voice-victory', 'voice-defeat',
];
console.log('\nCore slice assets:');
for (const id of CORE) {
  const a = m.assets.find(x => x.id === id);
  console.log(`  ${id}: ${a ? a.status : '❌ NOT FOUND'}`);
}
