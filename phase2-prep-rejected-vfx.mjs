/**
 * phase2-prep-rejected-vfx.mjs
 * 
 * Updates the 4 rejected VFX entries with corrected model and explicit
 * "no character / pure particle effect" descriptions before browser generation.
 */
import fs from 'fs';

const MANIFEST_PATH = 'C:/Dev/archon-workshop/public/generated/manifests/asset-manifest.json';
const MODEL = 'gemini-3.1-flash-image-preview';

const REJECTED_VFX = [
  {
    id: 'combat-death-burst-light',
    name: 'Death Burst — Light',
    description: 'Pure holy disintegration VFX. Radiant gold and white energy shards exploding outward from center. Glowing dust motes, bloom flare, crystalline particles dissolving at edges. NO body, NO silhouette, NO figure, NO anatomy. Centered radial burst effect only. Overlay-safe.',
    subcategory: 'death',
    faction: 'light',
  },
  {
    id: 'combat-death-burst-dark',
    name: 'Death Burst — Dark',
    description: 'Pure void disintegration VFX. Purple and crimson dark energy shards collapsing inward then exploding. Smoke wisps, shadow fragments, void crackle at edges. NO body, NO silhouette, NO figure, NO anatomy. Centered imploding burst only. Overlay-safe.',
    subcategory: 'death',
    faction: 'dark',
  },
  {
    id: 'combat-spawn-light',
    name: 'Spawn Effect — Light',
    description: 'Pure holy arrival pulse VFX. Expanding ring of golden light with radiant rays shooting outward. Luminous flare, orbiting motes, gentle shockwave. NO angel, NO knight, NO wings, NO figure, NO character. Pure energy effect only. Overlay-safe.',
    subcategory: 'spawn',
    faction: 'light',
  },
  {
    id: 'combat-spawn-dark',
    name: 'Spawn Effect — Dark',
    description: 'Pure void portal pulse VFX. Swirling dark ring with shadow particles, crimson distortion ripple, purple energy flare spreading outward. NO warrior, NO dragon, NO wings, NO figure, NO character. Pure portal energy effect only. Overlay-safe.',
    subcategory: 'spawn',
    faction: 'dark',
  },
];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const now = new Date().toISOString();

for (const vfx of REJECTED_VFX) {
  const idx = manifest.assets.findIndex(a => a.id === vfx.id);
  if (idx === -1) { console.error(`MISSING: ${vfx.id}`); continue; }
  manifest.assets[idx] = {
    ...manifest.assets[idx],
    ...vfx,
    model_id: MODEL,
    stage: 'D',
    type: 'image',
    category: 'spell',
    requiresCutout: true,
    status: 'pending',
    version: 0,
    candidate_versions: [],
    asset_protected: false,
    retry_count: 0,
    updated_at: now,
  };
  console.log(`  ✅ ${vfx.id}: updated with corrected prompt + model`);
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log('\n✅ Phase 2 prep complete. 4 entries ready for browser generation.');
