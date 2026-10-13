// Fixed 50 ms circle physics. Only cloned bodies are mutated inside one bounded step.
import { attacksRight, centerBall, formation } from './content';
import { activeDisc, decision } from './strategy';
import {
  BALL_R,
  BALL_SPEED,
  GOAL_DEPTH,
  GOAL_HALF,
  H,
  KICK_COOLDOWN_MS,
  KICK_RANGE,
  LEASE_MS,
  PLAYER_R,
  PLAYER_SPEED,
  POST_R,
  STEP_MS,
  W,
  neutral,
} from './types';
import type { Body, Goal, Input, Intent, State } from './types';

const rounded = (n: number): number => Math.round(n * 1000000) / 1000000 || 0;
function cap(body: Body, speed: number): void {
  const length = Math.hypot(body.vx, body.vy);
  if (length > speed) {
    body.vx *= speed / length;
    body.vy *= speed / length;
  }
}
function clean(body: Body): void {
  body.x = rounded(body.x);
  body.y = rounded(body.y);
  body.vx = rounded(body.vx);
  body.vy = rounded(body.vy);
}

export function applyControl(state: State, id: string, input: Input, now: number): State {
  const before = state.intents[id];
  if (!before || input.seq <= before.seq || input.phaseAt !== state.phase.startedAt) return state;
  const live = before.until > now ? before : neutral(before);
  const intent: Intent = {
    ...live,
    seq: input.seq,
    dx: input.dx,
    dy: input.dy,
    until: now + LEASE_MS,
    kickHeld: input.kick,
    kickArmed: input.kick ? (live.kickHeld ? live.kickArmed : true) : false,
  };
  return { ...state, intents: { ...state.intents, [id]: intent } };
}

export function resetPitch(state: State, now: number): State {
  return {
    ...state,
    simAt: now,
    discs: formation(state.discs, state.redAttacksRight),
    ball: centerBall(),
    lastTouch: null,
    intents: Object.fromEntries(
      Object.entries(state.intents).map(([id, intent]) => [id, neutral(intent)]),
    ),
  };
}

/** Equal-mass players and a lighter ball, with deterministic overlap normals. */
function collide(a: Body, ar: number, ai: number, b: Body, br: number, bi: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const radius = ar + br;
  if (distance >= radius) return false;
  const nx = distance > 0.000001 ? dx / distance : 1;
  const ny = distance > 0.000001 ? dy / distance : 0;
  const total = ai + bi;
  const overlap = radius - distance + 0.000001;
  a.x -= (nx * overlap * ai) / total;
  a.y -= (ny * overlap * ai) / total;
  b.x += (nx * overlap * bi) / total;
  b.y += (ny * overlap * bi) / total;
  const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (approach < 0) {
    const impulse = -(1.65 * approach) / total;
    a.vx -= impulse * ai * nx;
    a.vy -= impulse * ai * ny;
    b.vx += impulse * bi * nx;
    b.vy += impulse * bi * ny;
  }
  return true;
}

function walls(body: Body, radius: number, ball: boolean): void {
  if (body.y < radius) {
    body.y = radius;
    body.vy = Math.abs(body.vy) * 0.8;
  }
  if (body.y > H - radius) {
    body.y = H - radius;
    body.vy = -Math.abs(body.vy) * 0.8;
  }
  const mouth = Math.abs(body.y - H / 2) < GOAL_HALF - BALL_R;
  const low = ball && mouth ? -GOAL_DEPTH : radius;
  const high = ball && mouth ? W + GOAL_DEPTH : W - radius;
  if (body.x < low) {
    body.x = low;
    body.vx = Math.abs(body.vx) * 0.8;
  }
  if (body.x > high) {
    body.x = high;
    body.vx = -Math.abs(body.vx) * 0.8;
  }
  // Posts are solid for every body, including a player held against the goal corner.
  for (const x of [0, W]) {
    // Most bodies are nowhere near a post; avoid four circle solves per wall visit.
    if (Math.abs(body.x - x) >= radius + POST_R) continue;
    for (const y of [H / 2 - GOAL_HALF, H / 2 + GOAL_HALF]) {
      if (Math.abs(body.y - y) >= radius + POST_R) continue;
      const post: Body = { x, y, vx: 0, vy: 0 };
      collide(body, radius, 1, post, POST_R, 0);
    }
  }
}

/** Whole-ball crossing, with the crossing's interpolated y (never just its final y). */
export function crossedGoal(before: Body, after: Body, state: State): Goal | null {
  const side =
    before.x >= -BALL_R && after.x < -BALL_R
      ? 'left'
      : before.x <= W + BALL_R && after.x > W + BALL_R
        ? 'right'
        : null;
  if (!side) return null;
  const line = side === 'left' ? -BALL_R : W + BALL_R;
  const fraction = (line - before.x) / (after.x - before.x);
  const y = before.y + (after.y - before.y) * fraction;
  if (Math.abs(y - H / 2) > GOAL_HALF - BALL_R) return null;
  const redScores = (side === 'right') === state.redAttacksRight;
  const team = redScores ? 'red' : 'blue';
  const toucher = state.discs.find((disc) => disc.id === state.lastTouch);
  return { team, scorerId: toucher?.id ?? null, ownGoal: !!toucher && toucher.team !== team };
}

interface PostContact {
  fraction: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** First circle contact along one short flight, including deterministic overlap repair. */
function firstPostContact(before: Body, after: Body): PostContact | null {
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const lengthSquared = dx * dx + dy * dy;
  const radius = BALL_R + POST_R;
  let first: PostContact | null = null;
  for (const x of [0, W]) {
    if (Math.max(before.x, after.x) < x - radius || Math.min(before.x, after.x) > x + radius)
      continue;
    for (const y of [H / 2 - GOAL_HALF, H / 2 + GOAL_HALF]) {
      if (Math.max(before.y, after.y) < y - radius || Math.min(before.y, after.y) > y + radius)
        continue;
      const rx = before.x - x;
      const ry = before.y - y;
      const outside = rx * rx + ry * ry - radius * radius;
      let fraction = 0;
      if (outside >= 0) {
        if (lengthSquared === 0) continue;
        const along = rx * dx + ry * dy;
        const discriminant = along * along - lengthSquared * outside;
        // Exact tangency has no inward normal speed and needs no impulse.
        if (discriminant <= 0) continue;
        fraction = (-along - Math.sqrt(discriminant)) / lengthSquared;
        if (fraction < 0 || fraction > 1) continue;
      }
      // A solid side wall outside the mouth can precede a post contact. Preserve
      // the ordinary endpoint wall response instead of reaching through that wall.
      const wallAt = dx === 0 ? Infinity : ((dx > 0 ? W - BALL_R : BALL_R) - before.x) / dx;
      if (
        wallAt >= 0 &&
        wallAt < fraction &&
        Math.abs(before.y + dy * wallAt - H / 2) >= GOAL_HALF - BALL_R
      )
        continue;
      if (first && fraction >= first.fraction) continue;
      const hitX = before.x + dx * fraction - x;
      const hitY = before.y + dy * fraction - y;
      const distance = Math.hypot(hitX, hitY);
      first = {
        fraction,
        x,
        y,
        nx: distance > 0.000001 ? hitX / distance : -1,
        ny: distance > 0.000001 ? hitY / distance : 0,
      };
    }
  }
  return first;
}

function roundedPosition(ball: Body): Body {
  return { ...ball, x: rounded(ball.x), y: rounded(ball.y) };
}

/** Stop at the first legal whole-ball crossing, before any later endpoint correction. */
function stopAtGoal(ball: Body, before: Body, after: Body): void {
  const right = after.x > W + BALL_R;
  const line = right ? W + BALL_R : -BALL_R;
  const fraction = (line - before.x) / (after.x - before.x);
  ball.x = line + (right ? 0.000001 : -0.000001);
  ball.y = rounded(before.y + (after.y - before.y) * fraction);
}

/** At most four post contacts per fixed step; normal flight travels no more than2.4 units. */
function flyBall(state: State, dt: number): Goal | null {
  const ball = state.ball;
  let remaining = dt;
  for (let contact = 0; contact < 4; contact++) {
    const before = { ...ball };
    const after = { ...ball, x: ball.x + ball.vx * remaining, y: ball.y + ball.vy * remaining };
    const judged = roundedPosition(after);
    const goal = crossedGoal(before, judged, state);
    const post = firstPostContact(before, after);
    const goalAt = goal
      ? ((judged.x > W + BALL_R ? W + BALL_R : -BALL_R) - before.x) / (judged.x - before.x)
      : Infinity;
    if (goal && (!post || goalAt < post.fraction)) {
      stopAtGoal(ball, before, judged);
      return goal;
    }
    if (!post) {
      // Keep unrounded ordinary positions until final cleanup, including kick distances.
      ball.x = after.x;
      ball.y = after.y;
      return null;
    }
    const atContact = {
      ...ball,
      x: before.x + (after.x - before.x) * post.fraction,
      y: before.y + (after.y - before.y) * post.fraction,
    };
    ball.x = post.x + post.nx * (BALL_R + POST_R + 0.000001);
    ball.y = post.y + post.ny * (BALL_R + POST_R + 0.000001);
    const approach = ball.vx * post.nx + ball.vy * post.ny;
    if (approach < 0) {
      ball.vx -= 1.65 * approach * post.nx;
      ball.vy -= 1.65 * approach * post.ny;
    }
    remaining *= 1 - post.fraction;
    const repaired = roundedPosition(ball);
    const repairGoal = crossedGoal(atContact, repaired, state);
    if (repairGoal) {
      stopAtGoal(ball, atContact, repaired);
      return repairGoal;
    }
  }
  // Pathological overlaps cannot cause an unbounded loop or unjudged extra movement.
  return null;
}

function helperIntents(state: State, at: number): void {
  for (const disc of state.discs) {
    if (!disc.helper) continue;
    const old = state.intents[disc.id]!;
    // Match a normal seat's reaction cadence rather than reconsider on every physics step.
    if (old.until > 0 && at - (old.until - LEASE_MS) < 200) continue;
    const choice = decision(state, disc, 'normal');
    const held = choice.kick && !(old.kickHeld && !old.kickArmed);
    state.intents[disc.id] = {
      ...old,
      dx: choice.dx,
      dy: choice.dy,
      until: at + LEASE_MS,
      kickHeld: held,
      kickArmed: held ? (old.kickHeld ? old.kickArmed : true) : false,
    };
  }
}

export interface StepResult {
  state: State;
  goal: Goal | null;
}
export function step(state: State, at: number): StepResult {
  const work: State = {
    ...state,
    discs: state.discs.map((disc) => ({ ...disc })),
    ball: { ...state.ball },
    intents: Object.fromEntries(
      Object.entries(state.intents).map(([id, intent]) => [id, { ...intent }]),
    ),
    simAt: at,
  };
  helperIntents(work, at);
  const active = work.discs.filter((disc) => activeDisc(work, disc));
  const dt = STEP_MS / 1000;
  for (const disc of active) {
    let intent = work.intents[disc.id]!;
    if (intent.until <= at) {
      intent = neutral(intent);
      work.intents[disc.id] = intent;
    }
    const length = Math.hypot(intent.dx, intent.dy) || 1;
    const acceleration = intent.kickHeld ? 58 : 90;
    disc.vx = disc.vx * 0.87 + (intent.dx / length) * acceleration * dt;
    disc.vy = disc.vy * 0.87 + (intent.dy / length) * acceleration * dt;
    cap(disc, PLAYER_SPEED);
    disc.x += disc.vx * dt;
    disc.y += disc.vy * dt;
    walls(disc, PLAYER_R, false);
  }
  work.ball.vx *= 0.994;
  work.ball.vy *= 0.994;
  cap(work.ball, BALL_SPEED);
  const flightGoal = flyBall(work, dt);
  const beforeContact = roundedPosition(work.ball);
  if (!flightGoal) walls(work.ball, BALL_R, true);
  // Two bounded passes settle crowded contacts in stable roster order.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < active.length; i++) {
      const disc = active[i]!;
      for (let j = i + 1; j < active.length; j++)
        collide(disc, PLAYER_R, 1, active[j]!, PLAYER_R, 1);
      if (!flightGoal && collide(disc, PLAYER_R, 1, work.ball, BALL_R, 2.5))
        work.lastTouch = disc.id;
      walls(disc, PLAYER_R, false);
    }
    if (!flightGoal) walls(work.ball, BALL_R, true);
  }
  // Judge the same rounded positions as the final state without changing ordinary kick physics.
  // A completed crossing locks credit and cannot create a late fire stamp or impulse.
  const goal = flightGoal ?? crossedGoal(beforeContact, roundedPosition(work.ball), work);
  if (!goal) {
    for (const disc of active) {
      const intent = work.intents[disc.id]!;
      const distance = Math.hypot(work.ball.x - disc.x, work.ball.y - disc.y);
      if (!intent.kickArmed || !intent.kickHeld || intent.kickReadyAt > at || distance > KICK_RANGE)
        continue;
      const nx =
        distance > 0.000001
          ? (work.ball.x - disc.x) / distance
          : attacksRight(work, disc.team)
            ? 1
            : -1;
      const ny = distance > 0.000001 ? (work.ball.y - disc.y) / distance : 0;
      work.ball.vx += nx * 38 + disc.vx * 0.3;
      work.ball.vy += ny * 38 + disc.vy * 0.3;
      disc.vx -= nx * 3;
      disc.vy -= ny * 3;
      work.intents[disc.id] = {
        ...intent,
        kickArmed: false,
        kickReadyAt: at + KICK_COOLDOWN_MS,
        lastKickAt: at,
      };
      work.lastTouch = disc.id;
    }
  }
  for (const disc of work.discs) {
    cap(disc, PLAYER_SPEED);
    clean(disc);
  }
  cap(work.ball, BALL_SPEED);
  clean(work.ball);
  return { state: work, goal };
}

/** Same grid regardless of how often controls or timers arrive; at most one half of steps. */
export function advanceWorld(state: State, now: number): StepResult {
  let current = state;
  const to = Math.min(now, state.halfEndsAt);
  const maximum = Math.ceil((state.halfSeconds * 1000) / STEP_MS) + 1;
  for (let n = 0; n < maximum && current.simAt + STEP_MS <= to; n++) {
    const result = step(current, current.simAt + STEP_MS);
    current = result.state;
    if (result.goal) return result;
  }
  return { state: current, goal: null };
}
