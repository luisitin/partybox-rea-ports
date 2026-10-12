import { describe, expect, it } from 'vitest';
import {
  assertPublicView,
  assertResultsConsistent,
  assertScoreMonotonic,
  campaignPlan,
  recordedSeeds,
  runLifecycleTrace,
} from '../../../jobs/P08-hole-swallow/properties';

describe('standalone lifecycle evidence guards', () => {
  it('records 1000 unique deterministic random seeds and seeds1/2/3 in every configuration', () => {
    const samples = recordedSeeds();
    expect(samples).toEqual(recordedSeeds());
    expect(samples).toHaveLength(1000);
    expect(new Set(samples).size).toBe(1000);
    expect(samples.some((seed) => [1, 2, 3].includes(seed))).toBe(false);
    const plan = campaignPlan();
    expect(plan).toHaveLength(1063);
    expect(new Set(plan.map((row) => row.seed)).size).toBe(1003);
    for (let count = 2; count <= 8; count++)
      for (const skill of ['easy', 'normal', 'sharp'])
        expect(plan.filter((row) => row.count === count && row.skill === skill && row.mandatory).map((row) => row.seed)).toEqual([1, 2, 3]);
  });

  it('rejects nested private bookkeeping and future availability while accepting public growth', () => {
    const publicView = { city: { props: [], sinks: [], holes: [{ growth: 27, mass: 27 }] } };
    expect(() => assertPublicView(publicView, 1000)).not.toThrow();
    expect(() => assertPublicView({ ...publicView, innocent: { rng: [1, 2] } }, 1000)).toThrow('Private field');
    expect(() => assertPublicView({ city: { ...publicView.city, props: [{ availableAt: 1001 }] } }, 1000)).toThrow('Future prop');
    expect(() => assertPublicView({ city: { ...publicView.city, sinks: [{ consumedAt: 1001 }] } }, 1000)).toThrow('Future/expired');
  });

  it('catches score loss, false winners and duplicate ranking identities', () => {
    expect(() => assertScoreMonotonic({ p1: 8, p2: 3 }, { p1: 7, p2: 3 })).toThrow('decreased');
    const scores = { p1: 8, p2: 8, p3: 3 };
    const result = {
      scores, ranking: [
        { playerId: 'p1', rank: 1 }, { playerId: 'p2', rank: 1 }, { playerId: 'p3', rank: 3 },
      ],
      winnerIds: ['p1', 'p2'], awards: [],
    };
    expect(() => assertResultsConsistent(scores, result)).not.toThrow();
    expect(() => assertResultsConsistent(scores, { ...result, winnerIds: ['p1'] })).toThrow('joint winners');
    expect(() => assertResultsConsistent(scores, { ...result, ranking: [result.ranking[0]!, result.ranking[0]!, result.ranking[2]!] })).toThrow('Duplicate');
  });

  it('covers natural lifecycle and forced elimination on a small scoped trace', () => {
    const summary = runLifecycleTrace({ seed: 1, count: 2, skill: 'normal', mandatory: true });
    expect(summary.forcedEliminations).toBeGreaterThanOrEqual(1);
    expect(summary.malformedRejected).toBe(7);
    expect(summary.inertChecks).toBeGreaterThanOrEqual(8);
    expect(summary.privateProbeViews).toBeGreaterThan(0);
    expect(summary.eventTraceSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
