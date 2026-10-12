import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { slide, spawn } from '../server/board';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

const transpose = (board: number[]): number[] =>
  Array.from({ length: 16 }, (_, i) => board[(i % 4) * 4 + Math.floor(i / 4)]!);
const horizontal = (board: number[]): number[] =>
  Array.from({ length: 16 }, (_, i) => board[Math.floor(i / 4) * 4 + 3 - (i % 4)]!);
const sum = (board: number[]): number => board.reduce((n, x) => n + x, 0);
const potential = (board: number[]): number =>
  board.reduce((n, x) => n + (x === 0 ? 0 : x * Math.log2(x)), 0);
const tile = fc.constantFrom(0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024);
const boards = fc.array(tile, { minLength: 16, maxLength: 16 });

function freezeJson<T>(value: T, seen: WeakSet<object>): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) freezeJson(child, seen);
  return value;
}

function assertInvariant(condition: boolean, seed: number, event: number, label: string): void {
  if (!condition) throw new Error(`Race seed ${seed}, event ${event}: ${label}`);
}

const raceScenario = fc.constantFrom(2, 4, 8).chain((count) =>
  fc.record({
    count: fc.constant(count),
    seconds: fc.constantFrom(60, 120, 180),
    actions: fc.array(
      fc.record({
        kind: fc.constantFrom('move', 'move', 'move', 'player', 'pause', 'resume', 'timer'),
        seat: fc.integer({ min: 0, max: count + 1 }),
        dir: fc.constantFrom(...(['up', 'down', 'left', 'right'] as const)),
        counter: fc.constantFrom('current', 'current', 'current', 'stale', 'future'),
        delta: fc.integer({ min: 0, max: 5000 }),
        connected: fc.boolean(),
        staleTimer: fc.boolean(),
        timerDue: fc.boolean(),
      }),
      { minLength: 20, maxLength: 20 },
    ),
  }),
);

describe('seeded board properties', () => {
  // A recorded generator seed makes all 1,000 random cases reproducible. Explicit seeds 1–3
  // additionally exercise the requested named seeds rather than relying on an unrecorded run.
  it.each([1, 2, 3, 204809])('preserves mass and symmetry with fast-check seed %i', (seed) => {
    fc.assert(
      fc.property(boards, fc.integer({ min: 0, max: 65535 }), (board, slot) => {
        const snapshot = [...board];
        for (const dir of ['up', 'down', 'left', 'right'] as const) {
          const result = slide(board, dir);
          expect(result.board).toHaveLength(16);
          expect(sum(result.board)).toBe(sum(board));
          expect(result.gain).toBe(potential(result.board) - potential(board));
          expect(result.board.filter(Boolean).length).toBeLessThanOrEqual(
            board.filter(Boolean).length,
          );
          expect(result.changed).toBe(JSON.stringify(result.board) !== JSON.stringify(board));
          for (const value of result.board)
            expect(value === 0 || (value >= 2 && Number.isInteger(Math.log2(value)))).toBe(true);
        }
        const left = slide(board, 'left');
        const right = slide(horizontal(board), 'right');
        expect(horizontal(right.board)).toEqual(left.board);
        expect(right.gain).toBe(left.gain);
        const up = slide(transpose(board), 'up');
        expect(transpose(up.board)).toEqual(left.board);
        expect(up.gain).toBe(left.gain);
        const drawn = spawn(board, { slot, value: 2 });
        expect(sum(drawn)).toBe(sum(board) + (board.includes(0) ? 2 : 0));
        expect(drawn.filter(Boolean).length).toBe(
          board.filter(Boolean).length + (board.includes(0) ? 1 : 0),
        );
        for (let i = 0; i < 16; i++) if (board[i] !== 0) expect(drawn[i]).toBe(board[i]);
        expect(board).toEqual(snapshot);
      }),
      { seed, numRuns: seed === 204809 ? 1000 : 1, endOnFailure: true },
    );
  });

  it('replays bounded event sequences for seeds 1, 2, 3 and 1,000 distinct generated race seeds', () => {
    const [generated] = fc.sample(
      fc.uniqueArray(fc.integer({ min: 4, max: 2_147_483_647 }), {
        minLength: 1000,
        maxLength: 1000,
      }),
      { seed: 204809, numRuns: 1 },
    );
    const seeds = [1, 2, 3, ...generated!];
    expect(new Set(seeds).size).toBe(1003);
    for (const seed of seeds) {
      const [scenario] = fc.sample(raceScenario, { seed, numRuns: 1 });
      const { count, seconds, actions } = scenario!;
      const players = testPlayers(count);
      const ids = players.map((player) => player.id);
      const seatKey = ids.join('|');
      const init = { players, settings: { seconds }, seed, now: 1000 };
      const leftSeen = new WeakSet<object>();
      const rightSeen = new WeakSet<object>();
      // Freeze shared subtrees once, so an impure reducer or view fails immediately
      // without repeatedly copying the private spawn stream at every generated event.
      let left = freezeJson(game.init(init), leftSeen);
      let right = freezeJson(game.init(init), rightSeen);
      const leftStream = left.spawns;
      const rightStream = right.spawns;
      let now = init.now;
      let eventIndex = 0;
      assertInvariant(
        JSON.stringify(left) === JSON.stringify(right),
        seed,
        0,
        'initial state replay',
      );
      assertInvariant(
        left.racers.p1!.board.join(',') === left.racers.p2!.board.join(','),
        seed,
        0,
        'identical opening boards',
      );

      const apply = (event: GameEvent<Input>, viewer: string): void => {
        eventIndex++;
        const before: State = left;
        freezeJson(event, new WeakSet<object>());
        left = freezeJson(game.reduce(left, event), leftSeen);
        right = freezeJson(game.reduce(right, event), rightSeen);
        // The initial full-state comparison covers the private stream. Its frozen
        // reference must survive every event; only the small dynamic state needs replay.
        assertInvariant(
          left.spawns === leftStream && right.spawns === rightStream,
          seed,
          eventIndex,
          'immutable spawn streams retained',
        );
        assertInvariant(
          JSON.stringify({ ...left, spawns: undefined }) ===
            JSON.stringify({ ...right, spawns: undefined }),
          seed,
          eventIndex,
          'dynamic state replay',
        );
        assertInvariant(
          Object.keys(left.players).join('|') === seatKey &&
            Object.keys(left.racers).join('|') === seatKey,
          seed,
          eventIndex,
          'original seats retained',
        );
        assertInvariant(
          ids.every((id) => {
            const racer = left.racers[id]!;
            const previous = before.racers[id]!;
            return (
              Number.isFinite(racer.score) &&
              racer.score >= previous.score &&
              Number.isInteger(racer.moves) &&
              racer.moves >= previous.moves &&
              racer.moves <= previous.moves + 1 &&
              racer.board.length === 16
            );
          }),
          seed,
          eventIndex,
          'finite monotone scores/moves and complete boards',
        );
        if (before.phase.paused && (event.type === 'input' || event.type === 'timer'))
          assertInvariant(left === before, seed, eventIndex, 'paused input/timer held');
        const tv = JSON.stringify(game.tvView(left));
        const phone = JSON.stringify(game.controllerView(left, viewer));
        assertInvariant(
          tv === JSON.stringify(game.tvView(right)) &&
            phone === JSON.stringify(game.controllerView(right, viewer)),
          seed,
          eventIndex,
          'public view replay',
        );
        assertInvariant(
          ![tv, phone].some((view) => view.includes('"spawns":') || view.includes('"rng":')),
          seed,
          eventIndex,
          'future draws and RNG remain hidden',
        );
      };

      // Every seed includes a move, pause, drop, held input, resume and reconnect;
      // the direction, seat, timing and following events still come from the generator.
      const prefix = ['move', 'pause', 'player', 'move', 'resume', 'player'] as const;
      const recovering = actions[0]!.seat % count;
      actions.forEach((action, step) => {
        now += action.delta;
        const kind = prefix[step] ?? action.kind;
        const seat = step < prefix.length ? recovering : action.seat;
        const playerId = ids[seat] ?? (seat === count ? 'spectator-x' : '__proto__');
        let event: GameEvent<Input>;
        if (kind === 'move') {
          const moves = left.racers[playerId]?.moves ?? 0;
          event = {
            type: 'input',
            now,
            playerId,
            input: {
              type: 'move',
              dir: action.dir,
              move:
                action.counter === 'future'
                  ? moves + 1
                  : action.counter === 'stale'
                    ? Math.max(0, moves - 1)
                    : moves,
            },
          };
          assertInvariant(
            game.inputSchema.safeParse(event.input).success,
            seed,
            eventIndex,
            'generated input is schema-valid',
          );
        } else if (kind === 'player') {
          event = {
            type: 'player',
            now,
            playerId,
            connected: step === 2 ? false : step === 5 ? true : action.connected,
          };
        } else if (kind === 'pause' || kind === 'resume') {
          event = { type: 'vip', now, action: kind };
        } else {
          if (action.timerDue && left.phase.deadline !== null)
            now = Math.max(now, left.phase.deadline);
          event = {
            type: 'timer',
            now,
            phaseId: left.phase.id,
            startedAt: left.phase.startedAt - Number(action.staleTimer),
          };
        }
        apply(event, step % 4 === 0 ? 'spectator-x' : playerId);
      });

      if (left.phase.paused) apply({ type: 'vip', now: ++now, action: 'resume' }, ids[0]!);
      for (let beat = 0; left.phase.id !== 'done' && beat < 2; beat++) {
        assertInvariant(left.phase.deadline !== null, seed, eventIndex, 'exit deadline exists');
        now = Math.max(now, left.phase.deadline!);
        apply(
          {
            type: 'timer',
            now,
            phaseId: left.phase.id,
            startedAt: left.phase.startedAt,
          },
          ids[beat % count]!,
        );
      }
      assertInvariant(left.phase.id === 'done', seed, eventIndex, 'bounded completion');
      const results = game.results(left);
      assertInvariant(
        results !== null && JSON.stringify(results) === JSON.stringify(game.results(right)),
        seed,
        eventIndex,
        'terminal results replay',
      );
      assertInvariant(
        Object.keys(results!.scores).join('|') === seatKey &&
          results!.ranking
            .map((entry) => entry.playerId)
            .sort()
            .join('|') === [...ids].sort().join('|') &&
          ids.every((id) => results!.scores[id] === left.racers[id]!.score),
        seed,
        eventIndex,
        'every original seat keeps its actual result score',
      );
    }
  });
});
