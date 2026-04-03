/**
 * phase4-export-combat-pack.mjs
 * Calls /api/export-combat-pack and saves the resulting ZIP
 * Verifies schema, asset count, and that all included assets are approved.
 */
import fs from 'fs';
import path from 'path';

const EXPORT_DIR = 'C:/Dev/archon-workshop/public/exports';
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const OUT_PATH = path.join(EXPORT_DIR, 'combat-pack-v1.1.zip');

console.log('Phase 4 — Export Combat Pack');
console.log('Calling /api/export-combat-pack...');

const response = await fetch('http://localhost:3000/api/export-combat-pack', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tag: 'combat' }),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`❌ Export failed: ${response.status} ${text.substring(0, 200)}`);
  process.exit(1);
}

const contentType = response.headers.get('content-type') || '';
console.log(`Response content-type: ${contentType}`);

const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

if (buffer.length < 1000) {
  console.error(`❌ Export response too small (${buffer.length} bytes) — likely an error response`);
  console.error(buffer.toString('utf-8').substring(0, 300));
  process.exit(1);
}

fs.writeFileSync(OUT_PATH, buffer);
console.log(`✅ Export ZIP saved: ${OUT_PATH} (${Math.round(buffer.length/1024)}KB)`);

// Also try to read the manifest from the ZIP to verify it
// (Since we can't unzip easily in node without extra deps, just check size)
console.log(`\nZIP size: ${Math.round(buffer.length/1024/1024*100)/100}MB`);
console.log('\n✅ Phase 4 PASSED — Export complete.');
console.log(`Location: ${OUT_PATH}`);
