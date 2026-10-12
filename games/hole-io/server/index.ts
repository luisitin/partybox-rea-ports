// Hole.io: pure city simulation, composed phase transitions, compact public views.
import {
  composeReduce,
  controllerEnvelope,
  envelope,
  gameManifestSchema,
  hasPlayer,
  onPlayerEvent,
  pausedFor,
  seedRng,
} from '@partybox/game-sdk';
import type { GameDefinition, InitContext, PlayerStatus } from '@partybox/game-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };
import { botInput } from './bot';
import { enterDone } from './phases/done';
import { advancePlay, reducePlay, settle } from './phases/play';
import { enterReveal, reduceReveal } from './phases/reveal';
import { results } from './scoring';
import { PHASES, ROUND_MS, SINK_MS, TICK_MS, inputSchema, isParticipating } from './types';
import type { CityView, HoleControllerView, HoleTvView, Input, State } from './types';
import { growthOf, isAlive, makeWorld, radiusOf, stopAll } from './world';

const manifest = gameManifestSchema.parse(manifestJson);
function init(ctx: InitContext): State {
  const players = Object.fromEntries(ctx.players.map((p) => [p.id, { ...p }]));
  const [world, rng] = makeWorld(seedRng(ctx.seed), Object.keys(players));
  return {
    phase: { id: 'play', startedAt: ctx.now, deadline: ctx.now + TICK_MS },
    rng,
    players,
    left: [],
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
    const connected = onPlayerEvent({ ...settled, left: settled.left ?? [] }, e);
    return {
      ...connected,
      world: {
        ...connected.world,
        holes: connected.world.holes.map((hole) =>
          hole.id === e.playerId
            ? {
                ...hole,
                dx: 0,
                dy: 0,
                ...(connected.left?.includes(e.playerId) ? { alive: false } : {}),
              }
            : hole,
        ),
      },
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
      alive: isAlive(h) && !s.left?.includes(h.id),
      growth: h.mass,
      ...growthOf(h.mass),
      eliminatedAt: h.eliminatedAt ?? null,
      eliminatedBy: h.eliminatedBy ?? null,
      connected: s.players[h.id]?.connected === true,
      left: s.left?.includes(h.id) === true,
      score: h.score,
      swallowed: h.swallowed,
      respawnIn: 0,
      shield: isAlive(h) && h.immuneUntil > s.world.elapsed,
      lastGain: isAlive(h) && s.world.elapsed - h.gainAt < 1000 ? h.lastGain : 0,
    })),
    props: s.world.props.filter((p) => p.availableAt <= s.world.elapsed),
    sinks: (s.world.sinks ?? []).filter((sink) => s.world.elapsed - sink.consumedAt < SINK_MS),
  };
}
const statusOf =
  (s: State) =>
  (id: string): PlayerStatus =>
    s.phase.id === 'play' && s.players[id]?.connected && isParticipating(s, id)
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
  const participating = isParticipating(s, id);
  const stage = s.phoneOnly || !participating || s.players[id]?.canSeeTv === false;
  return {
    ...controllerEnvelope(s, manifest.id, id, { statusOf: statusOf(s) }),
    deadline: s.phase.id === 'play' ? s.endsAt : s.phase.deadline,
    city,
    elapsed: s.world.elapsed,
    participating,
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
