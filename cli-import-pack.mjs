/**
 * cli-import-pack.mjs
 *
 * Automation-safe CLI import for a combat pack ZIP.
 * Uses POST /api/import-pack-from-path (no browser file picker needed).
 *
 * Usage:
 *   node cli-import-pack.mjs [path-to-zip]
 *
 * Example:
 *   node cli-import-pack.mjs C:\Dev\archon-workshop\public\exports\combat-pack-v1.1.zip
 *
 * Defaults to the latest export if no path is given.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ZIP = path.join(__dirname, 'archon-workshop/public/exports/combat-pack-v1.1.zip');
const zipPath = process.argv[2] || DEFAULT_ZIP;

if (!fs.existsSync(zipPath)) {
  console.error(`❌ ZIP not found: ${zipPath}`);
  console.error(`   Usage: node cli-import-pack.mjs [path-to-zip]`);
  process.exit(1);
}

console.log(`CLI Pack Import`);
console.log(`ZIP: ${zipPath}`);
console.log(`Calling POST http://localhost:3000/api/import-pack-from-path ...`);

const response = await fetch('http://localhost:3000/api/import-pack-from-path', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ zipPath }),
});

const result = await response.json();

if (!response.ok || !result.success) {
  console.error(`❌ Import failed: ${result.error}`);
  process.exit(1);
}

console.log(`\n✅ Import complete`);
console.log(`   Files imported: ${result.imported}`);
console.log(`   Files failed:   ${result.failed}`);
console.log(`   Assets in pack: ${result.assetCount}`);
console.log(`   Pack tags:      ${result.tag}`);

if (result.failedFiles?.length > 0) {
  console.warn(`\n⚠️  Failed files:`);
  result.failedFiles.forEach((f) => console.warn(`   - ${f}`));
}

console.log(`\nRun rehydrate to sync the manifest:`);
console.log(`  node rehydrate-and-check.mjs`);
