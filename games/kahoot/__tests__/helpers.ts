// Shared helpers for the Lightning Round unit tests: hand-built events against the real reducer.
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { questionById } from '../server/content';
import type { Input, State, WagerPercent } from '../server/types';
import { controllerView, tvView } from '../server/views';
import type { LightningControllerView, LightningTvView } from '../server/views';

export const T0 = 1_000_000;

const kit = testKit(game, { t0: T0 });

/** Typed views: `game.tvView` is typed as the base envelope by `GameDefinition`. */
export function tv(state: State): LightningTvView {
  return tvView(state, game.manifest.id);
}

export function phone(state: State, playerId: string): LightningControllerView {
  return controllerView(state, game.manifest.id, playerId);
}

export const PLAYERS = [
  { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
  { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  { id: 'c', name: 'Cleo', avatarId: 'frog', connected: true },
];

export function start(
  settings: Record<string, number | string | boolean> = {},
  seed = 1,
  players = PLAYERS,
): State {
  return game.init({
    players,
    settings: { questions: 5, answerSeconds: 10, category: 'all', ...settings },
    seed,
    now: T0,
  });
}

export function current(state: State): NonNullable<ReturnType<typeof questionById>> {
  const q = questionById(state.questionIds[state.index] ?? '', state.contentLang);
  if (!q) throw new Error(`no question at index ${state.index}`);
  return q;
}

export const input = (state: State, playerId: string, value: Input, now: number): State =>
  kit.input(state, playerId, value, now);

/** Picks for `playerId` `ms` after the phase started; `correct` decides which choice. */
export function pick(state: State, playerId: string, correct: boolean, ms = 1000): State {
  const q = current(state);
  const index = correct ? q.answerIndex : (q.answerIndex + 1) % 4;
  return input(state, playerId, { type: 'pick', index }, state.phase.startedAt + ms);
}

export function wager(state: State, playerId: string, percent: WagerPercent, ms = 1000): State {
  return input(state, playerId, { type: 'wager', percent }, state.phase.startedAt + ms);
}

/** Fires the current phase's own timer at its deadline. */
export const timer = (state: State): State => kit.timer(state);

export const vip = (
  state: State,
  action: 'skip' | 'pause' | 'resume' | 'end',
  now?: number,
): State => kit.vip(state, action, now);

/** intro → first question. */
export function toFirstQuestion(state: State): State {
  return timer(state);
}

/**
 * Plays the current question: `answers` maps player id → correct?, missing players stay idle.
 * Ends in `reveal` (via all-answered or the deadline), then fires the reveal timer.
 */
export function playQuestion(
  state: State,
  answers: Record<string, boolean>,
  ms: Record<string, number> = {},
): State {
  let s = state;
  for (const [id, correct] of Object.entries(answers)) s = pick(s, id, correct, ms[id] ?? 1000);
  if (s.phase.id === 'question') s = timer(s);
  if (s.phase.id !== 'reveal') throw new Error(`expected reveal, got ${s.phase.id}`);
  return timer(s);
}

/** Plays every regular question with `answers`; ends in `wager`. */
export function toWager(state: State, answers: Record<string, boolean> = {}): State {
  let s = state.phase.id === 'intro' ? toFirstQuestion(state) : state;
  while (s.phase.id === 'question') s = playQuestion(s, answers);
  if (s.phase.id !== 'wager') throw new Error(`expected wager, got ${s.phase.id}`);
  return s;
}
