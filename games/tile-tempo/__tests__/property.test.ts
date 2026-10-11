// Reproducible random seeds plus fixed seeds exercise a separately written scoring oracle.
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { fuzzOnce, jsonSize, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { deepFreeze, kit, tap } from './helpers';

const seedStream = createRng(0x18_19_2026);
const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => seedStream.int(4, 0x7fffffff))];
const batches = Array.from({ length: 4 }, (_, i) => ({
  batch: i + 1,
  batchSeeds: seeds.slice(i * 251, (i + 1) * 251),
}));

function changingState(
  state: State,
): Pick<State, 'phase' | 'runs' | 'rng' | 'began' | 'endsAt' | 'elapsed'> {
  return {
    phase: state.phase,
    runs: state.runs,
    rng: state.rng,
    began: state.began,
    endsAt: state.endsAt,
    elapsed: state.elapsed,
  };
}

describe('seeded properties', () => {
  it.each(batches)(
    'agrees with an independent scoring oracle: seed batch $batch of 4',
    ({ batchSeeds }) => {
      for (const seed of batchSeeds) {
        const rng = createRng(seed);
        const n = rng.int(2, 8);
        const ctx = { players: testPlayers(n), settings: {}, seed, now: kit.t0 };
        let state = kit.timer(game.init(ctx));
        let replay = kit.timer(game.init(ctx));
        const expected = Object.fromEntries(
          ctx.players.map((p) => [p.id, { tiles: 0, out: false }]),
        );
        const ids = Object.keys(expected);
        let finished = false;
        let now = state.began;
        for (let event = 0; event < 16; event++) {
          now += rng.int(1, 100);
          const id = ids[rng.int(0, n - 1)]!;
          const mine = expected[id]!;
          const row = Math.max(0, mine.tiles + rng.pick([-1, 0, 0, 0, 1]));
          const target = state.sequence[mine.tiles]!;
          const column = rng.chance(0.8) ? target : (target + 1) % 4;
          if (!finished && !mine.out && row === mine.tiles) {
            if (column === target) mine.tiles++;
            else mine.out = true;
          }
          finished ||= Object.values(expected).every((run) => run.out);
          const input = { type: 'tap' as const, row, column };
          deepFreeze(state);
          state = kit.input(state, id, input, now);
          replay = kit.input(replay, id, input, now);
          // The large shared sequence is frozen, so compare changing fields per event and the
          // complete byte state once per seed instead of serializing the same course 32 times.
          expect(JSON.stringify(changingState(state)), `seed ${seed} event ${event}`).toBe(
            JSON.stringify(changingState(replay)),
          );
          expect(
            {
              phase: state.phase.id,
              runs: Object.fromEntries(
                Object.entries(state.runs).map(([id, run]) => [
                  id,
                  { tiles: run.tiles, out: run.out },
                ]),
              ),
            },
            `seed ${seed} event ${event}`,
          ).toEqual({
            phase: finished ? 'score' : 'play',
            runs: expected,
          });
        }
        const serialized = JSON.stringify(state);
        expect(serialized, `full byte state for seed ${seed}`).toBe(JSON.stringify(replay));
        expect(JSON.parse(serialized)).toEqual(state);
        expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThan(256 * 1024);
        for (const view of [
          game.tvView(state),
          game.controllerView(state, ids[0]!),
          game.controllerView(state, 'spectator'),
        ]) {
          expect(jsonSize(view)).toBeLessThan(64 * 1024);
          expect(JSON.parse(JSON.stringify(view))).toEqual(view);
        }
        state = kit.timer(state, state.phase.id === 'play' ? state.endsAt : state.phase.deadline!);
        if (state.phase.id === 'score') state = kit.timer(state);
        expect(state.phase.id).toBe('done');
        expect(game.results(state)?.scores).toEqual(
          Object.fromEntries(ids.map((id) => [id, expected[id]!.tiles])),
        );
      }
    },
    120_000,
  );

  it('frozen states survive malformed event ordering in every phase at seeds 1, 2 and 3', () => {
    for (const seed of [1, 2, 3]) {
      const ready = kit.start({ seed });
      const play = tap(kit.timer(ready));
      const score = kit.vip(play, 'skip');
      const done = kit.timer(score);
      for (const state of [ready, play, score, done]) {
        const snapshot = JSON.stringify(state);
        expect(fuzzOnce(game, deepFreeze(state), seed)).toEqual([]);
        expect(JSON.stringify(state)).toBe(snapshot);
        expect(game.tvView(state)).toEqual(game.tvView(state));
        expect(game.controllerView(state, 'p1')).toEqual(game.controllerView(state, 'p1'));
      }
    }
  });

  it('backdated taps cannot rewind the shared clock or a player last-tap time', () => {
    let state = kit.timer(kit.start());
    state = tap(state, 'p1', state.began + 1000);
    for (const now of [state.began - 1, state.began + 999]) {
      expect(tap(state, 'p1', now)).toEqual(state);
    }
    const later = kit.timer(state, state.began + 2000);
    expect(later.elapsed).toBe(2000);
    const other = tap(later, 'p2', state.began + 1500);
    expect(other.elapsed).toBe(2000);
    expect(other.runs.p2?.tiles).toBe(1);
  });
});
