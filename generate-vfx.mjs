/**
 * generate-vfx.mjs
 *
 * Generates the 10 mission-target VFX sprites via Gemini API.
 * Writes PNG files to archon-workshop/public/generated/images/
 * Then calls /api/rehydrate-manifest to update manifest statuses.
 * All assets remain for Scene Lab human review before export.
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = 'AIzaSyBJ_BZvY9GNzCi45SzgF6YlR2VJBBUzwWk';
const IMAGES_DIR = path.join(__dirname, 'archon-workshop/public/generated/images');
const WORKSHOP_URL = 'http://localhost:3000';

const ai = new GoogleGenAI({ apiKey: API_KEY });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ── VFX generation prompts ────────────────────────────────────────────────────
// Style constraint: stained-glass / painted-light fantasy aesthetic
// consistent with the Knight vs Sorceress arena art already approved

const VFX = [
  {
    id: 'combat-hit-flash-light',
    prompt: `Fantasy game combat VFX sprite: Sacred radiant impact flash. A bright golden-white starburst explosion with rays of holy light radiating outward. Translucent edges. Pure white center transitioning to gold then transparent. Square sprite, transparent black background. Stained-glass fantasy art style. No text, no units, just the effect. High contrast, reads clearly at 512x512 game speed.`,
  },
  {
    id: 'combat-hit-flash-dark',
    prompt: `Fantasy game combat VFX sprite: Abyssal dark impact burst. A purple-black explosion with crackling violet lightning tendrils radiating outward. Shadow smoke wisps at edges. Dark center transitioning to purple then transparent. Square sprite, transparent black background. Stained-glass fantasy art style. No text, no units. High contrast against light backgrounds.`,
  },
  {
    id: 'combat-death-burst-light',
    prompt: `Fantasy game combat VFX sprite: Radiant holy death explosion. A large sacred nova burst — blinding white-gold circular shockwave expanding outward with trailing light particles and feather-like fragments dissolving into divine radiance. Finale energy. Square sprite, black background with transparent edges. Stained-glass fantasy art style. Epic scale.`,
  },
  {
    id: 'combat-death-burst-dark',
    prompt: `Fantasy game combat VFX sprite: Void implosion death effect. Purple-black energy collapsing inward with crackling dark lightning at the rim. Shadow fragments flying outward. Negative space center surrounded by swirling darkness. Square sprite, black background. Stained-glass fantasy art style. Dark faction finale. Epic and readable.`,
  },
  {
    id: 'combat-spawn-light',
    prompt: `Fantasy game combat VFX sprite: Holy unit entrance beam. A column of golden divine light descending vertically with a circular ring of light particles at the base expanding outward. Heavenly illumination from above. Vertical composition. Square sprite, black background. Stained-glass fantasy art style. Light faction arrival.`,
  },
  {
    id: 'combat-spawn-dark',
    prompt: `Fantasy game combat VFX sprite: Shadow portal emergence. A swirling dark vortex with crackling purple energy at the rim. Void tendrils curling outward from the center. Otherworldly dark energy. Square sprite, black background. Stained-glass fantasy art style. Dark faction arrival. Reads clearly.`,
  },
  {
    id: 'combat-heal-pulse',
    prompt: `Fantasy game combat VFX sprite: Gentle healing energy ripple. Concentric green-white glowing rings expanding outward from center. Soft luminosity, motes of healing light floating upward. Nurturing and gentle feeling. Square sprite, black background with transparent edges. Fantasy art style. Healer archetype visuals.`,
  },
  {
    id: 'combat-status-poison',
    prompt: `Fantasy game combat VFX sprite: Toxic poison status icon. A small swirling toxic green cloud bubble with acid drip particles. Venomous green glow. Skull-shaped smoke wisps optional. Small compact design for overlay on unit portrait. Square sprite, black background. Fantasy art style. Clearly reads as poison/toxic.`,
  },
  {
    id: 'combat-status-stun',
    prompt: `Fantasy game combat VFX sprite: Electric stun status effect. Yellow lightning crackle spiral with orbit stars circling. Classic cartoon stun visual — stars or spirals orbiting a central point with electric sparks. Bright yellow-white. Square sprite, black background. Fantasy art style. Clear status indicator that reads at small sizes.`,
  },
  {
    id: 'combat-ambient-arena',
    prompt: `Fantasy game VFX sprite: Atmospheric arena particle layer. Very low opacity golden dust motes and tiny light particles floating and drifting. Sparse distribution. More dark space than light. Subtle background ambience. Square sprite, mostly transparent/black. Fantasy art style. Must be very subtle — decorative only, must not compete with units or UI.`,
  },
];

async function generateVFX(vfx) {
  console.log(`\n[${vfx.id}] Generating...`);
  const outPath = path.join(IMAGES_DIR, `${vfx.id}.png`);

  // Skip if already exists and non-zero (idempotent)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    console.log(`  ⏭ Already exists (${Math.round(fs.statSync(outPath).size/1024)}KB), skipping.`);
    return { id: vfx.id, result: 'skipped', size: fs.statSync(outPath).size };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ parts: [{ text: vfx.prompt }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: { aspectRatio: '1:1', imageSize: '512px' },
      },
    });

    let imageData = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) { imageData = part.inlineData.data; break; }
    }

    if (!imageData) throw new Error('No image data returned from model');

    const buffer = Buffer.from(imageData, 'base64');
    if (buffer.length === 0) throw new Error('Zero-byte image returned');

    fs.writeFileSync(outPath, buffer);
    console.log(`  ✅ Generated (${Math.round(buffer.length/1024)}KB) → ${outPath}`);
    return { id: vfx.id, result: 'generated', size: buffer.length };

  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    return { id: vfx.id, result: 'failed', error: err.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('=== Phase 2: VFX Generation ===');
console.log(`Model: gemini-2.0-flash-preview-image-generation`);
console.log(`Output: ${IMAGES_DIR}\n`);

const results = [];
for (const vfx of VFX) {
  const result = await generateVFX(vfx);
  results.push(result);
  // Brief pause between requests
  await new Promise(r => setTimeout(r, 1500));
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n=== Generation Results ===');
let generated = 0, failed = 0, skipped = 0;
for (const r of results) {
  if (r.result === 'generated') { generated++; console.log(`  ✅ ${r.id} (${Math.round(r.size/1024)}KB)`); }
  else if (r.result === 'skipped') { skipped++; console.log(`  ⏭ ${r.id} (pre-existing)`); }
  else { failed++; console.log(`  ❌ ${r.id}: ${r.error}`); }
}
console.log(`\nGenerated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`);

if (failed > 0) {
  console.error('\n⚠️ Some VFX failed. Review errors above before proceeding to rehydrate.');
}

// ── Rehydrate ──────────────────────────────────────────────────────────────
if (generated + skipped > 0) {
  console.log('\n=== Calling /api/rehydrate-manifest ===');
  try {
    const r = await fetch(`${WORKSHOP_URL}/api/rehydrate-manifest`);
    const d = await r.json();
    const vfxIds = VFX.map(v => v.id);
    const vfxAssets = d.assets.filter(a => vfxIds.includes(a.id));
    console.log(`Rehydrate complete. VFX status after rehydrate:`);
    for (const a of vfxAssets) {
      console.log(`  ${a.id}: ${a.status} ${a.path ? `(${a.path})` : '(no path)'}`);
    }
  } catch(e) {
    console.error('Rehydrate failed:', e.message);
  }
}

console.log('\n✅ Phase 2 complete. All VFX are pending human review in Scene Lab.');
