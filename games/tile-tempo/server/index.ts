// Tile Tempo is composed from the SDK's pause/player/VIP skeleton and four small phase reducers.
import { composeReduce, gameManifestSchema, pausedFor, seedRng } from '@partybox/game-sdk';
import type { GameDefinition, InitContext } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { sampleInput } from './bot';
import { makeSequence } from './content';
import { enterReady, reduceReady } from './phases/ready';
import { advancePlay, enterPlay, reducePlay, settle } from './phases/play';
import { enterScore, reduceScore } from './phases/score';
import { enterDone } from './phases/done';
import { results } from './scoring';
import { PHASES, inputSchema } from './types';
import type { Input, State } from './types';
import { controllerView, tvView } from './views';
import type { TileTempoControllerView, TileTempoTvView } from './views';
export type { TileTempoControllerView, TileTempoTvView } from './views';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const [sequence, rng] = makeSequence(seedRng(ctx.seed));
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const runs = Object.fromEntries(
    ctx.players.map((p) => [p.id, { tiles: 0, out: false, wrongColumn: null, lastAt: null }]),
  );
  return enterReady(
    {
      phase: { id: 'ready', startedAt: ctx.now, deadline: null },
      players,
      rng,
      sequence,
      runs,
      began: ctx.now,
      endsAt: ctx.now,
      elapsed: 0,
      phoneOnly: ctx.presence?.phoneOnly ?? false,
      botSkill: ctx.botSkill ?? 'normal',
    },
    ctx.now,
  );
}
function advance(state: State, now: number): State {
  switch (state.phase.id) {
    case 'ready':
      return enterPlay(state, now);
    case 'play':
      return advancePlay(state, now, enterScore);
    case 'score':
      return enterDone(state, now);
    default:
      return state;
  }
}
const reduce = composeReduce<State, Input>({
  phases: { ready: reduceReady, play: reducePlay, score: reduceScore },
  advance,
  skip: (s, now) => (s.phase.id === 'play' ? enterScore(settle(s, now), now) : advance(s, now)),
  end: (s, now) => enterDone(s.phase.id === 'play' ? settle(s, s.phase.paused?.at ?? now) : s, now),
  prepare: (s, event) => {
    if (
      event.type === 'vip' &&
      event.action === 'pause' &&
      s.phase.id === 'play' &&
      !s.phase.paused
    )
      return settle(s, event.now);
    if (event.type !== 'vip' || event.action !== 'resume' || s.phase.id !== 'play') return s;
    const ms = pausedFor(s, event.now);
    return ms <= 0
      ? s
      : {
          ...s,
          began: s.began + ms,
          endsAt: s.endsAt + ms,
          runs: Object.fromEntries(
            Object.entries(s.runs).map(([id, run]) => [
              id,
              { ...run, lastAt: run.lastAt === null ? null : run.lastAt + ms },
            ]),
          ),
        };
  },
});
export const game: GameDefinition<State, Input, TileTempoTvView, TileTempoControllerView> = {
  manifest,
  phases: PHASES,
  inputSchema,
  init,
  reduce,
  tvView,
  controllerView,
  results,
  bot: { sampleInput },
};
