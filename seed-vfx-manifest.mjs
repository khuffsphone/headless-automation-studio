/**
 * seed-vfx-manifest.mjs
 *
 * Seeds the 10 mission-target VFX entries into the live Workshop manifest.
 * SAFETY: only adds NEW entries. Never touches existing approved assets.
 * Then calls rehydrate to sync.
 */

import fs from 'fs';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';

// The 10 mission-target VFX IDs with correct metadata
const VFX_ENTRIES = [
  {
    id: 'combat-hit-flash-light',
    category: 'spell', subcategory: 'hit_flash', faction: 'light',
    name: 'Hit Flash — Light',
    description: 'Sacred golden impact burst. Appears on the target when the Knight lands a melee hit. Radiates outward like a sun flare. High contrast, reads clearly at game speed.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-hit-flash-dark',
    category: 'spell', subcategory: 'hit_flash', faction: 'dark',
    name: 'Hit Flash — Dark',
    description: 'Abyssal purple-black impact burst with shadow tendrils. Appears on target when the Sorceress lands a hit. Clear silhouette against light backgrounds.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-death-burst-light',
    category: 'spell', subcategory: 'death', faction: 'light',
    name: 'Death Burst — Light',
    description: 'Radiant holy explosion. Knight defeats an enemy unit. Bright white-gold circular burst expanding outward. Finale feeling.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-death-burst-dark',
    category: 'spell', subcategory: 'death', faction: 'dark',
    name: 'Death Burst — Dark',
    description: 'Void-energy collapse. Sorceress defeats an enemy unit. Dark implosion with purple crackling energy, fragments dissolving into shadow.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-spawn-light',
    category: 'spell', subcategory: 'spawn', faction: 'light',
    name: 'Spawn Effect — Light',
    description: 'Holy arrival aura. Golden light column descending with divine particle ring at base. Used when the Knight enters the arena.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-spawn-dark',
    category: 'spell', subcategory: 'spawn', faction: 'dark',
    name: 'Spawn Effect — Dark',
    description: 'Shadow portal emergence. Dark energy vortex with crackling purple rim. Used when the Sorceress enters the arena.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-heal-pulse',
    category: 'spell', subcategory: 'heal', faction: 'neutral',
    name: 'Heal Pulse',
    description: 'Green-white healing ripple expanding outward from a unit. Soft glowing rings. Gentle and readable.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-status-poison',
    category: 'spell', subcategory: 'status', faction: 'dark',
    name: 'Status — Poison',
    description: 'Toxic green swirling cloud overlay. Small icon-sized venom drip effect for poisoned unit. Reads clearly against unit portraits.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-status-stun',
    category: 'spell', subcategory: 'status', faction: 'neutral',
    name: 'Status — Stun',
    description: 'Yellow lightning crackle spiral over a unit. Classic stun stars orbit the unit. Reads clearly as a status indicator.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
  {
    id: 'combat-ambient-arena',
    category: 'spell', subcategory: 'ambient', faction: 'neutral',
    name: 'Ambient Arena Effect',
    description: 'Subtle arena atmosphere particle layer. Floating motes of golden dust that drift slowly. Very low opacity, adds depth without distraction.',
    stage: 'D', type: 'image', requiresCutout: true,
    model_id: 'gemini-2.0-flash-preview-image-generation',
    status: 'pending', version: 0, candidate_versions: [], asset_protected: false, retry_count: 0,
  },
];

// Load live manifest
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ Manifest not found:', MANIFEST_PATH);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const assets = manifest.assets;

console.log(`\nPhase 1 — VFX Manifest Seeding`);
console.log(`Current manifest: ${assets.length} entries`);

let added = 0, skipped = 0;
const now = new Date().toISOString();

for (const entry of VFX_ENTRIES) {
  const existing = assets.find((a) => a.id === entry.id);
  if (existing) {
    console.log(`  SKIP (exists): ${entry.id} [${existing.status}]`);
    skipped++;
  } else {
    assets.push({ ...entry, created_at: now, updated_at: now });
    console.log(`  ✅ SEEDED: ${entry.id}`);
    added++;
  }
}

// Save back
fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ assets }, null, 2));
console.log(`\nResult: ${added} seeded, ${skipped} skipped`);
console.log(`Manifest now has ${assets.length} entries`);

// Verify by re-reading
const VFX_IDS = VFX_ENTRIES.map(v => v.id);
const reloaded = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')).assets;
console.log('\nVerification:');
for (const id of VFX_IDS) {
  const found = reloaded.find(a => a.id === id);
  console.log(`  ${id}: ${found ? '✅ ' + found.status : '❌ MISSING'}`);
}
