import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { enterScore } from '../server/phases/score';
import { roundPoints } from '../server/scoring';
import { READY_MS, ROUNDS, SCORE_MS } from '../server/types';
import type { Input, State } from '../server/types';
import { ROUND_MS, STEP_MS, TICK_MS, tick } from '../server/world';

const T0 = 1_000_000;
const players = [
  { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
  { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  { id: 'c', name: 'Cleo', avatarId: 'frog', connected: true },
];
const kit = testKit(game, { t0: T0, players, settings: {}, inputAt: 0 });
const control = (move: -1 | 0 | 1, heavy = false, jump = false): Input => ({
  type: 'control',
  move,
  heavy,
  jump,
});
const play = (): State => kit.timer(kit.start());
const single = (state: State): State => ({
  ...state,
  world: {
    ...state.world,
    balls: state.world.balls.map((b) =>
      b.id === 'a' ? b : { ...b, alive: false, cause: 'fall', diedAt: 0 },
    ),
  },
});

describe('Bonk.io match and fair scoring', () => {
  it('starts three seconds of ready with all seats and fixed five rounds', () => {
    const state = kit.start();
    expect(state.phase).toEqual({ id: 'ready', startedAt: T0, deadline: T0 + READY_MS });
    expect(state.rounds).toBe(ROUNDS);
    expect(state.rounds).toBe(5);
    expect(state.world.balls).toHaveLength(3);
    expect(state.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(game.results(state)).toBeNull();
  });

  it('a ready deadline starts the play clock and arms a finite first physics beat', () => {
    const state = play();
    expect(state.phase.id).toBe('play');
    expect(state.began).toBe(T0 + READY_MS);
    expect(state.endsAt).toBe(state.began + ROUND_MS);
    expect(state.phase.deadline).toBe(state.began + TICK_MS);
    expect(state.checked).toBe(0);
    expect(game.tvView(state).deadline).toBe(state.endsAt);
  });

  it('the last survivor alone receives one win, added only once', () => {
    const state = single(play());
    expect(roundPoints(state.world)).toEqual({ a: 1, b: 0, c: 0 });
    const scored = kit.timer(state);
    expect(scored.phase.id).toBe('score');
    expect(scored.phase.deadline).toBe(scored.phase.startedAt + SCORE_MS);
    expect(scored.scores).toEqual({ a: 1, b: 0, c: 0 });
    expect(scored.lastPoints).toEqual(scored.scores);
    expect(scored.lastWinners).toEqual(['a']);
    expect(scored.roundOutcome).toBe('last-standing');
    expect(enterScore(scored, scored.phase.startedAt + 10)).toBe(scored);
  });

  it('all-fall is a zero-point draw, while only a genuine timeout shares points', () => {
    const state = play();
    const fallen = {
      ...state,
      world: {
        ...state.world,
        balls: state.world.balls.map((b) => ({
          ...b,
          alive: false,
          diedAt: 40,
          cause: 'fall' as const,
        })),
      },
    };
    const draw = kit.timer(fallen);
    expect(draw.lastPoints).toEqual({ a: 0, b: 0, c: 0 });
    expect(draw.lastWinners).toEqual([]);
    expect(draw.roundOutcome).toBe('draw');
    const cap = enterScore({ ...state, checked: ROUND_MS }, state.endsAt);
    expect(cap.lastPoints).toEqual({ a: 1, b: 1, c: 1 });
    expect(cap.roundOutcome).toBe('timeout');
    const skipped = kit.vip(state, 'skip', state.began + 200);
    expect(skipped.lastPoints).toEqual({ a: 0, b: 0, c: 0 });
    expect(skipped.roundOutcome).toBe('draw');
  });

  it('judges the final physics step before awarding points', () => {
    let state = play();
    state = {
      ...state,
      world: {
        ...state.world,
        balls: state.world.balls.map((b) => ({ ...b, y: 570, grounded: false })),
      },
    };
    const scored = kit.input(state, 'a', control(1), state.began + STEP_MS);
    expect(scored.phase.id).toBe('score');
    expect(scored.lastPoints).toEqual({ a: 0, b: 0, c: 0 });
    expect(scored.world.balls.every((b) => b.diedAt === STEP_MS)).toBe(true);
  });

  it('the score deadline rotates spawns into the next round, clearing controls and result deltas', () => {
    const state = play();
    const scored = kit.timer(single(kit.input(state, 'a', control(1, true), state.began)));
    const ready = kit.timer(scored);
    expect(ready.round).toBe(2);
    expect(ready.phase.id).toBe('ready');
    expect(ready.world.balls.every((b) => b.move === 0 && !b.heavy && !b.jumpQueued)).toBe(true);
    expect(ready.world.balls[0]!.x).not.toBe(state.world.balls[0]!.x);
    expect(ready.scores.a).toBe(1);
    expect(ready.lastPoints).toEqual({});
  });

  it('ends after round five and ranks every original seat including departed ones', () => {
    const state = { ...single(play()), round: 5, scores: { a: 3, b: 3, c: 0 }, left: ['c'] };
    const done = kit.timer(kit.timer(state));
    expect(done.phase.id).toBe('done');
    expect(done.phase.deadline).toBeNull();
    expect(
      game
        .results(done)
        ?.ranking.map((r) => r.playerId)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
    expect(game.results(done)?.winnerIds).toEqual(['a']);
    const tie = { ...done, scores: { a: 3, b: 3, c: 0 } };
    expect(game.results(tie)?.winnerIds).toEqual(['a', 'b']);
    expect(game.controllerView(tie, 'a')).toMatchObject({ rank: 1, tied: true });
  });

  it('an idle disconnected room finishes five rounds on its clocks', () => {
    let state = kit.start();
    for (const p of players) state = kit.player(state, p.id, false, undefined, T0);
    const done = kit.until(state, 'done', 1200);
    expect(done.phase.id).toBe('done');
    expect(done.phase.startedAt - T0).toBeLessThanOrEqual(5 * (READY_MS + ROUND_MS + SCORE_MS));
    expect(game.results(done)?.ranking).toHaveLength(3);
  });
});

describe('controls, lifecycle and view contract', () => {
  it('settles old movement first, then stores the new hold at its exact event time', () => {
    const state = play();
    const moved = kit.input(state, 'a', control(1), state.began + 220);
    expect(moved.checked).toBe(200);
    expect(moved.world.balls[0]!.x).toBe(state.world.balls[0]!.x);
    expect(moved.world.balls[0]).toMatchObject({ move: 1, controlAt: 220 });
    const later = kit.input(moved, 'a', control(0), state.began + 420);
    expect(later.world.balls[0]!.x).toBeGreaterThan(moved.world.balls[0]!.x);
    expect(later.world.balls[0]!.move).toBe(0);
  });

  it('stale controls, unknown seats and controls outside play do nothing', () => {
    const ready = kit.start();
    expect(kit.input(ready, 'a', control(1), T0)).toBe(ready);
    const state = kit.input(play(), 'a', control(1), T0 + READY_MS + 220);
    expect(kit.input(state, 'a', control(-1), state.began + 200)).toBe(state);
    expect(kit.input(state, '__proto__', control(1), state.began + 500)).toBe(state);
    expect(kit.input(state, 'spectator', control(1), state.began + 500)).toBe(state);
  });

  it('a newer neutral release blocks older controls even when it changed no hold', () => {
    const state = play();
    const neutral = kit.input(state, 'a', control(0), state.began + 240);
    expect(neutral.world.balls[0]!.controlAt).toBe(240);
    expect(kit.input(neutral, 'a', control(1), state.began + 220)).toBe(neutral);
  });

  it('ignores stale phase timers, old beat timers and early current timers', () => {
    const state = play();
    const stale = (phaseId: string, startedAt: number, now: number) =>
      game.reduce(state, { type: 'timer', phaseId, startedAt, now });
    expect(stale('ready', T0, state.began + 1000)).toBe(state);
    expect(stale('play', state.phase.startedAt - 1, state.began + 1000)).toBe(state);
    expect(stale('play', state.phase.startedAt, state.began + 100)).toBe(state);
    const moved = kit.timer(state);
    expect(
      game.reduce(moved, {
        type: 'timer',
        phaseId: 'play',
        startedAt: moved.phase.startedAt,
        now: state.phase.deadline!,
      }),
    ).toBe(moved);
  });

  it('rejects malformed input before it can settle or corrupt a control', () => {
    const state = play();
    for (const input of [
      null,
      {},
      { type: 'control', move: 2, heavy: false, jump: false },
      { type: 'control', move: 1, heavy: 'yes', jump: false },
    ]) {
      expect(
        game.reduce(state, {
          type: 'input',
          playerId: 'a',
          now: state.began + 1000,
          input,
        } as GameEvent<Input>),
      ).toBe(state);
    }
  });

  it('temporary disconnect releases holds, preserves the ball and does not permit ghost inputs', () => {
    let state = play();
    state = kit.input(state, 'a', control(1, true), state.began);
    const dropped = kit.player(state, 'a', false, undefined, state.began + 200);
    const ball = dropped.world.balls.find((b) => b.id === 'a')!;
    expect(ball.alive).toBe(true);
    expect(ball).toMatchObject({ move: 0, heavy: false, jumpQueued: false });
    expect(kit.input(dropped, 'a', control(-1, true), dropped.began + 400)).toBe(dropped);
    const returned = kit.player(dropped, 'a', true, undefined, dropped.began + 200);
    expect(returned.world.balls).toEqual(dropped.world.balls);
    expect(returned.players.a?.connected).toBe(true);
  });

  it('a fallen ball stays fallen through reconnect and waits until the next round', () => {
    const state = {
      ...play(),
      world: {
        ...play().world,
        balls: play().world.balls.map((b) =>
          b.id === 'a' ? { ...b, alive: false, cause: 'fall' as const, diedAt: 40 } : b,
        ),
      },
    };
    const dropped = kit.player(state, 'a', false, undefined, state.began + 40);
    const returned = kit.player(dropped, 'a', true, undefined, state.began + 40);
    expect(returned.world.balls[0]!.alive).toBe(false);
    expect(game.controllerView(returned, 'a').alive).toBe(false);
    expect(kit.input(returned, 'a', control(1), state.began + 1000)).toBe(returned);
  });

  it.each(['left', 'kicked'] as const)(
    'a %s seat cannot return through reconnect/drop churn or a new round',
    (gone) => {
      let state = play();
      state = kit.player(state, 'a', false, gone, state.began);
      state = kit.player(state, 'a', true, undefined, state.began);
      state = kit.player(state, 'a', false, undefined, state.began);
      expect(state.left).toEqual(['a']);
      expect(state.players.a?.connected).toBe(false);
      expect(state.world.balls[0]).toMatchObject({
        alive: false,
        move: 0,
        heavy: false,
        cause: 'left',
      });
      const next = kit.vip(kit.vip(state, 'skip', state.began + 40), 'skip', state.began + 40);
      expect(next.phase.id).toBe('ready');
      expect(next.world.balls[0]).toMatchObject({ slot: 0, alive: false, cause: 'left' });
      expect(game.controllerView(next, 'a')).toMatchObject({
        departed: true,
        alive: false,
        slot: 0,
      });
      expect(game.controllerView(next, 'a').balls).toHaveLength(3);
    },
  );

  it('pause judges the live interval, releases every hold and freezes all physics and controls', () => {
    let state = play();
    state = kit.input(state, 'a', control(1, true), state.began);
    const paused = kit.vip(state, 'pause', state.began + 240);
    expect(paused.checked).toBe(240);
    expect(paused.world.balls[0]).toMatchObject({ move: 0, heavy: false });
    const held = kit.input(paused, 'a', control(-1, true, true), paused.began + 2000);
    expect(held).toBe(paused);
    expect(kit.timer(paused, paused.began + 2000)).toBe(paused);
    const returned = kit.vip(paused, 'resume', paused.began + 5240);
    expect(returned.began).toBe(state.began + 5000);
    expect(returned.endsAt).toBe(state.endsAt + 5000);
    expect(returned.checked).toBe(240);
    expect(returned.world).toEqual(paused.world);
    expect(returned.phase.deadline).toBe(paused.phase.deadline! + 5000);
  });

  it('departures during pause remain inert until resume closes the last-survivor round', () => {
    let state = kit.vip(play(), 'pause', T0 + READY_MS + 40);
    state = kit.player(state, 'b', false, 'left', state.began + 1000);
    state = kit.player(state, 'c', false, 'kicked', state.began + 1000);
    expect(state.phase.id).toBe('play');
    expect(state.phase.paused).toBeDefined();
    const resumed = kit.vip(state, 'resume', state.began + 2040);
    expect(resumed.phase.id).toBe('score');
    expect(resumed.lastPoints).toEqual({ a: 1, b: 0, c: 0 });
  });

  it('VIP end leaves a finite stable terminal result; skip while paused shifts the live clocks once', () => {
    const state = kit.vip(play(), 'pause', T0 + READY_MS + 200);
    const skipped = kit.vip(state, 'skip', state.began + 1200);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.began).toBe(state.began + 1000);
    const done = kit.vip(skipped, 'end', state.began + 1200);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)).not.toBeNull();
    expect(kit.vip(done, 'skip', done.phase.startedAt + 100)).toBe(done);
  });

  it('public stage views are identical across remote, phone-only and spectator phones', () => {
    const state = { ...play(), phoneOnly: true as const };
    const tv = game.tvView(state);
    for (const id of ['a', 'b', 'spectator', '__proto__']) {
      const cv = game.controllerView(state, id);
      expect(cv.balls).toEqual(tv.balls);
      expect(cv.platforms).toEqual(tv.platforms);
      expect(cv.scores).toEqual(tv.scores);
      expect(cv.me.role).toBe(['a', 'b'].includes(id) ? 'player' : 'spectator');
    }
    expect(game.controllerView(play(), 'a').balls).toBeUndefined();
    const remote = {
      ...play(),
      players: { ...play().players, a: { ...players[0]!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'a').balls).toHaveLength(3);
  });

  it('all three bot strengths use schema-valid changing public controls with no same-tick starvation', () => {
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      let state = play();
      const rng = createRng(123);
      const first = game.bot.sampleInput(state, 'a', rng, skill);
      expect(first).not.toBeNull();
      expect(game.inputSchema.safeParse(first).success).toBe(true);
      if (first) state = kit.input(state, 'a', first, state.began);
      expect(game.bot.sampleInput(state, 'a', rng, skill)).toBeNull();
      const judged = { ...state, world: tick(state.world, 400), checked: 400 };
      const later = game.bot.sampleInput(judged, 'a', rng, skill);
      if (later) expect(game.inputSchema.safeParse(later).success).toBe(true);
      const gone = { ...judged, left: ['a'] };
      expect(game.bot.sampleInput(gone, 'a', rng, skill)).toBeNull();
    }
  });
});
