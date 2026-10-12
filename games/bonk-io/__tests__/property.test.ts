import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { ROUNDS } from '../server/types';
import type { Input, State } from '../server/types';
import { BALL_RADIUS, COYOTE_MS, H, ROUND_MS, STEP_MS, W } from '../server/world';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const json = (value: unknown): string => JSON.stringify(value);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const generated = createRng(0x23b0cafe);
const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => generated.int(4, 0xffffffff))];
const controls = (move: -1 | 0 | 1, heavy = false, jump = false): Input => ({
  type: 'control',
  move,
  heavy,
  jump,
});

describe('Bonk.io reproducible lifecycle properties', () => {
  it('preserves purity, deterministic replay, bounded physics and departed seats over 1003 traces', () => {
    let totalEvents = 0;
    for (let trace = 0; trace < seeds.length; trace++) {
      const seed = seeds[trace]!;
      const rng = createRng(seed);
      const count = 2 + (trace % 7);
      const kit = testKit(game, { players: testPlayers(count), seed });
      const ids = testPlayers(count).map((player) => player.id);
      let state = kit.start();
      let replay = kit.start();
      let clock = kit.t0;
      let events = 0;
      const retiredScores = new Map<string, number>();
      const check = (ok: boolean, label: string): void => {
        if (!ok) throw new Error(`seed=${seed} n=${count} event=${events}: ${label}`);
      };
      const bounded = (s: State): void => {
        check(
          s.rounds === ROUNDS && Number.isInteger(s.round) && s.round >= 1 && s.round <= ROUNDS,
          'round bounds',
        );
        check(
          s.world.balls.length === count && new Set(s.world.balls.map((b) => b.id)).size === count,
          'stable roster',
        );
        check(
          Number.isInteger(s.world.stepped) &&
            s.world.stepped >= 0 &&
            s.world.stepped <= ROUND_MS / STEP_MS,
          'step bounds',
        );
        check(s.checked === s.world.stepped * STEP_MS, 'settled time matches grid');
        check(
          [s.began, s.endsAt, s.checked, s.phase.startedAt, s.rng.seed, s.rng.step].every(
            Number.isFinite,
          ),
          'finite clocks/rng',
        );
        check(s.phase.deadline === null || Number.isFinite(s.phase.deadline), 'finite deadline');
        for (const id of ids) {
          const score = s.scores[id];
          check(
            score !== undefined && Number.isInteger(score) && score >= 0 && score <= ROUNDS,
            `score ${id}`,
          );
        }
        for (const points of Object.values(s.lastPoints))
          check(points === 0 || points === 1, 'round points');
        check(
          new Set(s.left).size === s.left.length && s.left.every((id) => ids.includes(id)),
          'left membership',
        );
        for (const ball of s.world.balls) {
          check(ball.slot === ids.indexOf(ball.id), `stable slot ${ball.id}`);
          check(
            [ball.x, ball.y, ball.vx, ball.vy, ball.controlAt, ball.coyote].every(Number.isFinite),
            `finite ball ${ball.id}`,
          );
          check(ball.x >= -BALL_RADIUS * 2 && ball.x <= W + BALL_RADIUS * 2, `x bounds ${ball.id}`);
          check(ball.y >= -H && ball.y <= H + BALL_RADIUS * 2, `y bounds ${ball.id}`);
          check(Math.abs(ball.vx) <= 550 && Math.abs(ball.vy) <= 900, `velocity bounds ${ball.id}`);
          check(ball.move === -1 || ball.move === 0 || ball.move === 1, `move domain ${ball.id}`);
          check(
            ball.coyote >= 0 &&
              ball.coyote <= COYOTE_MS &&
              ball.controlAt >= -1 &&
              ball.controlAt <= ROUND_MS,
            `control bounds ${ball.id}`,
          );
          check(
            ball.diedAt === null ||
              (Number.isFinite(ball.diedAt) && ball.diedAt >= 0 && ball.diedAt <= ROUND_MS),
            `death time ${ball.id}`,
          );
          if (!ball.alive)
            check(
              ball.move === 0 && !ball.heavy && !ball.jumpQueued,
              `dead holds released ${ball.id}`,
            );
          if (s.left.includes(ball.id)) {
            check(
              !ball.alive && ball.cause === 'left' && !s.players[ball.id]!.connected,
              `retired stays out ${ball.id}`,
            );
            if (!retiredScores.has(ball.id)) retiredScores.set(ball.id, s.scores[ball.id]!);
          }
        }
        for (const [id, score] of retiredScores) {
          check(s.left.includes(id), `permanent membership ${id}`);
          check(s.scores[id] === score, `retired score frozen ${id}`);
        }
      };
      const send = (event: GameEvent<Input>, unchanged = false): State => {
        const before = json(state);
        const eventBefore = json(event);
        const suppliedState = freeze(clone(state));
        const suppliedEvent = freeze(clone(event));
        const next = kit.reduce(suppliedState, suppliedEvent);
        const replayNext = kit.reduce(freeze(clone(replay)), freeze(clone(event)));
        events++;
        clock = Math.max(clock, event.now);
        check(json(suppliedState) === before && json(state) === before, 'state was mutated');
        check(
          json(suppliedEvent) === eventBefore && json(event) === eventBefore,
          'event was mutated',
        );
        check(json(next) === json(replayNext), 'deterministic full-trace replay');
        if (unchanged) check(json(next) === before, 'rejected event changed state');
        state = next;
        replay = replayNext;
        bounded(state);
        return state;
      };
      const input = (id: string, value: Input, now = clock): GameEvent<Input> => ({
        type: 'input',
        playerId: id,
        input: value,
        now,
      });
      const timer = (
        now = state.phase.deadline ?? clock,
      ): Extract<GameEvent<Input>, { type: 'timer' }> => ({
        type: 'timer',
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
        now,
      });
      const player = (
        id: string,
        connected: boolean,
        gone?: 'left' | 'kicked',
      ): GameEvent<Input> => ({
        type: 'player',
        playerId: id,
        connected,
        now: clock,
        ...(gone ? { gone } : {}),
      });

      bounded(state);
      send(timer());
      check(state.phase.id === 'play', 'ready timer starts play');
      send(input(ids[0]!, controls(1, true, true)));
      send(timer());
      send({ type: 'vip', action: 'pause', now: clock + STEP_MS * 2 });
      const paused = clone(state);
      check(!!paused.phase.paused, 'pause entered');
      send(input(ids[0]!, controls(-1, true, true), clock + 300), true);
      send(timer(clock + 300), true);
      const resumeAt = clock + 200;
      const held = resumeAt - paused.phase.paused!.at;
      send({ type: 'vip', action: 'resume', now: resumeAt });
      check(json(state.world) === json(paused.world), 'resume must not catch up paused physics');
      check(
        state.began === paused.began + held && state.endsAt === paused.endsAt + held,
        'paused clocks shifted exactly',
      );
      check(state.phase.deadline === paused.phase.deadline! + held, 'paused wake shifted exactly');

      // A same-time drop releases holds, retains the ball, and reconnect cannot recreate it.
      send(input(ids[0]!, controls(-1, true, true)));
      const beforeDrop = clone(state.world.balls[0]!);
      send(player(ids[0]!, false));
      const dropped = clone(state.world.balls[0]!);
      check(
        dropped.alive === beforeDrop.alive &&
          dropped.x === beforeDrop.x &&
          dropped.y === beforeDrop.y,
        'temporary drop preserves settled ball',
      );
      check(
        dropped.move === 0 && !dropped.heavy && !dropped.jumpQueued,
        'temporary drop releases controls',
      );
      send(player(ids[0]!, true));
      check(json(state.world.balls[0]) === json(dropped), 'reconnect preserves current ball');

      send(player(ids[1]!, false, trace % 2 ? 'left' : 'kicked'));
      send(player(ids[1]!, true));
      send(player(ids[1]!, false));
      send(player(ids[1]!, true));
      send(input(ids[1]!, controls(1, true, true)), true);

      while (events < 128) {
        const id = rng.pick(ids);
        const action = rng.int(0, 12);
        const valid = controls(rng.pick([-1, 0, 1] as const), rng.chance(0.4), rng.chance(0.3));
        if (action === 0) {
          send(timer(Math.max(clock, state.phase.deadline ?? clock) + rng.int(0, 1000)));
        } else if (action === 1) {
          send(input(id, valid, clock + rng.int(0, 600)));
        } else if (action === 2) {
          const bad = rng.pick([
            null,
            {},
            { type: 'control', move: 2, heavy: false, jump: false },
            { type: 'control', move: 0, heavy: 'yes', jump: false },
          ]);
          send(input(id, bad as unknown as Input, clock + 200), true);
        } else if (action === 3) {
          send({ ...timer(clock + 200), startedAt: state.phase.startedAt - 1 }, true);
        } else if (action === 4) {
          const ball = state.world.balls.find((b) => b.id === id)!;
          send(input(id, valid, state.began + Math.max(state.checked, ball.controlAt) - 1), true);
        } else if (action === 5) {
          send(player(id, false));
        } else if (action === 6) {
          const was = state.world.balls.find((b) => b.id === id)!;
          const phase = state.phase.id;
          send(player(id, true));
          if (!was.alive && phase === 'play' && state.phase.id === 'play')
            check(
              !state.world.balls.find((b) => b.id === id)!.alive,
              'ordinary reconnect must not revive',
            );
        } else if (action === 7) {
          send(player(id, false, rng.chance(0.5) ? 'left' : 'kicked'));
        } else if (action === 8) {
          send({ type: 'vip', action: 'pause', now: clock + rng.int(0, 300) });
        } else if (action === 9) {
          send({ type: 'vip', action: 'resume', now: clock + rng.int(0, 1500) });
        } else if (action === 10) {
          send(timer((state.phase.deadline ?? clock) - 1), true);
        } else if (action === 11) {
          send(
            input(rng.pick(['spectator', '__proto__', 'constructor']), valid, clock + 200),
            true,
          );
        } else {
          send({ type: 'vip', action: 'skip', now: clock + rng.int(0, 700) });
        }
      }
      totalEvents += events;
    }
    const report = {
      traces: seeds.length,
      events: totalEvents,
      seeds: '1,2,3 plus 1000 generated by createRng(0x23b0cafe)',
      players: '2..8',
      eventsPerTrace: 128,
    };
    console.log(`P23 PROPERTY: ${JSON.stringify(report)}`);
    if (process.env.PB_RECORD_VERIFY === '1') {
      const folder = new URL('../../../jobs/P23-bonk-io/tools/', import.meta.url);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        new URL('property-results.json', folder),
        JSON.stringify(report, null, 2) + '\n',
        'utf8',
      );
    }
  }, 300_000);
});
