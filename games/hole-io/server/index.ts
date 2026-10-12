// Hole Swallow: pure city simulation, composed phase transitions, compact public views.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  pausedFor,
  seedRng,
  setConnected,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, reducePlay, settle } from './phases/play';
import { enterReveal, reduceReveal } from './phases/reveal';
import { results } from './scoring';
import { PHASES, ROUND_MS, TICK_MS, inputSchema } from './types';
import type { CityView, HoleControllerView, HoleTvView, Input, State } from './types';
import { applyMove, makeWorld, radiusOf, stopAll } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const [world, rng] = makeWorld(seedRng(ctx.seed), Object.keys(players));
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    rng,
    players,
    began: ctx.now,
    endsAt: ctx.now + ROUND_MS,
    world,
    scores: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    phoneOnly: ctx.presence?.phoneOnly ?? false,
  };
}
const advance = (s: State, now: number): State =>
  s.phase.id === 'play'
    ? advancePlay(s, now, enterReveal)
    : s.phase.id === 'reveal'
      ? enterDone(s, now)
      : s;
const reduce = composeReduce<State, Input>({
  phases: { play: reducePlay, reveal: reduceReveal },
  advance,
  skip: (s, now) => (s.phase.id === 'play' ? enterReveal(settle(s, now), now) : advance(s, now)),
  end: (s, now) => enterDone(settle(s, now), now),
  prepare: (s, e) => {
    if (e.type !== 'vip' || s.phase.id !== 'play') return s;
    if (e.action === 'pause' && !s.phase.paused) {
      const settled = settle(s, e.now);
      return { ...settled, world: stopAll(settled.world) };
    }
    if (e.action === 'resume' && s.phase.paused) {
      const ms = pausedFor(s, e.now);
      return { ...s, began: s.began + ms, endsAt: s.endsAt + ms };
    }
    return s;
  },
  onPlayer: (s, e) => {
    if (!hasPlayer(s, e.playerId)) return s;
    const settled = settle(s, e.now);
    const connected = setConnected(settled, e);
    return {
      ...connected,
      world: applyMove(connected.world, e.playerId, { type: 'move', x: 0, y: 0 }),
    };
  },
});

function cityView(s: State): CityView {
  return {
    holes: s.world.holes.map((h) => ({
      id: h.id,
      slot: h.slot,
      x: h.x,
      y: h.y,
      radius: radiusOf(h.mass),
      score: h.score,
      swallowed: h.swallowed,
      respawnIn: h.respawnAt === null ? 0 : Math.max(0, h.respawnAt - s.world.elapsed),
      shield: h.immuneUntil > s.world.elapsed,
      lastGain: s.world.elapsed - h.gainAt < 1000 ? h.lastGain : 0,
    })),
    props: s.world.props.filter((p) => p.availableAt <= s.world.elapsed),
  };
}
const statusOf =
  (s: State) =>
  (id: string): PlayerStatus =>
    s.phase.id === 'play' &&
    s.players[id]?.connected &&
    s.world.holes.some((h) => h.id === id && h.respawnAt === null)
      ? 'active'
      : 'waiting';
function tvView(s: State): HoleTvView {
  return {
    ...envelope(s, manifest.id, { statusOf: statusOf(s) }),
    deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
    timerMode: 'hidden',
    city: cityView(s),
    elapsed: s.world.elapsed,
  };
}
function controllerView(s: State, id: string): HoleControllerView {
  const city = cityView(s);
  const mine = city.holes.find((h) => h.id === id) ?? null;
  const stage = s.phoneOnly || !hasPlayer(s, id) || s.players[id]?.canSeeTv === false;
  return {
    ...controllerEnvelope(s, manifest.id, id, { statusOf: statusOf(s) }),
    deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
    ...(stage ? { city } : {}),
    mine,
    scores: s.scores,
    slots: Object.fromEntries(city.holes.map((h) => [h.id, h.slot])),
    slot: mine?.slot ?? -1,
    stage,
    rank:
      mine && s.phase.id !== 'play'
        ? 1 + city.holes.filter((h) => h.score > mine.score).length
        : null,
  };
}
export const game: GameDefinition<State, Input, HoleTvView, HoleControllerView> = {
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
