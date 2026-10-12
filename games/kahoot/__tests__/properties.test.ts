// Seeded valid event traces pin replay, immutable JSON and safe nested stage views in both modes.
import fc from 'fast-check';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { expect, it } from 'vitest';
import { game } from '../server/index';
import type { Input } from '../server/types';
import { T0 } from './run';

// Remember only graphs this helper has already frozen completely. Reducer snapshots share
// untouched subtrees; revisiting those millions of times adds cost without more mutation coverage.
const frozenGraphs = new WeakSet<object>();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    if (frozenGraphs.has(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
    frozenGraphs.add(value);
  }
  return value;
}
function assertJson(value: unknown): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))
    throw new Error(`Non-JSON number ${value}`);
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  )
    throw new Error(`Non-JSON value ${typeof value}`);
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) assertJson(child);
}
function assertOmitted(value: unknown, hidden: ReadonlySet<string>): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (hidden.has(key)) throw new Error(`Hidden view key ${key}`);
    assertOmitted(child, hidden);
  }
}
const arbitrary = fc.array(
  fc.record({
    kind: fc.integer({ min: 0, max: 9 }),
    id: fc.constantFrom('p1', 'p2', 'p16', 'spectator', '__proto__', 'constructor'),
    index: fc.integer({ min: 0, max: 3 }),
    flag: fc.boolean(),
    delta: fc.integer({ min: 0, max: 500 }),
  }),
  { minLength: 40, maxLength: 60 },
);

it('replays seeds1,2,3 plus1000 sampled seeds per mode without mutation or hidden-stage leaks', () => {
  const seedRng = createRng(20261012);
  const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => seedRng.int(4, 0x3fffffff))];
  let events = 0;
  let views = 0;
  for (const mode of ['wager', 'classic'] as const) {
    for (const seed of seeds) {
      const players = testPlayers(1 + (seed % 16)).map((p, i) => ({ ...p, canSeeTv: i % 3 !== 0 }));
      const init = {
        players,
        seed,
        now: T0,
        settings: {
          quizMode: mode,
          questions: 5,
          answerSeconds: 5,
          classicPack: (['general', 'movies', 'science'] as const)[seed % 3]!,
        },
        contentLang: seed % 2 ? ('en' as const) : ('es' as const),
        presence: { mode: 'together' as const, phoneOnly: seed % 3 === 0 },
      };
      let state = game.init(init);
      let replay = game.init(init);
      let now = T0;
      for (const value of fc.sample(arbitrary, { seed, numRuns: 1 })[0]!) {
        now += value.delta;
        let event: GameEvent<Input>;
        switch (value.kind) {
          case 0:
            now = Math.max(now, state.phase.deadline ?? now);
            event = {
              type: 'timer',
              now,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt,
            };
            break;
          case 1:
            event = {
              type: 'timer',
              now,
              phaseId: 'obsolete',
              startedAt: state.phase.startedAt - 1,
            };
            break;
          case 2:
            event = { type: 'vip', now, action: 'pause' };
            break;
          case 3:
            event = { type: 'vip', now, action: 'resume' };
            break;
          case 4:
            event = { type: 'vip', now, action: 'skip' };
            break;
          case 5:
            event = { type: 'player', now, playerId: value.id, connected: value.flag };
            break;
          case 6:
            event = { type: 'player', now, playerId: value.id, connected: false, gone: 'left' };
            break;
          case 7:
            event = { type: 'speech', now, key: 'unrequested', ms: -1 };
            break;
          case 8:
            event = { type: 'speechStart', now, key: 'unrequested' };
            break;
          default: {
            const input: Input =
              mode === 'classic'
                ? {
                    type: 'answer',
                    questionId: state.questionIds[Math.max(0, state.index)] ?? 'old',
                    questionStartedAt: state.phase.startedAt,
                    index: value.index,
                  }
                : state.phase.id === 'wager'
                  ? { type: 'wager', percent: 50 }
                  : { type: 'pick', index: value.index };
            event = { type: 'input', now, playerId: value.id, input };
          }
        }
        const before = state;
        const original = JSON.stringify(before);
        state = game.reduce(freeze(state), event);
        replay = game.reduce(freeze(replay), event);
        expect(JSON.stringify(state), `replay ${mode}, seed ${seed}, event ${events}`).toBe(
          JSON.stringify(replay),
        );
        assertJson(state);
        expect(JSON.stringify(before)).toBe(original);
        expect(JSON.stringify(state).length).toBeLessThan(256 * 1024);
        const tv = game.tvView(state);
        const phones = [...players.map((p) => p.id), 'spectator', '__proto__', 'constructor'].map(
          (id) => game.controllerView(state, id),
        );
        for (const view of [tv, ...phones]) {
          assertJson(view);
          // Recursive validation already rejects every JSON-losing value. Byte round trips
          // avoid building a matcher tree for more than a million stage snapshots.
          const serialized = JSON.stringify(view);
          if (JSON.stringify(JSON.parse(serialized)) !== serialized)
            throw new Error('View changed across JSON round trip');
          assertOmitted(
            view,
            new Set([
              'rng',
              'questionIds',
              'answerClosesAt',
              'questionReadableUntil',
              'wagerClosesAt',
              'wagerReadableUntil',
            ]),
          );
          if (state.phase.id === 'question')
            assertOmitted(
              view,
              new Set(['correctIndex', 'pickIndex', 'answerDistribution', 'explanation']),
            );
          views++;
        }
        if (
          mode === 'classic' &&
          (state.phase.id === 'podium' ||
            (state.phase.id === 'reveal' && state.index === state.questionIds.length - 1))
        ) {
          const all = [tv, ...phones] as unknown as Record<string, unknown>[];
          for (const view of all) {
            expect(view).not.toHaveProperty('standings');
            expect(view).not.toHaveProperty('rows');
            const publicPlayers = view['players'] as Record<string, unknown>[];
            expect(publicPlayers.every((p) => !Object.hasOwn(p, 'score'))).toBe(true);
          }
        }
        events++;
      }
    }
  }
  if (process.env.PB_WRITE_EVIDENCE === '1') {
    const media = resolve(import.meta.dirname, '../../../jobs/P01-quiz-rush/media');
    mkdirSync(media, { recursive: true });
    writeFileSync(
      resolve(media, 'property-upgrade.json'),
      JSON.stringify(
        {
          modes: ['wager', 'classic'],
          seedsPerMode: seeds.length,
          seeds,
          events,
          views,
          counts: '1..16',
          checks: [
            'deep-frozen input states',
            'deterministic replay',
            'finite JSON round trips',
            'safe nested stage views',
            'unknown/prototype spectators',
            'unrevealed podium score-chip omission',
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }
}, 600_000);
