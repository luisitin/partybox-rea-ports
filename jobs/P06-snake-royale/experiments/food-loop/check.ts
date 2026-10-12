// Reproduction: compare the actual optimized world with a frozen original-food wrapper.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { seedRng } from '@partybox/game-sdk';
import { rounded } from '../../../../games/slither-io/server/geometry';
import {
  MAX_FOOD,
  MAX_MASS,
  MIN_MASS,
  RADIUS,
  STEP_MS,
} from '../../../../games/slither-io/server/types';
import type { Food, Point, Snake, State, World } from '../../../../games/slither-io/server/types';
import { tick } from '../../../../games/slither-io/server/world';
import {
  ORIGINAL_FOOD_BLOCK,
  OPTIMIZED_FOOD_BLOCK,
  collectFoodFast,
  collectFoodReference,
} from './collect';

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const snake = (id: string, extra: Partial<Snake> = {}): Snake => ({
  id,
  body: [[80, 50]],
  angle: 0,
  target: 0,
  boost: false,
  mass: 14,
  respawnAt: null,
  safeUntil: 0,
  crashes: 0,
  ...extra,
});
function compareCollection(w: World, label: string): void {
  const before = JSON.stringify(w),
    a = structuredClone(w),
    b = structuredClone(w);
  const aFood = collectFoodReference(a.snakes, a.food),
    bFood = collectFoodFast(b.snakes, b.food);
  assert.equal(JSON.stringify([b.snakes, bFood]), JSON.stringify([a.snakes, aFood]), label);
  for (const f of bFood)
    assert.ok(b.food.includes(f), `${label}: preserve untouched object identity`);
  assert.equal(JSON.stringify(w), before, `${label}: source mutated`);
}

// Explicit traps: ties share before capping, ties do not update nearest, and rounding is per food.
const adversarial: World[] = [
  { elapsed: 0, snakes: [snake('a')], food: [{ x: 10, y: 10, value: 1 }] },
  {
    elapsed: 0,
    snakes: [snake('a', { mass: 89.999 }), snake('b')],
    food: [{ x: 80, y: 50, value: 1 }],
  },
  {
    elapsed: 0,
    snakes: [snake('a')],
    food: [
      { x: 80, y: 50, value: 0.0013 },
      { x: 80, y: 50, value: 0.0013 },
    ],
  },
  {
    elapsed: 0,
    snakes: [snake('a', { body: [], respawnAt: 0 }), snake('b')],
    food: [{ x: 80, y: 50, value: 1 }],
  },
  {
    elapsed: 0,
    snakes: [snake('a')],
    food: [
      { x: 80 + RADIUS + 1.2, y: 50, value: 1 },
      { x: 80 + RADIUS + 1.2 + 1e-9, y: 50, value: 2 },
    ],
  },
  {
    elapsed: 0,
    snakes: [
      snake('a', { body: [[81, 50]] }),
      snake('b', { body: [[80 + Math.sqrt(1 - 0.5e-6), 50]] }),
      snake('c', { body: [[80 + Math.sqrt(1 - 1.25e-6), 50]] }),
    ],
    food: [{ x: 80, y: 50, value: 1 }],
  },
];
for (let i = 0; i < adversarial.length; i++) compareCollection(adversarial[i]!, `edge-${i}`);
const capped = structuredClone(adversarial[1]!);
collectFoodFast(capped.snakes, capped.food);
assert.deepEqual(
  capped.snakes.map((s) => s.mass),
  [90, 14.5],
);
const sequential = structuredClone(adversarial[2]!);
collectFoodFast(sequential.snakes, sequential.food);
assert.equal(sequential.snakes[0]!.mass, 14.002);
const resetTie = structuredClone(adversarial[5]!);
collectFoodFast(resetTie.snakes, resetTie.food);
assert.deepEqual(
  resetTie.snakes.map((s) => s.mass),
  [14, 14, 15],
);

function synthetic(seed: number): World {
  let word = seed | 0;
  const random = (): number => {
    word ^= word << 13;
    word ^= word >>> 17;
    word ^= word << 5;
    return (word >>> 0) / 0x1_0000_0000;
  };
  const elapsed = (seed % 20) * STEP_MS;
  const snakes = Array.from({ length: 1 + (seed % 8) }, (_, i) => {
    const head: Point = [rounded(5 + random() * 150), rounded(5 + random() * 90)];
    const angle = (random() * 2 - 1) * Math.PI,
      dead = (seed + i) % 11 === 0;
    const mass = rounded(MIN_MASS + random() * (MAX_MASS - MIN_MASS));
    return snake(`p${i}`, {
      angle,
      target: (random() * 2 - 1) * Math.PI,
      boost: random() < 0.3,
      mass,
      safeUntil: (seed + i) % 3 === 0 ? elapsed + 1000 : 0,
      crashes: dead ? 1 : 0,
      respawnAt: dead ? elapsed + (i % 3) * 500 : null,
      body: dead
        ? []
        : Array.from({ length: Math.min(14, Math.ceil(mass)) }, (_, j): Point => [
            rounded(Math.max(2, Math.min(158, head[0] - Math.cos(angle) * j * 1.6))),
            rounded(Math.max(2, Math.min(98, head[1] - Math.sin(angle) * j * 1.6))),
          ]),
    });
  });
  if (seed % 5 === 0 && snakes[1]?.respawnAt === null && snakes[0]?.respawnAt === null) {
    snakes[1]!.body = structuredClone(snakes[0]!.body);
  }
  const live = snakes.filter((s) => s.respawnAt === null);
  const food: Food[] = Array.from({ length: seed % (MAX_FOOD + 1) }, (_, i) => {
    const head = live.length ? live[i % live.length]!.body[0]! : undefined;
    const near = head && i % 4 === 0;
    return {
      x: near ? head[0] : rounded(2 + random() * 156),
      y: near ? head[1] : rounded(2 + random() * 96),
      value: rounded(0.001 + random() * 6),
    };
  });
  return { elapsed, snakes, food };
}

// Revert only the current exact food block; retain all other current physics and rules.
const sourceURL = new URL('../../../../games/slither-io/server/world.ts', import.meta.url);
const reportsURL = new URL('../../../../reports/r6-food-loop/', import.meta.url);
const generatedURL = new URL('world-reference.generated.ts', reportsURL);
const source = (await readFile(sourceURL, 'utf8')).replaceAll('\r\n', '\n');
assert.equal(
  source.split(OPTIMIZED_FOOD_BLOCK).length,
  2,
  'Current optimized food block differs: review the frozen marker before comparing',
);
let replacement = source.replace(
  OPTIMIZED_FOOD_BLOCK,
  ORIGINAL_FOOD_BLOCK.replaceAll('distance2(', 'legacyFoodDistance2('),
);
replacement = replacement.replace(
  /from (['"])\.\/([^'"]+)\1/g,
  (_, quote: string, target: string) =>
    `from ${quote}${new URL(`${target}.ts`, sourceURL).href}${quote}`,
);
replacement = `import { distance2 as legacyFoodDistance2 } from '${new URL('geometry.ts', sourceURL).href}';\n${replacement}`;
assert.match(
  await readFile(new URL('../../../../.gitignore', import.meta.url), 'utf8'),
  /^reports\/$/m,
  'Generated wrapper must stay under ignored reports/',
);
await mkdir(reportsURL, { recursive: true });
await writeFile(generatedURL, replacement, 'utf8');
const reference = (await import(
  generatedURL.href
)) as typeof import('../../../../games/slither-io/server/world');
const runs = Number(process.env['REA_FOOD_DIFF_WORLDS'] ?? 10_000);
assert.ok(Number.isInteger(runs) && runs > 0);
let worldChecks = 0;
for (let seed = 1; seed <= runs; seed++) {
  const w = synthetic(seed);
  compareCollection(w, `synthetic-${seed}`);
  if (seed % 4 !== 0) continue;
  const before = JSON.stringify(w),
    rng = seedRng(seed),
    rngBefore = JSON.stringify(rng);
  const to = w.elapsed + [100, 600, 2000][Math.floor(seed / 4) % 3]!;
  const connected = Object.fromEntries(w.snakes.map((s, i) => [s.id, (seed + i) % 9 !== 0]));
  const a = reference.tick(structuredClone(w), structuredClone(rng), to, connected);
  const b = tick(structuredClone(w), structuredClone(rng), to, connected);
  assert.equal(JSON.stringify(b), JSON.stringify(a), `whole-world-${seed}`);
  assert.equal(JSON.stringify(w), before);
  assert.equal(JSON.stringify(rng), rngBefore);
  worldChecks++;
}

const fixturesURL = new URL('../../../../games/slither-io/fixtures/', import.meta.url);
const fixtures: Record<string, { originalHash: string; tickHashes: Record<string, string> }> = {};
for (const name of (await readdir(fixturesURL)).filter((f) => f.endsWith('.json')).sort()) {
  const fixtureURL = new URL(name, fixturesURL),
    text = await readFile(fixtureURL, 'utf8');
  const state = JSON.parse(text) as State;
  const connected = Object.fromEntries(
    Object.values(state.players).map((p) => [p.id, p.connected]),
  );
  const tickHashes: Record<string, string> = {};
  for (const duration of [100, 600, 2000]) {
    const a = reference.tick(
      structuredClone(state.world),
      structuredClone(state.rng),
      state.world.elapsed + duration,
      connected,
    );
    const b = tick(
      structuredClone(state.world),
      structuredClone(state.rng),
      state.world.elapsed + duration,
      connected,
    );
    assert.equal(JSON.stringify(b), JSON.stringify(a), `${name}+${duration}ms`);
    tickHashes[String(duration)] = hash(JSON.stringify(a));
  }
  assert.equal(await readFile(fixtureURL, 'utf8'), text, `${name}: fixture modified`);
  fixtures[name] = { originalHash: hash(text), tickHashes };
}
console.log(
  JSON.stringify(
    {
      collectionChecks: runs + adversarial.length,
      worldChecks,
      wrapper: fileURLToPath(generatedURL),
      fixtures,
    },
    null,
    2,
  ),
);
