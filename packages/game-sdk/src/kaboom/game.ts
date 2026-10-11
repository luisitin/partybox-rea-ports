// The kaboom kit's game (T-0646): a Kaboom Squad minigame is a manifest and a set of rules over a JSON world. The kit holds the
// clock (the world steps every STEP_MS of server time, whatever the phones send), the input, the views, the team's S/A/B/C
// grade and per-seat points for the board's coins. Phases: `play`, `done`. Pure: time comes from `event.now`, randomness
// from `state.rng`; the world is public (a co-op game hides nothing).
import type {
  ControllerView,
  GameDefinition,
  GameEvent,
  GameManifest,
  GameResults,
  GameStateBase,
  InitContext,
  PlayerStatus,
  Rng,
  RngState,
  TvView,
} from '@partybox/shared';
import { nextFloat, seedRng, z } from '@partybox/shared';
import { composeReduce } from '../reduce';
import { buildResults } from '../scoring';
import { numberSetting } from '../settings';
import { enterPhase, hasPlayer, isTimerFor, nextStep, pausedFor } from '../timer';
import { controllerEnvelope, envelope } from '../views';
import { gradeOf } from './grade';
import type { Cuts, Grade } from './grade';

/** The world advances in steps this long (and the deadline re-arms this often so a quiet room still ends). */
export const STEP_MS = 250;
export const PHASES = ['play', 'done'] as const;

export const inputSchema = z.object({
  type: z.literal('act'),
  /** What the player did: the game says what each number means (a button, a direction, a lane). */
  a: z.number().int().min(0).max(999),
  /** Which one (a slot, a target seat, a piece); 0 when the action needs none. */
  b: z.number().int().min(0).max(999).optional(),
});
export type Act = z.infer<typeof inputSchema>;

/** What a game brings: the world and its rules. Every function is pure and total; `t` is ms after the round began. */
export interface KaboomRules<W> {
  /** A fresh world for `n` seats. */
  init(n: number, rng: Rng, seconds: number): W;
  /** The world one STEP_MS later, `t` ms after the round began. Absent: the world only changes when someone acts. */
  step?(w: W, t: number, rng: Rng): W;
  /** A seat acts at `t`. Return the world unchanged when the act means nothing now. */
  act(w: W, seat: number, a: number, b: number, t: number, rng: Rng): W;
  /** Points for the board's coins, one per seat, finite and >= 0. */
  points(w: W): number[];
  /** The team's score: the grade comes from it. */
  team(w: W, n: number): number;
  /** The most the team can score and the cuts for S, A and B (a function of the seat count). */
  cuts(n: number): { max: number; cuts: Cuts };
  /** True when the round is won or done before the clock runs out. */
  over?(w: W, t: number): boolean;
  /** A bot's next act, or null to wait. `t` is the last settled moment. */
  bot(w: W, seat: number, t: number, rng: Rng): { a: number; b?: number } | null;
}

export interface KaboomState<W> extends GameStateBase {
  /** Server time the round began and ends; a pause moves both. */
  began: number;
  endsAt: number;
  /** Player order: acts and the world name seats by index in here. */
  seats: string[];
  world: W;
  /** The world has been stepped up to here (ms after `began`). */
  stepped: number;
  settings: { seconds: number };
}

interface Round<W> {
  began: number;
  endsAt: number;
  seats: string[];
  world: W;
  points: Record<string, number>;
  team: number;
  max: number;
  cuts: Cuts;
  grade: Grade;
}
export interface KaboomTvView<W> extends TvView, Round<W> {}
export interface KaboomControllerView<W> extends ControllerView, Round<W> {
  /** Your seat in `seats`, -1 for a spectator. */
  seat: number;
  /** 1 = most points; only once the round is over. */
  rank: number | null;
}

/** A mutable wrapper over the state's counter-based rng; `take` hands the advanced state back. */
function rngOf(state: RngState): { rng: Rng; take: () => RngState } {
  let s = state;
  const float = (): number => {
    const [v, next] = nextFloat(s);
    s = next;
    return v;
  };
  const int = (min: number, max: number): number => {
    const span = Math.max(0, Math.floor(max) - Math.ceil(min) + 1);
    return Math.ceil(min) + Math.floor(float() * span);
  };
  const rng: Rng = {
    float,
    int,
    pick: <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T,
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    chance: (p) => float() < p,
    state: () => s,
  };
  return { rng, take: () => s };
}

export interface KaboomGameOptions<W> {
  /** The parsed manifest: needs a `seconds` number setting. */
  manifest: GameManifest;
  rules: KaboomRules<W>;
}

export function defineKaboomGame<W>({
  manifest,
  rules,
}: KaboomGameOptions<W>): GameDefinition<
  KaboomState<W>,
  Act,
  KaboomTvView<W>,
  KaboomControllerView<W>
> {
  type S = KaboomState<W>;
  const endMs = (s: S): number => s.endsAt - s.began;
  const wake = (s: S): number =>
    s.began + Math.min(endMs(s), (Math.floor(s.stepped / STEP_MS) + 1) * STEP_MS);
  const finished = (s: S): boolean =>
    s.stepped >= endMs(s) || rules.over?.(s.world, s.stepped) === true;

  /** Step the world to `now`, a step at a time; stops early when the round is won. At the end, `stepped` is the full length. */
  function catchUp(s: S, now: number): S {
    const to = Math.min(now - s.began, endMs(s));
    if (to < s.stepped + STEP_MS && to < endMs(s)) return s;
    const { rng, take } = rngOf(s.rng);
    let world = s.world;
    let at = s.stepped;
    while (at + STEP_MS <= to && !(rules.over?.(world, at) === true)) {
      at += STEP_MS;
      if (rules.step) world = rules.step(world, at, rng);
    }
    if (to >= endMs(s)) at = endMs(s);
    return { ...s, world, stepped: at, rng: take() };
  }

  const enterDone = (s: S, now: number): S => enterPhase(catchUp(s, s.endsAt), 'done', now, null);

  function advance(s: S, now: number): S {
    if (s.phase.id !== 'play') return s;
    const stepped = catchUp(s, now);
    return finished(stepped)
      ? enterPhase(stepped, 'done', now, null)
      : nextStep(stepped, wake(stepped));
  }

  function playAct(s: S, event: GameEvent<Act>): S {
    if (event.type === 'timer') return isTimerFor(s, event) ? advance(s, event.now) : s;
    if (event.type !== 'input' || !hasPlayer(s, event.playerId)) return s;
    const seat = s.seats.indexOf(event.playerId);
    if (seat < 0) return s;
    const stepped = catchUp(s, event.now);
    if (finished(stepped)) return enterPhase(stepped, 'done', event.now, null);
    const t = Math.min(event.now - stepped.began, endMs(stepped));
    const { rng, take } = rngOf(stepped.rng);
    const world = rules.act(stepped.world, seat, event.input.a, event.input.b ?? 0, t, rng);
    const next = { ...stepped, world, rng: take() };
    return rules.over?.(world, t) === true ? enterPhase(next, 'done', event.now, null) : next;
  }

  /** A pause moves the whole round on by as long as it lasted. */
  const shifted = (s: S, ms: number): S =>
    ms <= 0 ? s : { ...s, began: s.began + ms, endsAt: s.endsAt + ms };

  function init(ctx: InitContext): S {
    const players: S['players'] = {};
    for (const p of ctx.players) players[p.id] = p;
    const seats = ctx.players.map((p) => p.id);
    const seconds = numberSetting(manifest, ctx.settings, 'seconds');
    const { rng, take } = rngOf(seedRng(ctx.seed));
    const world = rules.init(seats.length, rng, seconds);
    const base: S = {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      rng: take(),
      players,
      began: ctx.now,
      endsAt: ctx.now + seconds * 1000,
      seats,
      world,
      stepped: 0,
      settings: { seconds },
    };
    return nextStep(base, wake(base));
  }

  const reduce = composeReduce<S, Act>({
    phases: { play: playAct },
    advance,
    end: enterDone,
    prepare: (state, event) =>
      event.type === 'vip' && (event.action === 'resume' || event.action === 'skip')
        ? shifted(state, pausedFor(state, event.now))
        : state,
  });

  const pointsOf = (s: S): Record<string, number> => {
    const raw = rules.points(s.world);
    const out: Record<string, number> = {};
    s.seats.forEach((id, i) => {
      const v = raw[i] ?? 0;
      out[id] = Number.isFinite(v) && v > 0 ? v : 0;
    });
    return out;
  };

  function round(s: S): Round<W> {
    const n = s.seats.length;
    const { max, cuts } = rules.cuts(n);
    const raw = rules.team(s.world, n);
    const team = Number.isFinite(raw) && raw > 0 ? raw : 0;
    return {
      began: s.began,
      endsAt: s.endsAt,
      seats: s.seats,
      world: s.world,
      points: pointsOf(s),
      team,
      max,
      cuts,
      grade: gradeOf(team, cuts),
    };
  }

  const statusOf = (s: S) => (): PlayerStatus => (s.phase.id === 'play' ? 'active' : 'waiting');

  return {
    manifest,
    phases: PHASES,
    inputSchema,
    init,
    reduce,
    tvView: (s) => ({
      ...envelope(s, manifest.id, { statusOf: statusOf(s) }),
      timerMode: 'hidden',
      ...round(s),
    }),
    controllerView(s, playerId) {
      const points = pointsOf(s);
      const mine = points[playerId] ?? 0;
      const over = s.phase.id === 'done' && hasPlayer(s, playerId);
      return {
        ...controllerEnvelope(s, manifest.id, playerId, { statusOf: statusOf(s) }),
        timerMode: 'hidden',
        ...round(s),
        seat: s.seats.indexOf(playerId),
        rank: over ? 1 + Object.values(points).filter((v) => v > mine).length : null,
      };
    },
    results: (s): GameResults | null =>
      s.phase.id === 'done' ? buildResults(s, pointsOf(s)) : null,
    bot: {
      sampleInput(s, playerId, rng) {
        const seat = s.seats.indexOf(playerId);
        if (s.phase.id !== 'play' || seat < 0) return null;
        const move = rules.bot(s.world, seat, s.stepped, rng);
        return move ? { type: 'act', a: move.a, b: move.b ?? 0 } : null;
      },
    },
  };
}
