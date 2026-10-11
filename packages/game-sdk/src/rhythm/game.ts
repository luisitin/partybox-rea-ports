// The rhythm kit's game (T-0636): a Rhythm Kitchen minigame is a manifest, a style and a skin. `defineRhythmGame` is the
// whole server side: a seeded chart, the phone's taps judged by the server's clock, 2/1/0 points per note, the room's
// total on the TV. Phases: `play` (the song), `done`. Pure: time comes from `event.now`, randomness from `state.rng`.
import type {
  ControllerView,
  GameDefinition,
  GameEvent,
  GameManifest,
  GameResults,
  GameStateBase,
  InitContext,
  PlayerStatus,
  TvView,
} from '@partybox/shared';
import { seedRng, z } from '@partybox/shared';
import { composeReduce } from '../reduce';
import { buildResults } from '../scoring';
import { numberSetting } from '../settings';
import { enterPhase, hasPlayer, isTimerFor, nextStep, pausedFor } from '../timer';
import { controllerEnvelope, envelope } from '../views';
import {
  OK_MS,
  STRAY_MS,
  buildChart,
  freshMarks,
  judgeTap,
  maxPoints,
  pointsOf,
  settleMarks,
} from './chart';
import type { Chart, RhythmStyle } from './chart';

/** The deadline re-arms this often so a round with nobody tapping still ends and its misses are counted. */
export const TICK_MS = 250;

export const PHASES = ['play', 'done'] as const;

export const inputSchema = z.object({
  type: z.literal('tap'),
  lane: z.number().int().min(0).max(1),
});
export type Tap = z.infer<typeof inputSchema>;

export interface RhythmState extends GameStateBase {
  /** Server time the round began and ends; a pause moves both. Every note's time counts from `began`. */
  began: number;
  endsAt: number;
  chart: Chart;
  /** Player order: a note's `who` and the cues name seats by index in here. */
  seats: string[];
  /** playerId → one mark per note (see chart.ts). */
  marks: Record<string, string>;
  /** playerId → ms after `began` until which their pad is locked by a stray tap. */
  lock: Record<string, number>;
  /** Everything due up to here (ms after `began`) has been settled. */
  checked: number;
  settings: { seconds: number };
}

interface SongView {
  began: number;
  endsAt: number;
  chart: Chart;
  seats: string[];
  marks: Record<string, string>;
  scores: Record<string, number>;
  /** The most points each seat could have (their own notes × 2). */
  best: Record<string, number>;
}

export interface RhythmTvView extends TvView, SongView {}
export interface RhythmControllerView extends ControllerView, SongView {
  /** 1 = most points; only once the song is over. */
  rank: number | null;
  /** Ms after `began` until which your pad is locked by a stray tap (0 = free): the phone dims the pads. */
  lockedUntil: number;
}

type Next = (s: RhythmState, now: number) => RhythmState;

const endMs = (s: RhythmState): number => s.endsAt - s.began;

export const scoresOf = (s: RhythmState): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of s.seats) out[id] = pointsOf(s.marks[id] ?? '');
  return out;
};

const wake = (s: RhythmState): number =>
  s.began + Math.min(endMs(s), (Math.floor(s.checked / TICK_MS) + 1) * TICK_MS);

/** Count every note whose window has closed by `now` as missed; at the end, all of them. */
function settle(s: RhythmState, now: number): RhythmState {
  const to = Math.min(now - s.began, endMs(s));
  if (to <= s.checked && to < endMs(s)) return s;
  const closed = to >= endMs(s) ? Number.MAX_SAFE_INTEGER : to;
  const marks: Record<string, string> = {};
  for (const id of s.seats) marks[id] = settleMarks(s.chart, s.marks[id] ?? '', closed);
  return { ...s, marks, checked: Math.max(s.checked, to) };
}

const over = (s: RhythmState): boolean => s.checked >= endMs(s);

function enterDone(s: RhythmState, now: number): RhythmState {
  return enterPhase(settle(s, s.endsAt), 'done', now, null);
}

function advance(s: RhythmState, now: number): RhythmState {
  if (s.phase.id !== 'play') return s;
  const settled = settle(s, now);
  return over(settled) ? enterDone(settled, now) : nextStep(settled, wake(settled));
}

function playTap(s: RhythmState, event: GameEvent<Tap>, next: Next): RhythmState {
  if (event.type === 'timer') return isTimerFor(s, event) ? advance(s, event.now) : s;
  if (event.type !== 'input' || !hasPlayer(s, event.playerId)) return s;
  const id = event.playerId;
  const settled = settle(s, event.now);
  if (over(settled)) return next(settled, event.now);
  const t = event.now - settled.began;
  if (t < (settled.lock[id] ?? 0)) return settled;
  const judged = judgeTap(settled.chart, settled.marks[id] ?? '', event.input.lane, t);
  if (judged.hit === null) return { ...settled, lock: { ...settled.lock, [id]: t + STRAY_MS } };
  return { ...settled, marks: { ...settled.marks, [id]: judged.marks } };
}

/** A pause moves the whole round on by as long as it lasted. */
const shifted = (s: RhythmState, ms: number): RhythmState =>
  ms <= 0 ? s : { ...s, began: s.began + ms, endsAt: s.endsAt + ms };

export interface RhythmGameOptions {
  /** The parsed manifest: needs a `seconds` number setting. */
  manifest: GameManifest;
  style: RhythmStyle;
}

export function defineRhythmGame({
  manifest,
  style,
}: RhythmGameOptions): GameDefinition<RhythmState, Tap, RhythmTvView, RhythmControllerView> {
  function init(ctx: InitContext): RhythmState {
    const players: RhythmState['players'] = {};
    for (const p of ctx.players) players[p.id] = p;
    const seats = ctx.players.map((p) => p.id);
    const seconds = numberSetting(manifest, ctx.settings, 'seconds');
    const [chart, rng] = buildChart(seedRng(ctx.seed), style, seats.length, seconds * 1000);
    const marks: Record<string, string> = {};
    seats.forEach((id, i) => (marks[id] = freshMarks(chart, i)));
    const base: RhythmState = {
      phase: { id: 'play', startedAt: ctx.now, deadline: null },
      rng,
      players,
      began: ctx.now,
      endsAt: ctx.now + seconds * 1000,
      chart,
      seats,
      marks,
      lock: {},
      checked: 0,
      settings: { seconds },
    };
    return nextStep(base, wake(base));
  }

  const reduce = composeReduce<RhythmState, Tap>({
    phases: { play: playTap },
    advance,
    // The VIP's skip ends the song now, as its end does; `advance` ends it only when the song's time is up.
    skip: enterDone,
    end: enterDone,
    prepare: (state, event) =>
      event.type === 'vip' && event.action === 'resume'
        ? shifted(state, pausedFor(state, event.now))
        : state,
  });

  const statusOf = (s: RhythmState) => (): PlayerStatus =>
    s.phase.id === 'play' ? 'active' : 'waiting';

  function song(s: RhythmState): SongView {
    const best: Record<string, number> = {};
    for (const id of s.seats) best[id] = maxPoints(s.marks[id] ?? '');
    return {
      began: s.began,
      endsAt: s.endsAt,
      chart: s.chart,
      seats: s.seats,
      marks: s.marks,
      scores: scoresOf(s),
      best,
    };
  }

  return {
    manifest,
    phases: PHASES,
    inputSchema,
    init,
    reduce,
    tvView: (s) => ({
      ...envelope(s, manifest.id, { statusOf: statusOf(s) }),
      timerMode: 'hidden',
      ...song(s),
    }),
    controllerView(s, playerId) {
      const scores = scoresOf(s);
      const mine = scores[playerId] ?? 0;
      const finished = s.phase.id === 'done' && hasPlayer(s, playerId);
      return {
        ...controllerEnvelope(s, manifest.id, playerId, { statusOf: statusOf(s) }),
        timerMode: 'hidden',
        ...song(s),
        rank: finished ? 1 + Object.values(scores).filter((v) => v > mine).length : null,
        lockedUntil: s.lock[playerId] ?? 0,
      };
    },
    results: (s): GameResults | null =>
      s.phase.id === 'done' ? buildResults(s, scoresOf(s)) : null,
    bot: {
      // A bot has no clock: it reads the song at the last settled moment and taps what is about to come, so it plays
      // like a distracted person: some perfect, some early or late, some missed.
      sampleInput(s, playerId, rng) {
        if (s.phase.id !== 'play' || !s.seats.includes(playerId)) return null;
        // A stray tap locks the pad; wait for the clock to move on (the harness fires the timer when nobody acts).
        if ((s.lock[playerId] ?? 0) > s.checked) return null;
        const marks = s.marks[playerId] ?? '';
        const next = s.chart.notes.find(
          (n, i) =>
            marks[i] === '.' && n.t - s.checked > -OK_MS / 2 && n.t - s.checked < TICK_MS + 150,
        );
        if (!next || !rng.chance(0.85)) return null;
        return { type: 'tap', lane: next.lane };
      },
    },
  };
}
