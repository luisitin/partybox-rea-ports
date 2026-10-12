import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { decision } from '../server/strategy';
import { enterGoal } from '../server/phases/goal';
import { enterDone } from '../server/phases/done';
import { applyControl, advanceWorld, crossedGoal, step } from '../server/world';
import {
  BALL_R,
  BALL_SPEED,
  GOAL_HALF,
  H,
  HALFTIME_MS,
  KICK_COOLDOWN_MS,
  KICK_RANGE,
  LEASE_MS,
  PLAYER_R,
  PLAYER_SPEED,
  POST_R,
  STEP_MS,
  W,
} from '../server/types';
import type { Body, State } from '../server/types';
import {
  body,
  control,
  copy,
  deepFreeze,
  finishIdle,
  input,
  isolated,
  start,
  timer,
  T0,
} from './helpers';

describe('whole-ball goals and contact', () => {
  it('requires whole-ball crossing and uses crossing y rather than final y', () => {
    const state = start(2);
    expect(crossedGoal(body(W, H / 2), body(W + BALL_R, H / 2), state)).toBeNull();
    expect(crossedGoal(body(W, H / 2), body(W + BALL_R + 1, H / 2), state)?.team).toBe('red');
    expect(crossedGoal(body(-BALL_R, H / 2), body(-BALL_R - 1, H / 2), state)?.team).toBe('blue');
    expect(crossedGoal(body(W, 20), body(W + 10, H / 2), state)).toBeNull();
    expect(crossedGoal(body(W, H / 2), body(W + 10, 100), state)?.team).toBe('red');
    expect(crossedGoal(body(W + BALL_R + 1, H / 2), body(W + 8, H / 2), state)).toBeNull();
    expect(crossedGoal(body(W, H / 2), body(W - 2, H / 2), state)).toBeNull();
  });
  it('credits attacking team, records own goals, and reverses scoring ends in half two', () => {
    const state = start(8);
    const blue = state.discs.find((disc) => disc.team === 'blue')!;
    const own = crossedGoal(body(W, H / 2), body(W + 3, H / 2), { ...state, lastTouch: blue.id });
    expect(own).toEqual({ team: 'red', scorerId: blue.id, ownGoal: true });
    expect(
      crossedGoal(body(W, H / 2), body(W + 3, H / 2), { ...state, redAttacksRight: false })?.team,
    ).toBe('blue');
    expect(
      crossedGoal(body(0, H / 2), body(-3, H / 2), { ...state, redAttacksRight: false })?.team,
    ).toBe('red');
  });
  it('awards one goal, clears driving, centers the puck, and cannot score twice during the beat', () => {
    let state = isolated();
    const blue = state.discs.find((disc) => disc.team === 'blue')!;
    state = { ...state, ball: body(W + 1, H / 2, 30), lastTouch: blue.id };
    const scored = timer(state);
    expect(scored.phase.id).toBe('goal');
    expect(scored.goals).toEqual({ red: 1, blue: 0 });
    expect(scored.lastGoal).toEqual({ team: 'red', scorerId: blue.id, ownGoal: true });
    expect(scored.ball).toEqual(body(W / 2, H / 2));
    expect(
      Object.values(scored.intents).every((intent) => intent.dx === 0 && !intent.kickArmed),
    ).toBe(true);
    const ignored = control(scored, blue.id, { kick: true }, T0 + 100);
    expect(ignored.goals).toEqual(scored.goals);
    expect(timer(ignored, T0 + 100).phase.id).toBe('goal');
    expect(timer(ignored).goals).toEqual({ red: 1, blue: 0 });
  });
  it('outside-mouth shots and post contacts rebound instead of scoring', () => {
    const high = { ...isolated(), ball: body(W - 3, H / 2 - GOAL_HALF, BALL_SPEED) };
    const result = step(deepFreeze(high), T0 + STEP_MS);
    expect(result.goal).toBeNull();
    expect(result.state.ball.vx).toBeLessThan(0);
    expect(result.state.ball.x).toBeLessThanOrEqual(W);
    const top = step({ ...isolated(), ball: body(80, BALL_R + 0.1, 0, -BALL_SPEED) }, T0 + STEP_MS);
    expect(top.state.ball.y).toBeGreaterThanOrEqual(BALL_R);
    expect(top.state.ball.vy).toBeGreaterThan(0);
  });
  it('settles exact crowded overlaps without NaN, mutation, or runaway speed', () => {
    const state = start();
    const crowded = deepFreeze({
      ...state,
      discs: state.discs.map((disc) => ({ ...disc, x: 80, y: 50, vx: 24, vy: 24 })),
      ball: body(80, 50, 1000, 1000),
    });
    const before = JSON.stringify(crowded);
    const result = step(crowded, T0 + STEP_MS).state;
    expect(JSON.stringify(crowded)).toBe(before);
    for (const disc of result.discs) {
      expect(
        Object.values(disc)
          .filter((v) => typeof v === 'number')
          .every(Number.isFinite),
      ).toBe(true);
      expect(Math.hypot(disc.vx, disc.vy)).toBeLessThanOrEqual(PLAYER_SPEED + 0.00001);
    }
    expect(Math.hypot(result.ball.vx, result.ball.vy)).toBeLessThanOrEqual(BALL_SPEED + 0.00001);
    expect(copy(result)).toEqual(result);
  });
});

describe('solid posts and goal-crossing priority', () => {
  it.each([
    ['left upper', 0, H / 2 - GOAL_HALF, -1, 1],
    ['left lower', 0, H / 2 + GOAL_HALF, -1, -1],
    ['right upper', W, H / 2 - GOAL_HALF, 1, 1],
    ['right lower', W, H / 2 + GOAL_HALF, 1, -1],
  ] as const)(
    'held player drive respects the %s post and can slide away',
    (_name, postX, postY, dx, dy) => {
      const base = isolated();
      const id = base.discs[0]!.id;
      const separation = PLAYER_R + POST_R;
      const x = postX === 0 ? separation + 0.25 : W - separation - 0.25;
      let state = control(
        {
          ...base,
          discs: base.discs.map((disc) =>
            disc.id === id ? { ...disc, x, y: postY, vx: 0, vy: 0 } : disc,
          ),
        },
        id,
        { dx },
      );
      for (let beat = 1; beat <= 10; beat++) {
        const at = T0 + beat * 100;
        state = timer(state, at);
        if (beat % 3 === 0) state = control(state, id, { dx }, at);
        const disc = state.discs.find((candidate) => candidate.id === id)!;
        expect(Math.hypot(disc.x - postX, disc.y - postY)).toBeGreaterThanOrEqual(
          separation - 0.00001,
        );
        expect([disc.x, disc.y, disc.vx, disc.vy].every(Number.isFinite)).toBe(true);
        expect(Math.hypot(disc.vx, disc.vy)).toBeLessThanOrEqual(PLAYER_SPEED + 0.00001);
      }
      const pressed = state.discs.find((disc) => disc.id === id)!;
      state = control(state, id, { dx: 0, dy }, T0 + 1000);
      for (let beat = 11; beat <= 16; beat++) {
        const at = T0 + beat * 100;
        state = timer(state, at);
        if (beat % 3 === 0) state = control(state, id, { dx: 0, dy }, at);
        const disc = state.discs.find((candidate) => candidate.id === id)!;
        expect(Math.hypot(disc.x - postX, disc.y - postY)).toBeGreaterThanOrEqual(
          separation - 0.00001,
        );
      }
      const escaped = state.discs.find((disc) => disc.id === id)!;
      expect((escaped.y - pressed.y) * dy).toBeGreaterThan(5);
      expect(Math.hypot(escaped.vx, escaped.vy)).toBeLessThanOrEqual(PLAYER_SPEED + 0.00001);
    },
  );

  it.each([
    ['right', 1],
    ['left', 1],
    ['right', 2],
    ['left', 2],
  ] as const)('a %s crossing in half%i precedes an opposite keeper late kick', (end, half) => {
    const base = isolated();
    const redAttacksRight = half === 1;
    const right = end === 'right';
    const scoringTeam = right === redAttacksRight ? 'red' : 'blue';
    const scorer = base.discs.find((disc) => disc.team === scoringTeam)!;
    const keeper = base.discs.find((disc) => disc.team !== scoringTeam)!;
    const prepared = {
      ...base,
      half,
      redAttacksRight,
      lastTouch: scorer.id,
      ball: body(right ? W + 1 : -1, H / 2, right ? 30 : -30),
      discs: base.discs.map((disc) =>
        disc.id === keeper.id
          ? { ...disc, x: right ? W - PLAYER_R : PLAYER_R, y: H / 2, vx: 0, vy: 0 }
          : disc,
      ),
    };
    const armed = deepFreeze(
      applyControl(prepared, keeper.id, input(prepared, keeper.id, { kick: true }), T0),
    );
    const original = JSON.stringify(armed);
    const judged = step(armed, T0 + STEP_MS);
    const keeperAfter = judged.state.discs.find((disc) => disc.id === keeper.id)!;
    // Incoming motion crosses the whole-ball line before the keeper's armed kick
    // would be considered; the contact range remains real, so this is not a far-away guard.
    expect(right ? judged.state.ball.x > W + BALL_R : judged.state.ball.x < -BALL_R).toBe(true);
    expect(
      Math.hypot(judged.state.ball.x - keeperAfter.x, judged.state.ball.y - keeperAfter.y),
    ).toBeLessThanOrEqual(KICK_RANGE);
    expect(judged.goal).toEqual({ team: scoringTeam, scorerId: scorer.id, ownGoal: false });
    expect(judged.state.lastTouch).toBe(scorer.id);
    expect(judged.state.intents[keeper.id]?.lastKickAt).toBeNull();
    expect(judged.state.intents[keeper.id]?.kickReadyAt).toBe(0);
    expect(JSON.stringify(armed)).toBe(original);
  });
});

describe('swept goal crossings before endpoint walls', () => {
  const corners = [
    ['right upper', W, H / 2 - GOAL_HALF, 1, -1],
    ['right lower', W, H / 2 + GOAL_HALF, 1, 1],
    ['left upper', 0, H / 2 - GOAL_HALF, -1, -1],
    ['left lower', 0, H / 2 + GOAL_HALF, -1, 1],
  ] as const;
  // Geometric preconditions describe these particular shots; the assertions
  // below exercise step itself, including walls, posts and scorer attribution.
  const rawAfter = (before: Body): Body =>
    body(
      before.x + before.vx * 0.994 * (STEP_MS / 1000),
      before.y + before.vy * 0.994 * (STEP_MS / 1000),
    );
  const nearestBeforeCross = (
    before: Body,
    after: Body,
    postX: number,
    postY: number,
    fraction: number,
  ): number => {
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const nearest = Math.max(
      0,
      Math.min(
        fraction,
        -((before.x - postX) * dx + (before.y - postY) * dy) / (dx * dx + dy * dy),
      ),
    );
    return Math.hypot(before.x + dx * nearest - postX, before.y + dy * nearest - postY);
  };

  it.each(corners)(
    'keeps a clean %s early crossing when the endpoint leaves the final mouth',
    (_name, postX, postY, horizontal, vertical) => {
      const base = isolated();
      const team = horizontal === 1 ? 'red' : 'blue';
      const scorer = base.discs.find((disc) => disc.team === team)!;
      const prepared = deepFreeze({
        ...base,
        lastTouch: scorer.id,
        ball: body(
          postX + horizontal * (BALL_R - 0.002),
          postY - vertical * 3.6,
          horizontal * 0.6,
          vertical * 47,
        ),
      });
      const raw = rawAfter(prepared.ball);
      const line = postX + horizontal * BALL_R;
      const fraction = (line - prepared.ball.x) / (raw.x - prepared.ball.x);
      const crossingY = prepared.ball.y + (raw.y - prepared.ball.y) * fraction;
      expect(fraction).toBeGreaterThan(0);
      expect(fraction).toBeLessThan(1);
      expect(Math.abs(crossingY - H / 2)).toBeLessThan(GOAL_HALF - BALL_R);
      expect(Math.abs(raw.y - H / 2)).toBeGreaterThan(GOAL_HALF - BALL_R);
      expect(nearestBeforeCross(prepared.ball, raw, postX, postY, fraction)).toBeGreaterThan(
        BALL_R + POST_R,
      );
      expect(crossedGoal(prepared.ball, raw, prepared)).toEqual({
        team,
        scorerId: scorer.id,
        ownGoal: false,
      });
      const original = JSON.stringify(prepared);
      const judged = step(prepared, T0 + STEP_MS);
      expect(judged.goal).toEqual({ team, scorerId: scorer.id, ownGoal: false });
      expect(judged.state.lastTouch).toBe(scorer.id);
      expect(
        [
          judged.state.ball.x,
          judged.state.ball.y,
          judged.state.ball.vx,
          judged.state.ball.vy,
        ].every(Number.isFinite),
      ).toBe(true);
      expect(Math.hypot(judged.state.ball.vx, judged.state.ball.vy)).toBeLessThanOrEqual(
        BALL_SPEED + 0.00001,
      );
      expect(JSON.stringify(prepared)).toBe(original);
    },
  );

  it.each(corners)(
    'blocks a %s raw crossing whose segment clips a solid post before the line',
    (_name, postX, postY, horizontal, vertical) => {
      const base = isolated();
      const team = horizontal === 1 ? 'red' : 'blue';
      const scorer = base.discs.find((disc) => disc.team === team)!;
      const prepared = deepFreeze({
        ...base,
        lastTouch: scorer.id,
        ball: body(
          postX - horizontal * 0.36,
          postY - vertical * 3.49,
          horizontal * 47.9,
          vertical * 3.08,
        ),
      });
      const raw = rawAfter(prepared.ball);
      const line = postX + horizontal * BALL_R;
      const fraction = (line - prepared.ball.x) / (raw.x - prepared.ball.x);
      const crossingY = prepared.ball.y + (raw.y - prepared.ball.y) * fraction;
      // Both endpoints and the raw crossing clear the post. The intervening
      // path does not: a contact-aware step must not score its unreflected ray.
      expect(Math.hypot(prepared.ball.x - postX, prepared.ball.y - postY)).toBeGreaterThan(
        BALL_R + POST_R,
      );
      expect(Math.hypot(raw.x - postX, raw.y - postY)).toBeGreaterThan(BALL_R + POST_R);
      expect(Math.hypot(line - postX, crossingY - postY)).toBeGreaterThan(BALL_R + POST_R);
      expect(nearestBeforeCross(prepared.ball, raw, postX, postY, fraction)).toBeLessThan(
        BALL_R + POST_R,
      );
      expect(fraction).toBeGreaterThan(0);
      expect(fraction).toBeLessThan(1);
      expect(crossedGoal(prepared.ball, raw, prepared)).toEqual({
        team,
        scorerId: scorer.id,
        ownGoal: false,
      });
      const original = JSON.stringify(prepared);
      const judged = step(prepared, T0 + STEP_MS);
      expect(judged.goal).toBeNull();
      expect((judged.state.ball.x - postX) * horizontal).toBeLessThanOrEqual(BALL_R);
      expect(judged.state.lastTouch).toBe(scorer.id);
      expect(
        [
          judged.state.ball.x,
          judged.state.ball.y,
          judged.state.ball.vx,
          judged.state.ball.vy,
        ].every(Number.isFinite),
      ).toBe(true);
      expect(Math.hypot(judged.state.ball.vx, judged.state.ball.vy)).toBeLessThanOrEqual(
        BALL_SPEED + 0.00001,
      );
      expect(JSON.stringify(prepared)).toBe(original);
    },
  );
  it.each(corners)(
    'allows a legal %s same-step bank goal only after resolving its earlier post contact',
    (_name, postX, postY, horizontal, vertical) => {
      const base = isolated();
      const team = horizontal === 1 ? 'red' : 'blue';
      const scorer = base.discs.find((disc) => disc.team === team)!;
      const prepared = deepFreeze({
        ...base,
        lastTouch: scorer.id,
        ball: body(
          postX + horizontal * 0.8,
          postY - vertical * 3.42,
          horizontal * 30.181087,
          vertical * 15.090543,
        ),
      });
      const raw = rawAfter(prepared.ball);
      const line = postX + horizontal * BALL_R;
      const fraction = (line - prepared.ball.x) / (raw.x - prepared.ball.x);
      const rawCrossingY = prepared.ball.y + (raw.y - prepared.ball.y) * fraction;
      expect(Math.hypot(prepared.ball.x - postX, prepared.ball.y - postY)).toBeGreaterThan(
        BALL_R + POST_R,
      );
      expect(Math.hypot(raw.x - postX, raw.y - postY)).toBeGreaterThan(BALL_R + POST_R);
      expect(nearestBeforeCross(prepared.ball, raw, postX, postY, fraction)).toBeLessThan(
        BALL_R + POST_R,
      );
      const original = JSON.stringify(prepared);
      const judged = step(prepared, T0 + STEP_MS);
      expect(judged.goal).toEqual({ team, scorerId: scorer.id, ownGoal: false });
      // The post pushes this outgoing-side strike further into the goal and away
      // from its corner. An unreflected raw ray or blanket obstruction veto fails.
      expect(judged.state.ball.vx * horizontal).toBeGreaterThan(
        prepared.ball.vx * 0.994 * horizontal + 1,
      );
      expect((judged.state.ball.vy - prepared.ball.vy * 0.994) * -vertical).toBeGreaterThan(1);
      expect((judged.state.ball.y - rawCrossingY) * -vertical).toBeGreaterThan(0.2);
      expect((judged.state.ball.x - postX) * horizontal).toBeCloseTo(BALL_R + 0.000001, 6);
      expect(
        Math.hypot(judged.state.ball.x - postX, judged.state.ball.y - postY),
      ).toBeGreaterThanOrEqual(BALL_R + POST_R - 0.00001);
      expect(judged.state.lastTouch).toBe(scorer.id);
      expect(Math.hypot(judged.state.ball.vx, judged.state.ball.vy)).toBeLessThanOrEqual(
        BALL_SPEED + 0.00001,
      );
      expect(JSON.stringify(prepared)).toBe(original);
    },
  );
  it.each(corners)(
    'does not invent a %s goal from the chord before post-overlap recovery',
    (_name, postX, postY, horizontal, vertical) => {
      const base = isolated();
      const team = horizontal === 1 ? 'red' : 'blue';
      const scorer = base.discs.find((disc) => disc.team === team)!;
      // Deliberate overlap exercises total recovery. The position repair passes
      // the whole-ball line outside the mouth; later flight enters the mouth
      // while already beyond that line, so there has been no legal crossing.
      const prepared = deepFreeze({
        ...base,
        lastTouch: scorer.id,
        ball: body(postX + horizontal * 1.9, postY - vertical, -horizontal * 20, -vertical * 40),
      });
      expect(Math.hypot(prepared.ball.x - postX, prepared.ball.y - postY)).toBeLessThan(
        BALL_R + POST_R,
      );
      const judged = step(prepared, T0 + STEP_MS);
      expect((judged.state.ball.x - postX) * horizontal).toBeGreaterThan(BALL_R);
      expect(Math.abs(judged.state.ball.y - H / 2)).toBeLessThan(GOAL_HALF - BALL_R);
      // A false straight chord from the pre-flight state would award this goal.
      expect(crossedGoal(prepared.ball, judged.state.ball, prepared)).toEqual({
        team,
        scorerId: scorer.id,
        ownGoal: false,
      });
      expect(judged.goal).toBeNull();
      expect(judged.state.lastTouch).toBe(scorer.id);
      expect(
        [
          judged.state.ball.x,
          judged.state.ball.y,
          judged.state.ball.vx,
          judged.state.ball.vy,
        ].every(Number.isFinite),
      ).toBe(true);
    },
  );
});

describe('intent acceptance, lease and armed kick', () => {
  it('normalizes diagonal drive and applies less acceleration while kick is held', () => {
    const base = isolated();
    const id = base.discs[0]!.id;
    const straight = step(control(base, id, { dx: 1 }), T0 + STEP_MS).state.discs[0]!;
    const diagonal = step(control(base, id, { dx: 1, dy: 1 }), T0 + STEP_MS).state.discs[0]!;
    const armed = step(control(base, id, { dx: 1, kick: true }), T0 + STEP_MS).state.discs[0]!;
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(
      Math.hypot(straight.vx, straight.vy),
      5,
    );
    expect(diagonal.vx).toBeCloseTo(diagonal.vy, 5);
    expect(armed.vx).toBeLessThan(straight.vx);
    expect(straight.vx).toBeGreaterThan(0);
  });
  it('keeps a distant kick armed, kicks radially on contact, and needs release to kick again', () => {
    let base = isolated();
    const id = base.discs[0]!.id;
    base = {
      ...base,
      discs: base.discs.map((disc, i) => (i === 0 ? { ...disc, x: 60, y: 50 } : disc)),
      ball: body(80, 50),
    };
    const waiting = step(control(base, id, { kick: true }), T0 + STEP_MS).state;
    expect(waiting.intents[id]?.kickArmed).toBe(true);
    expect(waiting.intents[id]?.lastKickAt).toBeNull();
    const nearby = { ...waiting, ball: body(67, 50) };
    const fired = step(nearby, T0 + STEP_MS * 2).state;
    expect(fired.ball.vx).toBeGreaterThan(30);
    expect(fired.ball.vy).toBe(0);
    expect(fired.intents[id]?.kickArmed).toBe(false);
    expect(fired.intents[id]?.lastKickAt).toBe(T0 + STEP_MS * 2);
    const held = applyControl(
      { ...fired, ball: body(67, 50) },
      id,
      input(fired, id, { kick: true }),
      T0 + 150,
    );
    expect(step(held, T0 + 200).state.intents[id]?.lastKickAt).toBe(T0 + 100);
    expect(step(held, T0 + 200).state.ball.vx).toBe(0);
    const released = applyControl(held, id, input(held, id, { kick: false }), T0 + 250);
    const rearmed = applyControl(released, id, input(released, id, { kick: true }), T0 + 300);
    expect(step(rearmed, T0 + 300).state.intents[id]?.lastKickAt).toBe(T0 + 100);
    const again = step(rearmed, T0 + 100 + KICK_COOLDOWN_MS).state;
    expect(again.intents[id]?.lastKickAt).toBe(T0 + 100 + KICK_COOLDOWN_MS);
    expect(again.ball.vx).toBeGreaterThan(30);
  });
  it('expires movement and a prepared kick at the exact lease boundary', () => {
    const base = isolated();
    const id = base.discs[0]!.id;
    const armed = control(base, id, { dx: 1, kick: true });
    const moving = advanceWorld(armed, T0 + LEASE_MS - STEP_MS).state;
    expect(moving.intents[id]?.kickArmed).toBe(true);
    const stopped = step(
      { ...moving, ball: body(moving.discs[0]!.x + 7, moving.discs[0]!.y) },
      T0 + LEASE_MS,
    ).state;
    expect(stopped.intents[id]?.dx).toBe(0);
    expect(stopped.intents[id]?.kickHeld).toBe(false);
    expect(stopped.intents[id]?.kickArmed).toBe(false);
    expect(stopped.intents[id]?.lastKickAt).toBeNull();
    expect(stopped.discs[0]!.vx).toBeLessThan(moving.discs[0]!.vx);
  });
  it('guards old sequence, old play instance, spectators, malformed schema and backward time', () => {
    const base = start();
    const accepted = control(base, 'p1', { dx: 1, seq: 7 });
    for (const patch of [
      { seq: 7, dx: -1 },
      { seq: 6 },
      { phaseAt: base.phase.startedAt - 1, seq: 8 },
    ]) {
      const next = control(accepted, 'p1', patch, T0 + 100);
      expect(next.intents).toEqual(accepted.intents);
      expect(next.discs).toEqual(accepted.discs);
    }
    expect(applyControl(accepted, 'p1', input(accepted, 'p1', { seq: 7, dx: -1 }), T0 + 10)).toBe(
      accepted,
    );
    expect(applyControl(accepted, 'p1', input(accepted, 'p1', { phaseAt: T0 - 1 }), T0 + 10)).toBe(
      accepted,
    );
    for (const id of ['spectator', '__proto__', 'constructor']) {
      const next = control(accepted, id, { dx: 1, seq: 99 }, T0 + 10);
      expect(next.intents).toEqual(accepted.intents);
      expect(next.discs).toEqual(accepted.discs);
    }
    expect(control(accepted, 'p1', { dx: -1 }, T0 - 1)).toBe(accepted);
    expect(game.inputSchema.safeParse({ ...input(base, 'p1'), dx: 2 }).success).toBe(false);
    expect(game.inputSchema.safeParse({ ...input(base, 'p1'), seq: 1.5 }).success).toBe(false);
    const staleTimer = game.reduce(accepted, {
      type: 'timer',
      now: T0 + 100,
      phaseId: 'play',
      startedAt: T0 - 1,
    });
    expect(staleTimer.discs).toEqual(accepted.discs);
    expect(staleTimer.phase).toEqual(accepted.phase);
  });
});

describe('two bounded halves and lifecycle', () => {
  it('defaults to two90-second halves, swaps ends once, retains teams and ends an idle0–0', () => {
    const first = start();
    expect(first.halfSeconds).toBe(90);
    const halftime = timer(first, first.halfEndsAt);
    expect(halftime.phase.id).toBe('halftime');
    expect(halftime.phase.deadline! - halftime.phase.startedAt).toBe(HALFTIME_MS);
    const second = timer(halftime);
    expect(second.half).toBe(2);
    expect(second.redAttacksRight).toBe(false);
    expect(second.teams).toEqual(first.teams);
    expect(second.halfEndsAt - second.phase.startedAt).toBe(90_000);
    for (const disc of first.discs) {
      const opposite = second.discs.find((other) => other.id === disc.id)!;
      expect(opposite.number).toBe(disc.number);
      expect(opposite.x).toBeCloseTo(W - disc.x);
      expect(opposite.y).toBe(disc.y);
    }
    const done = timer(second, second.halfEndsAt);
    expect(done.phase.id).toBe('done');
    expect(done.phase.deadline).toBeNull();
    expect(done.clock - T0).toBe(188_000);
    expect(game.results(done)?.winnerIds.sort()).toEqual(Object.keys(first.players).sort());
  });
  it('caps goal beats at the half boundary and refuses a goal/input landing after the cap', () => {
    const base = isolated();
    const late = enterGoal(
      base,
      { team: 'red', scorerId: null, ownGoal: false },
      base.halfEndsAt - 1000,
    );
    expect(late.phase.deadline).toBe(base.halfEndsAt);
    const half = timer(late);
    expect(half.phase.id).toBe('halftime');
    expect(half.halfEndsAt).toBe(base.halfEndsAt);
    const ballAtEnd = { ...base, ball: body(W + 1, H / 2, BALL_SPEED) };
    const tooLate = control(ballAtEnd, base.discs[0]!.id, { kick: true }, base.halfEndsAt);
    expect(tooLate.phase.id).toBe('halftime');
    // The old ball crosses well before the horn and still counts; the new late
    // kick is not accepted and cannot extend the first half.
    expect(tooLate.goals).toEqual({ red: 1, blue: 0 });
    expect(tooLate.intents[base.discs[0]!.id]?.kickArmed).toBe(false);
    const resumed = timer(
      enterGoal(base, { team: 'blue', scorerId: null, ownGoal: false }, T0 + 1000),
    );
    expect(resumed.phase.id).toBe('play');
    expect(resumed.half).toBe(1);
    expect(resumed.halfEndsAt).toBe(base.halfEndsAt);
    expect(resumed.phase.startedAt).not.toBe(base.phase.startedAt);
    expect(control(resumed, 'p1', { phaseAt: base.phase.startedAt, dx: 1 }).intents).toEqual(
      resumed.intents,
    );
  });
  it('pause freezes physics and shifts half/beat/cooldown clocks without resurrecting held input', () => {
    const base = start(2);
    const driven = control(base, 'p1', { dx: 1, kick: true });
    driven.intents.p1!.kickReadyAt = T0 + 500;
    driven.intents.p1!.lastKickAt = T0 - 50;
    const paused = game.reduce(deepFreeze(driven), { type: 'vip', action: 'pause', now: T0 + 75 });
    const ignored = control(paused, 'p1', { dy: 1, kick: true }, T0 + 1000);
    expect(ignored.ball).toEqual(paused.ball);
    expect(ignored.discs).toEqual(paused.discs);
    const resumed = game.reduce(ignored, { type: 'vip', action: 'resume', now: T0 + 4075 });
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.phase.startedAt).toBe(base.phase.startedAt);
    expect(resumed.halfEndsAt).toBe(base.halfEndsAt + 4000);
    expect(resumed.phase.deadline).toBe(paused.phase.deadline! + 4000);
    expect(resumed.simAt).toBe(paused.simAt + 4000);
    expect(resumed.intents.p1?.kickReadyAt).toBe(T0 + 4500);
    expect(resumed.intents.p1?.lastKickAt).toBe(T0 - 50);
    expect(resumed.intents.p1?.until).toBe(0);
    expect(resumed.intents.p1?.dx).toBe(0);
    expect(resumed.intents.p1?.kickArmed).toBe(false);
  });
  it('VIP End during a long pause locks frozen positions and scores while unpaused End judges motion', () => {
    const base = deepFreeze({
      ...isolated(),
      goals: { red: 2, blue: 1 },
      ball: body(W + 1, H / 2, 30),
    });
    const paused = game.reduce(base, { type: 'vip', action: 'pause', now: T0 });
    const frozenJson = JSON.stringify(paused);
    const ended = game.reduce(paused, { type: 'vip', action: 'end', now: T0 + 200_000 });
    expect(ended.phase.id).toBe('done');
    expect(ended.half).toBe(1);
    expect(ended.redAttacksRight).toBe(paused.redAttacksRight);
    expect(ended.halfEndsAt).toBe(paused.halfEndsAt);
    expect(ended.simAt).toBe(paused.simAt);
    expect(ended.goals).toEqual({ red: 2, blue: 1 });
    expect(ended.ball).toEqual({ ...paused.ball, vx: 0, vy: 0 });
    expect(ended.discs).toEqual(paused.discs.map((disc) => ({ ...disc, vx: 0, vy: 0 })));
    expect(game.results(ended)!.scores).toEqual(
      Object.fromEntries(
        Object.keys(base.players).map((id) => [id, base.teams[id] === 'red' ? 2 : 1]),
      ),
    );
    expect(JSON.stringify(paused)).toBe(frozenJson);

    // The same ball crosses on the next judged step when no pause is holding the world.
    const liveEnd = game.reduce(base, { type: 'vip', action: 'end', now: T0 + 100 });
    expect(liveEnd.phase.id).toBe('done');
    expect(liveEnd.goals).toEqual({ red: 3, blue: 1 });
    expect(liveEnd.lastGoal?.team).toBe('red');
    expect(liveEnd.ball).toEqual(body(W / 2, H / 2));
  });
  it('drops stop a disc, reconnect keeps its seat, permanent leavers stay in watch mode', () => {
    const base = control(start(), 'p1', { dx: 1, kick: true });
    const dropped = game.reduce(base, {
      type: 'player',
      now: T0 + 100,
      playerId: 'p1',
      connected: false,
    });
    expect(dropped.intents.p1?.dx).toBe(0);
    expect(dropped.discs.find((disc) => disc.id === 'p1')?.vx).toBe(0);
    expect(control(dropped, 'p1', { dx: 1 }, T0 + 150).intents).toEqual(dropped.intents);
    const returned = game.reduce(dropped, {
      type: 'player',
      now: T0 + 200,
      playerId: 'p1',
      connected: true,
    });
    expect(game.controllerView(returned, 'p1').team).toBe(game.controllerView(base, 'p1').team);
    expect(control(returned, 'p1', { dy: 1 }, T0 + 200).intents.p1?.dy).toBe(1);
    const left = game.reduce(returned, {
      type: 'player',
      now: T0 + 300,
      playerId: 'p1',
      connected: false,
      gone: 'left',
    });
    const rejoin = game.reduce(left, {
      type: 'player',
      now: T0 + 400,
      playerId: 'p1',
      connected: true,
    });
    expect(rejoin.left).toContain('p1');
    expect(game.controllerView(rejoin, 'p1').departed).toBe(true);
    expect(game.controllerView(rejoin, 'p1').screen).toBe('departed');
    expect(control(rejoin, 'p1', { dx: 1 }, T0 + 400).intents.p1?.dx).toBe(0);
    expect(game.bot.sampleInput(rejoin, 'p1', createRng(1))).toBeNull();
    expect(game.results(enterDone(rejoin, T0 + 500))?.scores).toHaveProperty('p1');
  });
  it('an empty or fully departed room terminates even while paused', () => {
    let state = game.reduce(start(2), { type: 'vip', now: T0 + 10, action: 'pause' });
    for (const id of ['p1', 'p2'])
      state = game.reduce(state, {
        type: 'player',
        now: T0 + 20,
        playerId: id,
        connected: false,
        gone: 'kicked',
      });
    expect(state.phase.id).toBe('done');
    expect(game.results(state)?.ranking).toHaveLength(2);
    expect(game.init({ players: [], settings: {}, seed: 1, now: T0 }).phase.id).toBe('done');
  });
  it('VIP skip resumes a goal within the same half; skip half advances; early end records live team totals', () => {
    const base = start();
    const goal = enterGoal(base, { team: 'blue', scorerId: null, ownGoal: false }, T0 + 1000);
    const resumed = game.reduce(goal, { type: 'vip', now: T0 + 1100, action: 'skip' });
    expect(resumed.phase.id).toBe('play');
    expect(resumed.half).toBe(1);
    const half = game.reduce(resumed, { type: 'vip', now: T0 + 1200, action: 'skip' });
    expect(half.phase.id).toBe('halftime');
    const done = game.reduce(half, { type: 'vip', now: T0 + 1300, action: 'end' });
    expect(done.phase.id).toBe('done');
    expect(done.goals).toEqual({ red: 0, blue: 1 });
  });
});

describe('team results, private controls and real bot choices', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'balances %i players, names one odd helper and excludes it from results',
    (count) => {
      const state = start(count);
      const red = state.discs.filter((disc) => disc.team === 'red');
      const blue = state.discs.filter((disc) => disc.team === 'blue');
      expect(red).toHaveLength(Math.ceil(count / 2));
      expect(blue).toHaveLength(Math.ceil(count / 2));
      expect(state.discs.filter((disc) => disc.helper)).toHaveLength(count % 2);
      expect(
        game
          .tvView(state)
          .discs.filter((disc) => disc.helper)
          .every((disc) => disc.name === 'Blue Helper'),
      ).toBe(true);
      const done = enterDone({ ...state, goals: { red: 4, blue: 2 } }, T0 + 10);
      const result = game.results(done)!;
      expect(Object.keys(result.scores).sort()).toEqual(Object.keys(state.players).sort());
      expect(result.winnerIds.sort()).toEqual(
        Object.keys(state.players)
          .filter((id) => state.teams[id] === 'red')
          .sort(),
      );
      for (const row of result.ranking) {
        expect(row.score).toBe(state.teams[row.playerId] === 'red' ? 4 : 2);
        const losingRank = Object.values(state.teams).filter((team) => team === 'red').length + 1;
        expect(row.rank).toBe(state.teams[row.playerId] === 'red' ? 1 : losingRank);
      }
      expect(result.outcome?.kind).toBe('teams');
      expect(result.outcome?.kind === 'teams' && result.outcome.winner).toBe('red');
    },
  );
  it('equal goals tie every participant and future team-goal totals never leak before scoring', () => {
    const base = start();
    expect(game.results(base)).toBeNull();
    expect(game.tvView(base).goals).toEqual({ red: 0, blue: 0 });
    const draw = game.results(enterDone({ ...base, goals: { red: 2, blue: 2 } }, T0 + 1))!;
    expect(draw.ranking.every((row) => row.rank === 1 && row.score === 2)).toBe(true);
    expect(draw.winnerIds).toHaveLength(8);
    expect(draw.outcome?.kind === 'teams' && draw.outcome.winner).toBeNull();
  });
  it('all field views agree while another seat’s lease/seq/armed state stays private', () => {
    const before = start();
    const changed = control(before, 'p1', { seq: 173, dx: 1, kick: true });
    expect(game.tvView(changed)).toEqual(game.tvView(before));
    expect(game.controllerView(changed, 'p2')).toEqual(game.controllerView(before, 'p2'));
    expect(game.controllerView(changed, 'spectator')).toEqual(
      game.controllerView(before, 'spectator'),
    );
    expect(game.controllerView(changed, 'p1').acceptedSeq).toBe(173);
    expect(game.controllerView(changed, 'p1').kickArmed).toBe(true);
    for (const id of ['p1', 'p2', 'spectator', '__proto__']) {
      const view = game.controllerView(changed, id);
      expect(view.discs).toEqual(game.tvView(changed).discs);
      expect(copy(view)).toEqual(view);
      expect(JSON.stringify(view)).not.toContain('"intents"');
      expect(JSON.stringify(view)).not.toContain('"until"');
    }
  });
  it('separates a normal defender/supporter from easy pursuit and positions a striker behind the ball', () => {
    const state = start(8);
    const red = state.discs.filter((disc) => disc.team === 'red');
    const striker = red[0]!;
    const defender = red.find((disc) => disc.number === 2)!;
    const support = red.find((disc) => disc.number === 3)!;
    const prepared: State = {
      ...state,
      ball: body(95, 50),
      discs: state.discs.map((disc) =>
        disc.team !== 'red'
          ? { ...disc, y: 90 }
          : disc.id === striker.id
            ? { ...disc, x: 89, y: 50 }
            : disc.id === defender.id
              ? { ...disc, x: 35, y: 50 }
              : disc.id === support.id
                ? { ...disc, x: 75, y: 50 }
                : disc,
      ),
    };
    const ownStriker = prepared.discs.find((disc) => disc.id === striker.id)!;
    expect(decision(prepared, ownStriker, 'sharp').kick).toBe(true);
    const ownDefender = prepared.discs.find((disc) => disc.id === defender.id)!;
    expect(decision(prepared, ownDefender, 'normal').dx).toBe(-1);
    expect(decision(prepared, ownDefender, 'easy').dx).toBe(1);
    const ownSupport = prepared.discs.find((disc) => disc.id === support.id)!;
    expect(decision(prepared, ownSupport, 'normal').dy).toBe(-1);
    const ahead = {
      ...prepared,
      discs: prepared.discs.map((disc) => (disc.id === striker.id ? { ...disc, x: 99 } : disc)),
    };
    expect(
      decision(
        ahead,
        ahead.discs.find((disc) => disc.id === striker.id)!,
        'sharp',
      ).dx,
    ).toBe(-1);
  });
  it.each(['easy', 'normal', 'sharp'] as const)(
    '%s bots escape opposing centre contact through real controls and physics',
    (skill) => {
      const base = start(2, 5);
      const initial = deepFreeze({
        ...base,
        discs: base.discs.map((disc) => ({
          ...disc,
          x: W / 2 + (disc.team === 'red' ? -6.5 : 6.5),
          y: H / 2,
          vx: 0,
          vy: 0,
        })),
      });
      const original = JSON.stringify(initial);
      for (const disc of initial.discs) {
        const choice = decision(initial, disc, skill);
        // Facing an opposing disc across the ball is not an open shooting lane.
        expect(choice.kick).toBe(false);
        expect(choice.dy).not.toBe(0);
      }
      let state: State = initial;
      const rng = createRng(73);
      let lateralTravel = 0;
      const acceptedKicks = new Set<string>();
      // The actual reducer accepts atomic bot packets and judges every 50 ms step.
      // No ball impulse or score is supplied by this regression fixture.
      for (let beat = 0; beat < 150 && state.phase.id === 'play'; beat++) {
        const at = T0 + beat * 100;
        if (beat > 0) state = timer(state, at);
        lateralTravel = Math.max(lateralTravel, Math.abs(state.ball.y - H / 2));
        if (state.phase.id !== 'play') break;
        for (const disc of state.discs) {
          const choice = game.bot.sampleInput(state, disc.id, rng, skill);
          if (choice) state = control(state, disc.id, choice, at);
          const firedAt = state.intents[disc.id]?.lastKickAt;
          if (firedAt !== null && firedAt !== undefined) acceptedKicks.add(`${disc.id}:${firedAt}`);
        }
      }
      expect(acceptedKicks.size).toBeGreaterThan(0);
      expect(lateralTravel).toBeGreaterThan(8);
      expect(JSON.stringify(initial)).toBe(original);
    },
  );
  it('bot returns valid varied inputs in play and sits out spectators, paused, finished and departed seats', () => {
    const base = start();
    const rng = createRng(12);
    const choices = new Set<string>();
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (const disc of base.discs) {
        const choice = game.bot.sampleInput(base, disc.id, rng, skill);
        expect(choice).not.toBeNull();
        expect(game.inputSchema.safeParse(choice).success).toBe(true);
        choices.add(JSON.stringify(choice));
      }
    }
    expect(choices.size).toBeGreaterThan(2);
    expect(game.bot.sampleInput(base, 'spectator', rng)).toBeNull();
    expect(game.bot.sampleInput(enterDone(base, T0), 'p1', rng)).toBeNull();
    expect(
      game.bot.sampleInput(game.reduce(base, { type: 'vip', now: T0, action: 'pause' }), 'p1', rng),
    ).toBeNull();
    expect(finishIdle(start(2, 3, 30)).phase.id).toBe('done');
  });
});

describe('fixed event-time catchup', () => {
  it('a delayed timer matches timely physics and goal/reset transitions exactly', () => {
    const base = { ...isolated(), ball: body(W + 1, H / 2, 30) };
    let receipt = T0 + 6000;
    let prompt = base;
    while (prompt.phase.deadline !== null && prompt.phase.deadline <= receipt)
      prompt = timer(prompt);
    // A reset starts a fresh host-beat grid; compare at the next actual due beat.
    receipt = prompt.phase.deadline ?? receipt;
    prompt = timer(prompt, receipt);
    const delayed = timer(base, receipt);
    expect(delayed).toEqual(prompt);
    expect(delayed.goals).toEqual({ red: 1, blue: 0 });
    expect(delayed.phase.id).toBe('play');
  });
  it('one late receipt crosses both halves at their original deadlines', () => {
    const base = start(2);
    const receipt = T0 + 200_000;
    const delayed = timer(base, receipt);
    const prompt = finishIdle(base);
    expect(delayed.phase.id).toBe('done');
    expect(delayed.phase.startedAt).toBe(T0 + 188_000);
    expect(delayed.half).toBe(2);
    expect(delayed.redAttacksRight).toBe(false);
    expect(delayed.goals).toEqual(prompt.goals);
    expect(delayed.discs).toEqual(prompt.discs);
    expect(game.results(delayed)).toEqual(game.results(prompt));
    expect(delayed.clock).toBe(receipt);
  });
  it('a goal on the final physics step counts and goes directly to halftime without an extra beat', () => {
    const base: State = {
      ...isolated(),
      halfEndsAt: T0 + STEP_MS,
      phase: { id: 'play', startedAt: T0, deadline: T0 + STEP_MS },
      ball: body(W + 1, H / 2, 30),
    };
    const ended = timer(base);
    expect(ended.goals).toEqual({ red: 1, blue: 0 });
    expect(ended.phase.id).toBe('halftime');
    expect(ended.phase.startedAt).toBe(base.halfEndsAt);
    expect(ended.phase.deadline).toBe(base.halfEndsAt + HALFTIME_MS);
    const final = timer({ ...base, half: 2 });
    expect(final.phase.id).toBe('done');
    expect(final.goals.red).toBe(1);
    expect(final.phase.startedAt).toBe(base.halfEndsAt);
  });
  it('late old-screen inputs and skips cannot apply to an automatic successor', () => {
    const base = start(2);
    const receipt = base.halfEndsAt + HALFTIME_MS + 100;
    const late = control(base, 'p1', { dx: 1, kick: true }, receipt);
    expect(late.half).toBe(2);
    expect(late.phase.id).toBe('play');
    expect(late.intents.p1?.seq).toBe(-1);
    const skipped = game.reduce(base, { type: 'vip', now: receipt, action: 'skip' });
    expect(skipped.half).toBe(2);
    expect(skipped.phase.id).toBe('play');
    expect(skipped.halfEndsAt).toBe(T0 + 188_000);
  });
});
