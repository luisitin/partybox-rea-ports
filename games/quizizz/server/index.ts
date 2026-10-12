// Registry entry: independent phone questions, a public track, and a stepped podium.
import {
  boolSetting,
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  numberSetting,
  onPlayerEvent,
  pausedFor,
  recheckOnResume,
  seedRng,
  selectSetting,
} from '@partybox/game-sdk';
import type {
  ControllerView,
  GameDefinition,
  InitContext,
  PlayerStatus,
  TvView,
} from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { PACKS, chooseQuestions } from './content';
import { enterDone } from './phases/done';
import { advancePodium, enterPodium, reducePodium } from './phases/podium';
import { beatRace, raceComplete, rearmRaceBeat, reduceRace } from './phases/race';
import { results } from './scoring';
import { BEAT_MS, PHASES, inputSchema } from './types';
import type { Feedback, Input, Runner, State } from './types';

const manifest = gameManifestSchema.parse(manifestJson);
export interface Lane {
  id: string;
  colorSlot: number;
  name: string;
  avatarId: string;
  score: number;
  answered: number;
  correct: number;
  finished: boolean;
  connected: boolean;
  departed: boolean;
  frozen: boolean;
}
interface RaceView {
  total: number;
  packTitle: string;
  lanes: Lane[];
  podiumStep: number;
  powersEnabled: boolean;
}
export interface TriviaTvView extends TvView, RaceView {}
export interface TriviaControllerView extends ControllerView, RaceView {
  question: { id: string; prompt: string; options: string[]; index: number } | null;
  feedback: Feedback | null;
  answered: number;
  correct: number;
  score: number;
  streak: number;
  energy: number;
  double: boolean;
  freezeUntil: number;
  frozenBy: string | null;
  finished: boolean;
  departed: boolean;
  rank: number | null;
}

function init(ctx: InitContext): State {
  const pack = selectSetting(manifest, ctx.settings, 'pack');
  const questions = numberSetting(manifest, ctx.settings, 'questions');
  const seconds = numberSetting(manifest, ctx.settings, 'seconds');
  const powers = boolSetting(manifest, ctx.settings, 'powers');
  const [deck, rng] = chooseQuestions(pack, questions, seedRng(ctx.seed));
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const runners: Record<string, Runner> = Object.fromEntries(
    ctx.players.map((p) => [
      p.id,
      {
        answered: 0,
        correct: 0,
        score: 0,
        streak: 0,
        energy: 0,
        double: false,
        freezeUntil: 0,
        frozenBy: null,
        feedback: null,
      },
    ]),
  );
  return {
    phase: { id: 'race', startedAt: ctx.now, deadline: ctx.now + BEAT_MS },
    rng,
    players,
    runners,
    deck,
    cfg: { pack, questions, seconds, powers },
    began: ctx.now,
    endsAt: ctx.now + seconds * 1000,
    clock: ctx.now,
    podiumStep: 0,
    phoneOnly: ctx.presence?.phoneOnly === true,
    left: [],
  };
}
const closeIfDone = (state: State, now: number): State =>
  state.phase.id === 'race' && (now >= state.endsAt || raceComplete(state))
    ? enterPodium(state, now)
    : state;
function advance(state: State, now: number): State {
  if (state.phase.id === 'race') return beatRace(state, now, enterPodium);
  if (state.phase.id === 'podium') return advancePodium(state, now, enterDone);
  return state;
}
const reduce = composeReduce<State, Input>({
  phases: { race: reduceRace, podium: reducePodium },
  advance,
  skip: (state, now) => (state.phase.id === 'race' ? enterPodium(state, now) : advance(state, now)),
  end: enterDone,
  onPlayer: (state, event) => onPlayerEvent(state, event, { closeIfDone }),
  prepare: (state, event) => {
    if (event.type !== 'vip' || event.action !== 'resume' || state.phase.id !== 'race')
      return state;
    const ms = pausedFor(state, event.now);
    if (ms <= 0) return state;
    return {
      ...state,
      began: state.began + ms,
      endsAt: state.endsAt + ms,
      clock: event.now,
      runners: Object.fromEntries(
        Object.entries(state.runners).map(([id, r]) => [
          id,
          { ...r, freezeUntil: r.freezeUntil > 0 ? r.freezeUntil + ms : 0 },
        ]),
      ),
    };
  },
  afterVip: (_before, after, event) => rearmRaceBeat(recheckOnResume(after, event, closeIfDone)),
});
const statusOf =
  (state: State) =>
  (id: string): PlayerStatus =>
    state.left.includes(id) || state.phase.id !== 'race'
      ? 'waiting'
      : (state.runners[id]?.answered ?? 0) >= state.deck.length
        ? 'submitted'
        : 'active';
function common(state: State): RaceView {
  return {
    total: state.deck.length,
    packTitle: PACKS[state.cfg.pack]?.title ?? PACKS.general!.title,
    podiumStep: state.podiumStep,
    powersEnabled: state.cfg.powers,
    lanes: Object.values(state.players).map((p, slot) => {
      const r = state.runners[p.id]!;
      return {
        id: p.id,
        colorSlot: (slot % 8) + 1,
        name: p.name,
        avatarId: p.avatarId,
        score: r.score,
        answered: r.answered,
        correct: r.correct,
        finished: r.answered >= state.deck.length,
        connected: p.connected && !state.left.includes(p.id),
        departed: state.left.includes(p.id),
        frozen: state.phase.id === 'race' && r.freezeUntil > state.clock,
      };
    }),
  };
}
function tvView(state: State): TriviaTvView {
  return {
    ...envelope(state, manifest.id, { statusOf: statusOf(state) }),
    ...common(state),
    deadline: state.phase.id === 'race' ? state.endsAt : state.phase.deadline,
  };
}
function controllerView(state: State, id: string): TriviaControllerView {
  const player = hasPlayer(state, id);
  const r = player ? state.runners[id] : undefined;
  const departed = player && state.left.includes(id);
  const q =
    r && !departed && !r.feedback && r.answered < state.deck.length && state.phase.id === 'race'
      ? state.deck[r.answered]
      : undefined;
  const screen =
    state.phase.id === 'race'
      ? departed
        ? 'departed'
        : !r
          ? 'watch-race'
          : r.answered >= state.deck.length
            ? 'finished'
            : r.feedback
              ? `feedback-${r.answered}`
              : `question-${r.answered}`
      : state.phase.id === 'podium'
        ? `podium-${state.podiumStep}`
        : 'done';
  return {
    ...controllerEnvelope(state, manifest.id, id, { statusOf: statusOf(state), screen }),
    ...common(state),
    deadline: state.phase.id === 'race' ? state.endsAt : state.phase.deadline,
    question: q
      ? { id: q.id, prompt: q.prompt, options: [...q.options], index: r!.answered }
      : null,
    feedback: r?.feedback ? { ...r.feedback } : null,
    answered: r?.answered ?? 0,
    correct: r?.correct ?? 0,
    score: r?.score ?? 0,
    streak: r?.streak ?? 0,
    energy: r?.energy ?? 0,
    double: r?.double ?? false,
    freezeUntil: r?.freezeUntil ?? 0,
    frozenBy:
      r && !departed && state.phase.id === 'race' && r.freezeUntil > state.clock && r.frozenBy
        ? (state.players[r.frozenBy]?.name ?? null)
        : null,
    finished: r ? r.answered >= state.deck.length : false,
    departed,
    rank:
      r && state.phase.id !== 'race'
        ? 1 + Object.values(state.runners).filter((other) => other.score > r.score).length
        : null,
  };
}
export const game: GameDefinition<State, Input, TriviaTvView, TriviaControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: { sampleInput: botInput },
};
