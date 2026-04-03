import fs from 'fs';
const m = JSON.parse(fs.readFileSync('./archon-game/src/combat-pack-manifest.json','utf-8'));
const vfx = m.assets.filter(a => a.id.startsWith('combat-'));
vfx.forEach(a => console.log(a.id, '|', a.path));
console.log('\nTotal VFX in manifest:', vfx.length);
