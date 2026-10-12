// Collector microbenchmark. Run sequentially with simulations and browsers closed.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { Food, Snake } from '../../../../games/slither-io/server/types';
import { collectFoodFast, collectFoodReference } from './collect';

const iterations = Number(process.env['REA_FOOD_BENCH_ITERATIONS'] ?? 1000);
const samples = Number(process.env['REA_FOOD_BENCH_SAMPLES'] ?? 5);
assert.ok(Number.isInteger(iterations) && iterations > 0);
assert.ok(Number.isInteger(samples) && samples > 0);
const snakes = (): Snake[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    body: [[70 + i * 8, 50]],
    angle: 0,
    target: 0,
    boost: false,
    mass: 14,
    respawnAt: null,
    safeUntil: 0,
    crashes: 0,
  }));
const makeFood = (count: number, mode: 'untouched' | 'single' | 'mixed' | 'tied'): Food[] =>
  Array.from({ length: count }, (_, i) => ({
    x: mode === 'untouched' || (mode === 'mixed' && i % 5 !== 0) ? 10 : 70,
    y: mode === 'untouched' || (mode === 'mixed' && i % 5 !== 0) ? 10 + (i % 30) : 50,
    value: 0.731,
  }));
const cases = [
  { name: 'untouched70', snakes: snakes(), food: makeFood(70, 'untouched') },
  { name: 'untouched240', snakes: snakes(), food: makeFood(240, 'untouched') },
  { name: 'single240', snakes: snakes(), food: makeFood(240, 'single') },
  { name: 'mixed240', snakes: snakes(), food: makeFood(240, 'mixed') },
  {
    name: 'tied240',
    snakes: snakes().map((s) => ({ ...s, body: [[70, 50]] as [number, number][] })),
    food: makeFood(240, 'tied'),
  },
];
type Collector = typeof collectFoodFast;
function measure(
  collector: Collector,
  input: (typeof cases)[number],
  count: number,
): { ms: number; checksum: number } {
  let checksum = 0;
  const started = performance.now();
  for (let i = 0; i < count; i++) {
    const working = input.snakes.slice();
    const remaining = collector(working, input.food);
    checksum += remaining.length;
    for (let j = 0; j < working.length; j++) checksum += working[j]!.mass;
  }
  return { ms: performance.now() - started, checksum };
}
const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const results = [];
for (const input of cases) {
  const a = structuredClone(input.snakes),
    b = structuredClone(input.snakes);
  assert.equal(
    JSON.stringify([a, collectFoodReference(a, input.food)]),
    JSON.stringify([b, collectFoodFast(b, input.food)]),
    input.name,
  );
  measure(collectFoodReference, input, 100);
  measure(collectFoodFast, input, 100);
  const referenceMs: number[] = [],
    fastMs: number[] = [];
  for (let sample = 0; sample < samples; sample++) {
    const order =
      sample % 2 === 0
        ? [collectFoodReference, collectFoodFast]
        : [collectFoodFast, collectFoodReference];
    const measurements = order.map((collector) => ({
      collector,
      ...measure(collector, input, iterations),
    }));
    assert.equal(measurements[0]!.checksum, measurements[1]!.checksum, input.name);
    for (const result of measurements)
      (result.collector === collectFoodReference ? referenceMs : fastMs).push(result.ms);
  }
  results.push({
    name: input.name,
    iterations,
    samples,
    referenceMs,
    fastMs,
    referenceMedianMs: median(referenceMs),
    fastMedianMs: median(fastMs),
    speedup: median(referenceMs) / median(fastMs),
  });
}
console.log(
  JSON.stringify({ node: process.version, platform: process.platform, results }, null, 2),
);
