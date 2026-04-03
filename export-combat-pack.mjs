// export-combat-pack.mjs — calls the workshop API and saves the ZIP
import fs from 'fs';

const URL = 'http://localhost:3000/api/export-combat-pack';
const OUTPUT = 'C:/Temp/archon-combat-pack-export.zip';
const MANIFEST_OUT = 'C:/Dev/archon-game/src/combat-pack-manifest.json';

const tags = ['knight', 'sorceress', 'arena', 'battle', 'sfx', 'voice'];

console.log(`Requesting combat pack export with tags: ${tags.join(', ')}`);
const res = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tags }),
});

if (!res.ok) {
  const err = await res.text();
  console.error('❌ Export failed:', res.status, err);
  process.exit(1);
}

const contentType = res.headers.get('content-type') || '';
console.log('Response content-type:', contentType);

const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(OUTPUT, buf);
console.log(`✅ ZIP saved: ${OUTPUT} (${buf.length.toLocaleString()} bytes)`);

// Extract the manifest from the ZIP using JSZip
const { default: JSZip } = await import('jszip');
const zip = await JSZip.loadAsync(buf);
const manifestFile = zip.file('combat-pack-manifest.json');
if (!manifestFile) {
  console.error('❌ No combat-pack-manifest.json in ZIP');
  process.exit(1);
}

const manifestContent = await manifestFile.async('string');
const manifest = JSON.parse(manifestContent);
console.log(`\nManifest: schema_version=${manifest.schema_version}`);
console.log(`Assets in export: ${manifest.assets.length}`);
manifest.assets.forEach(a => console.log(`  ${a.id} [${a.type}] ${a.faction || ''}`));

// Save manifest for inspection
fs.writeFileSync(MANIFEST_OUT + '.export-preview.json', JSON.stringify(manifest, null, 2));
console.log(`\nManifest preview saved to: ${MANIFEST_OUT}.export-preview.json`);
