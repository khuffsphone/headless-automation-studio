/**
 * smoke-tests.mjs
 * Archon combat-slice-v1.1.1 smoke tests
 * Run with: node smoke-tests.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
const FAILURES = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    FAILURES.push({ name, error: e.message });
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── 1. Game manifest schema validation ────────────────────────────────────────
console.log('\n1. Game manifest schema validation');
const GAME_MANIFEST_PATH = path.join(__dirname, 'archon-game/src/combat-pack-manifest.json');
const gameManifest = JSON.parse(fs.readFileSync(GAME_MANIFEST_PATH, 'utf-8'));

test('schema_version is 1.0', () => assert(gameManifest.schema_version === '1.0', `got ${gameManifest.schema_version}`));
test('has 27 assets total', () => assert(gameManifest.assets.length === 27, `got ${gameManifest.assets.length}`));
test('has 17 core assets', () => {
  const core = gameManifest.assets.filter(a => !a.id.startsWith('combat-'));
  assert(core.length === 17, `got ${core.length}`);
});
test('has 10 VFX assets', () => {
  const vfx = gameManifest.assets.filter(a => a.id.startsWith('combat-'));
  assert(vfx.length === 10, `got ${vfx.length}`);
});

// ── 2. VFX asset copy verification ────────────────────────────────────────────
console.log('\n2. VFX asset copy verification');
const VFX_IDS = [
  'combat-hit-flash-light', 'combat-hit-flash-dark',
  'combat-death-burst-light', 'combat-death-burst-dark',
  'combat-spawn-light', 'combat-spawn-dark',
  'combat-heal-pulse', 'combat-status-poison',
  'combat-status-stun', 'combat-ambient-arena',
];
const DST_ASSETS = path.join(__dirname, 'archon-game/public/assets');

for (const id of VFX_IDS) {
  test(`${id} — in manifest`, () => {
    const entry = gameManifest.assets.find(a => a.id === id);
    assert(entry, `Not found in manifest`);
  });
  test(`${id} — file on disk`, () => {
    const entry = gameManifest.assets.find(a => a.id === id);
    assert(entry, `Not in manifest`);
    const file = path.join(__dirname, 'archon-game/public', entry.path);
    assert(fs.existsSync(file), `File missing: ${file}`);
    const size = fs.statSync(file).size;
    assert(size > 1000, `File too small: ${size} bytes`);
  });
}

// ── 3. Hit-flash target anchor logic (static analysis) ────────────────────────
console.log('\n3. Hit-flash target anchor (static analysis)');
const SCENE_PATH = path.join(__dirname, 'archon-game/src/features/combat/CombatScene.tsx');
const sceneSource = fs.readFileSync(SCENE_PATH, 'utf-8');

test('Uses lastEventFaction directly (no inversion)', () => {
  // Must NOT contain the old inversion pattern
  const hasOldInversion = sceneSource.includes("lastEventFaction === 'light' ? 'dark' : 'light'");
  assert(!hasOldInversion, 'Old inversion pattern still present — bug NOT fixed');
});
test('Assigns defenderFaction = state.lastEventFaction', () => {
  const ok = sceneSource.includes('defenderFaction = state.lastEventFaction');
  assert(ok, 'Direct assignment not found');
});
test('defenderSide is based on defenderFaction directly', () => {
  const ok = sceneSource.includes("defenderFaction === 'light' ? 'left' : 'right'");
  assert(ok, 'Defender side mapping not found with correct pattern');
});
test('Death VFX uses defenderFaction', () => {
  const ok = sceneSource.includes("defenderFaction === 'light' ? 'combat-death-burst-light' : 'combat-death-burst-dark'");
  assert(ok, 'Death VFX selection not found');
});
test('Spawn VFX hook exists', () => {
  const ok = sceneSource.includes('combat-spawn-light') && sceneSource.includes('combat-spawn-dark');
  assert(ok, 'Spawn VFX hook missing');
});
test('Ambient arena crest hook exists', () => {
  const ok = sceneSource.includes('combat-ambient-arena');
  assert(ok, 'Ambient arena crest missing');
});

// ── 4. Manifest duplicate prevention (no -v1 duplicates in game manifest) ─────
console.log('\n4. Manifest duplicate detection');
test('No versioned duplicate IDs (-v1, -v2, etc.)', () => {
  const versionedIds = gameManifest.assets.filter(a => /-v\d+$/.test(a.id));
  assert(versionedIds.length === 0, `Found ${versionedIds.length} versioned IDs: ${versionedIds.map(a=>a.id).join(', ')}`);
});
test('All asset IDs are unique', () => {
  const ids = gameManifest.assets.map(a => a.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(dupes.length === 0, `Duplicate IDs: ${dupes.join(', ')}`);
});
test('No canonical ID has a versioned duplicate', () => {
  const ids = new Set(gameManifest.assets.map(a => a.id));
  const canonicals = [...ids].map(id => id.replace(/-v\d+$/, ''));
  // Each canonical should appear at most once
  const seen = new Set();
  for (const c of canonicals) {
    assert(!seen.has(c), `Canonical ID "${c}" appears multiple times (versioned + canonical)`);
    seen.add(c);
  }
});

// ── 5. Pack version validation ────────────────────────────────────────────────
console.log('\n5. Pack version validation');
test('schema_version matches expected "1.0"', () => {
  assert(gameManifest.schema_version === '1.0', `Got ${gameManifest.schema_version}`);
});
test('generated_at is a valid ISO timestamp', () => {
  const d = new Date(gameManifest.generated_at);
  assert(!isNaN(d.getTime()), `Not a valid date: ${gameManifest.generated_at}`);
});

// ── 6. Core asset file integrity ──────────────────────────────────────────────
console.log('\n6. Core asset file integrity');
const CORE_REQUIRED = [
  'unit-light-knight-token', 'unit-light-knight-portrait',
  'unit-dark-sorceress-token', 'unit-dark-sorceress-portrait',
  'arena-light', 'arena-dark',
];
for (const id of CORE_REQUIRED) {
  test(`${id} — present and non-empty`, () => {
    const entry = gameManifest.assets.find(a => a.id === id);
    assert(entry, `Not in manifest`);
    const file = path.join(__dirname, 'archon-game/public', entry.path);
    assert(fs.existsSync(file), `Missing: ${file}`);
    assert(fs.statSync(file).size > 5000, `Too small: ${fs.statSync(file).size}B`);
  });
}

// ── 7. Board system static analysis ──────────────────────────────────────────
console.log('\n7. Board system static analysis');
const CONTRACT_PATH = path.join(__dirname, 'archon-game/src/lib/board-combat-contract.ts');
const BOARD_STATE_PATH = path.join(__dirname, 'archon-game/src/features/board/boardState.ts');
const BOARD_SCENE_PATH = path.join(__dirname, 'archon-game/src/features/board/BoardScene.tsx');
const BRIDGE_PATH = path.join(__dirname, 'archon-game/src/features/combat/CombatBridge.tsx');
const APP_PATH = path.join(__dirname, 'archon-game/src/App.tsx');

test('board-combat-contract.ts exists', () => assert(fs.existsSync(CONTRACT_PATH), 'Missing'));
test('boardState.ts exists', () => assert(fs.existsSync(BOARD_STATE_PATH), 'Missing'));
test('BoardScene.tsx exists', () => assert(fs.existsSync(BOARD_SCENE_PATH), 'Missing'));
test('CombatBridge.tsx exists', () => assert(fs.existsSync(BRIDGE_PATH), 'Missing'));

const contractSrc = fs.readFileSync(CONTRACT_PATH, 'utf-8');
test('Contract defines BoardCoord', () => assert(contractSrc.includes('BoardCoord'), 'Missing'));
test('Contract defines CombatLaunchPayload', () => assert(contractSrc.includes('CombatLaunchPayload'), 'Missing'));
test('Contract defines CombatResultPayload', () => assert(contractSrc.includes('CombatResultPayload'), 'Missing'));
test('Contract defines CombatBridgeCallbacks', () => assert(contractSrc.includes('CombatBridgeCallbacks'), 'Missing'));

const boardStateSrc = fs.readFileSync(BOARD_STATE_PATH, 'utf-8');
test('boardState uses BOARD_SIZE = 9', () => assert(boardStateSrc.includes('BOARD_SIZE = 9'), 'Missing'));
test('boardState exports makeInitialBoardState', () => assert(boardStateSrc.includes('makeInitialBoardState'), 'Missing'));
test('boardState exports ALPHA_ROSTER', () => assert(boardStateSrc.includes('ALPHA_ROSTER'), 'Missing'));

const appSrc = fs.readFileSync(APP_PATH, 'utf-8');
test('App.tsx imports BoardScene', () => assert(appSrc.includes('BoardScene'), 'Missing'));
test('App.tsx imports CombatBridge', () => assert(appSrc.includes('CombatBridge'), 'Missing'));
test('App.tsx has mode routing', () => assert(appSrc.includes("mode === 'board'"), 'Missing'));

const bridgeSrc = fs.readFileSync(BRIDGE_PATH, 'utf-8');
test('CombatBridge has standalone mode', () => assert(bridgeSrc.includes("mode: 'standalone'"), 'Missing'));
test('CombatBridge has board mode', () => assert(bridgeSrc.includes("mode: 'board'"), 'Missing'));
test('CombatBridge imports CombatScene', () => assert(bridgeSrc.includes('CombatScene'), 'Missing'));
test('CombatBridge does NOT modify CombatScene', () => {
  // CombatScene.tsx should not import from CombatBridge (no circular dep)
  const sceneSrc = fs.readFileSync(path.join(__dirname, 'archon-game/src/features/combat/CombatScene.tsx'), 'utf-8');
  assert(!sceneSrc.includes('CombatBridge'), 'CombatScene.tsx has unexpected CombatBridge import — baseline was modified');
});



// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (FAILURES.length > 0) {
  console.error('\nFailed tests:');
  FAILURES.forEach(f => console.error(`  ❌ ${f.name}: ${f.error}`));
  process.exit(1);
}
console.log('\n✅ All smoke tests passed.');
