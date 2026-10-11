// ADR-087: the minigame stage machine, pure and total. card → howto (live demo) → countdown →
// play (the wrapped game) → finish → result → done. Time comes from `event.now` only; the host
// game keeps a `MinigameState`, forwards every engine event here, and sets its phase to `mg.phase`.
import type { AnyGameDefinition, GameEvent, PlayerInfo, Rng } from '@partybox/shared';
import { seedRng } from '@partybox/shared';
import { normalizeResult } from './result';
import { feed, initInner, innerDeadline, resultsOf, rngOver, timerFor } from './safe';
import type { MinigameInput, MinigameResult, MinigameStartArgs, MinigameState } from './types';

export const CARD_MS = 3000;
export const HOWTO_CAP_MS = 20000;
/** 3 · 2 · 1 at 0.8 s each, then "Go!" for 0.6 s (the bible's S17). */
export const COUNT_MS = 3000;
export const FINISH_MS = 1500;
export const RESULT_MS = 6000;
/** How often a cpu seat acts in play, plus up to BOT_JITTER_MS. */
export const BOT_STEP_MS = 450;
const BOT_JITTER_MS = 250;
/** A play that outlives its nominal length by this factor is ended (the game's `end`). */
export const CAP_FACTOR = 1.3;

const isBot = (p: PlayerInfo): boolean => p.bot === true;

export function minigameStart(game: AnyGameDefinition, a: MinigameStartArgs): MinigameState {
  const ids = a.players.map((p) => p.id);
  const teams =
    a.mode === 'ffa'
      ? []
      : (a.teams ?? (a.mode === 'duel' ? ids.slice(0, 2).map((id) => [id]) : [])).map((t) => [
          ...t,
        ]);
  const mg: MinigameState = {
    gameId: game.manifest.id,
    mode: a.mode,
    teams,
    players: a.players.map((p) => ({ ...p })),
    seed: a.seed >>> 0,
    skill: a.skill ?? 'normal',
    ...(a.contentLang ? { contentLang: a.contentLang } : {}),
    ...(a.presence ? { presence: a.presence } : {}),
    help: a.help,
    ...(a.lead && ids.includes(a.lead) ? { lead: a.lead } : {}),
    prize: a.prize ?? null,
    stage: 'card',
    stageEnds: a.now + CARD_MS,
    phase: { id: 'minigame', startedAt: a.now, deadline: a.now + CARD_MS },
    ready: [],
    inner: null,
    demo: null,
    demoTouched: false,
    playStartedAt: null,
    botAt: null,
    botRng: seedRng((a.seed ^ 0xb07) >>> 0),
    result: null,
    broken: !game.manifest.minigame,
  };
  return mg.broken ? ended(game, mg, a.now) : mg;
}

/** The engine phase to hold while the minigame runs: its `deadline` is the next thing due. */
export const minigamePhase = (mg: MinigameState): MinigameState['phase'] => mg.phase;
/** Same value as `minigamePhase(mg).deadline`: when the host must forward an event next. */
export const minigameNextWake = (mg: MinigameState): number | null => mg.phase.deadline;
/** Non-null once the result stage has been shown: pay the prize now. */
export const minigameResult = (mg: MinigameState): MinigameResult | null =>
  mg.stage === 'done' ? mg.result : null;

function ended(game: AnyGameDefinition, mg: MinigameState, now: number): MinigameState {
  const result = normalizeResult(
    { ...mg, sum: game.manifest.minigame?.teamScore === 'sum' },
    resultsOf(game, mg.inner),
  );
  return { ...mg, stage: 'finish', stageEnds: now + FINISH_MS, result, botAt: null, demo: null };
}

const allReady = (mg: MinigameState): boolean =>
  mg.players.every((p) => isBot(p) || !p.connected || mg.ready.includes(p.id));

function toHowto(game: AnyGameDefinition, mg: MinigameState, now: number): MinigameState {
  const demo = game.manifest.minigame?.practice
    ? initInner(game, mg, now, mg.seed ^ 0x9e3779b9)
    : null;
  const ready = mg.players.filter(isBot).map((p) => p.id);
  const botAt = demo ? now + BOT_STEP_MS : null;
  return {
    ...mg,
    stage: 'howto',
    stageEnds: now + HOWTO_CAP_MS,
    ready,
    demo,
    botAt,
    demoTouched: false,
  };
}

function toCountdown(mg: MinigameState, now: number): MinigameState {
  return { ...mg, stage: 'countdown', stageEnds: now + COUNT_MS, demo: null };
}

function toPlay(game: AnyGameDefinition, mg: MinigameState, at: number): MinigameState {
  const inner = initInner(game, mg, at, mg.seed);
  const sp = game.manifest.minigame;
  if (!inner || !sp) return ended(game, { ...mg, broken: true }, at);
  return {
    ...mg,
    stage: 'play',
    inner,
    playStartedAt: at,
    stageEnds: at + Math.round(sp.seconds * 1000 * CAP_FACTOR),
    botAt: at + BOT_STEP_MS,
  };
}

/** One round of cpu inputs. On the instruction screen the demo also plays for the humans until one taps. */
function botBeat(game: AnyGameDefinition, mg: MinigameState, now: number): MinigameState {
  const rng: Rng = rngOver(mg.botRng);
  const inDemo = mg.stage === 'howto';
  let inner = inDemo ? mg.demo : mg.inner;
  const seats = inDemo && !mg.demoTouched ? mg.players : mg.players.filter(isBot);
  for (const p of seats) {
    let input: unknown = null;
    try {
      input = game.bot.sampleInput(inner, p.id, rng, mg.skill);
    } catch {
      input = null;
    }
    if (input !== null && input !== undefined)
      inner = feed(game, inner, { type: 'input', now, playerId: p.id, input });
  }
  const botAt = now + BOT_STEP_MS + rng.int(0, BOT_JITTER_MS);
  return { ...mg, [inDemo ? 'demo' : 'inner']: inner, botAt, botRng: rng.state() };
}

const due = (t: number | null, now: number): boolean => t !== null && now >= t;

/** One thing that is due at `now`, or null when nothing is. */
function step(game: AnyGameDefinition, mg: MinigameState, now: number): MinigameState | null {
  switch (mg.stage) {
    case 'card':
      if (!due(mg.stageEnds, now)) return null;
      return mg.help ? toHowto(game, mg, now) : toCountdown(mg, now);
    case 'howto': {
      if (allReady(mg) || due(mg.stageEnds, now)) return toCountdown(mg, now);
      if (mg.demo && due(mg.botAt, now)) return botBeat(game, mg, now);
      const dd = innerDeadline(mg.demo);
      if (dd === null || now < dd) return null;
      const next = feed(game, mg.demo, timerFor(mg.demo, now));
      const over = resultsOf(game, next) !== null;
      return { ...mg, demo: over ? initInner(game, mg, now, mg.seed ^ 0x9e3779b9 ^ now) : next };
    }
    case 'countdown':
      return due(mg.stageEnds, now) ? toPlay(game, mg, mg.stageEnds ?? now) : null;
    case 'play': {
      if (resultsOf(game, mg.inner)) return ended(game, mg, now);
      if (due(mg.botAt, now)) return botBeat(game, mg, now);
      const d = innerDeadline(mg.inner);
      if (d !== null && now >= d)
        return { ...mg, inner: feed(game, mg.inner, timerFor(mg.inner, now)) };
      if (!due(mg.stageEnds, now)) return null;
      const inner = feed(game, mg.inner, { type: 'vip', now, action: 'end' });
      return ended(game, { ...mg, inner }, now);
    }
    case 'finish':
      return due(mg.stageEnds, now) ? { ...mg, stage: 'result', stageEnds: now + RESULT_MS } : null;
    case 'result':
      return due(mg.stageEnds, now) ? { ...mg, stage: 'done', stageEnds: null } : null;
    default:
      return null;
  }
}

/** Runs everything due at `now` (a stage can chain into the next). */
function settle(game: AnyGameDefinition, start: MinigameState, now: number): MinigameState {
  let mg = start;
  for (let i = 0; i < 24; i++) {
    const next = step(game, mg, now);
    if (!next) break;
    mg = next;
  }
  return mg;
}

function wake(mg: MinigameState): number | null {
  // Paused, the deadline holds where the pause found it: a paused phase never fires (the runner),
  // and the resume moves it on (T-0779 F7).
  if (mg.phase.paused) return mg.phase.deadline;
  if (mg.stage === 'done') return null;
  const times = [mg.stageEnds, mg.stage === 'play' || mg.stage === 'howto' ? mg.botAt : null];
  if (mg.stage === 'play') times.push(innerDeadline(mg.inner));
  if (mg.stage === 'howto') times.push(innerDeadline(mg.demo));
  const live = times.filter((t): t is number => t !== null);
  return live.length ? Math.min(...live) : null;
}

/**
 * A new phase instance whenever the next wake changes (or when forced), so the engine re-arms. A VIP
 * pause or resume holds the instance (`holds`): the same minigame, its deadline moved (ADR-101).
 */
function rephase(mg: MinigameState, now: number, force: boolean, holds = false): MinigameState {
  const deadline = wake(mg);
  if (!force && deadline === mg.phase.deadline) return mg;
  // A new identity only when the old one is spent (its timer fired) or time moved on; two events in one ms share it.
  const prev = mg.phase;
  const spent = prev.deadline !== null && prev.deadline <= now;
  const moved = now > prev.startedAt ? now : spent ? prev.startedAt + 1 : prev.startedAt;
  const startedAt = holds ? prev.startedAt : moved;
  return {
    ...mg,
    phase: {
      id: 'minigame',
      startedAt,
      deadline,
      ...(mg.phase.paused ? { paused: mg.phase.paused } : {}),
    },
  };
}

function onInput(
  game: AnyGameDefinition,
  mg: MinigameState,
  e: Extract<GameEvent<MinigameInput>, { type: 'input' }>,
): MinigameState {
  const inp = e.input;
  if (!inp || typeof inp !== 'object' || !mg.players.some((p) => p.id === e.playerId)) return mg;
  if (inp.mg === 'ready')
    return mg.stage === 'howto' && !mg.ready.includes(e.playerId)
      ? { ...mg, ready: [...mg.ready, e.playerId] }
      : mg;
  if (inp.mg !== 'input') return mg;
  const ev = { type: 'input' as const, now: e.now, playerId: e.playerId, input: inp.input };
  if (mg.stage === 'play') return { ...mg, inner: feed(game, mg.inner, ev) };
  if (mg.stage === 'howto' && mg.demo)
    return { ...mg, demo: feed(game, mg.demo, ev), demoTouched: true };
  return mg;
}

function onVip(
  game: AnyGameDefinition,
  mg: MinigameState,
  e: Extract<GameEvent<unknown>, { type: 'vip' }>,
): MinigameState {
  const live = mg.stage === 'play' ? 'inner' : mg.stage === 'howto' && mg.demo ? 'demo' : null;
  const fwd = (m: MinigameState): MinigameState =>
    live ? { ...m, [live]: feed(game, m[live], e) } : m;
  const at = mg.phase.paused?.at;
  if (e.action === 'pause' && at === undefined)
    return fwd({ ...mg, phase: { ...mg.phase, paused: { at: e.now } } });
  if (e.action === 'resume' && at !== undefined) {
    const by = Math.max(0, e.now - at);
    // The play clock reads playStartedAt (views.ts): it moves with the other clocks (T-0948).
    const shifted = {
      ...mg,
      playStartedAt: mg.playStartedAt === null ? null : mg.playStartedAt + by,
      stageEnds: mg.stageEnds === null ? null : mg.stageEnds + by,
      botAt: mg.botAt === null ? null : mg.botAt + by,
    };
    const { paused: _gone, ...phase } = mg.phase;
    return fwd({ ...shifted, phase });
  }
  if (at !== undefined) return mg;
  if (e.action === 'skip' && mg.stage === 'play') return fwd(mg);
  if (e.action === 'skip') return { ...mg, stageEnds: e.now, ready: mg.players.map((p) => p.id) };
  if (e.action === 'end')
    return mg.stage === 'play' ? fwd({ ...mg, stageEnds: e.now }) : ended(game, mg, e.now);
  return mg;
}

function onPlayer(
  game: AnyGameDefinition,
  mg: MinigameState,
  e: Extract<GameEvent<unknown>, { type: 'player' }>,
): MinigameState {
  if (typeof e.playerId !== 'string' || typeof e.connected !== 'boolean') return mg;
  const players = mg.players.map((p) =>
    p.id === e.playerId ? { ...p, connected: e.connected } : p,
  );
  const next = { ...mg, players };
  if (mg.stage === 'play') return { ...next, inner: feed(game, mg.inner, e) };
  return mg.stage === 'howto' && mg.demo ? { ...next, demo: feed(game, mg.demo, e) } : next;
}

/** Forward every engine event here while the minigame runs. Pure, total; never throws. */
export function minigameReduce(
  game: AnyGameDefinition,
  mg: MinigameState,
  event: GameEvent<MinigameInput>,
): MinigameState {
  if (!event || typeof event !== 'object' || !Number.isFinite(event.now) || mg.stage === 'done')
    return mg;
  const paused = mg.phase.paused !== undefined;
  let next = mg;
  if (event.type === 'input') next = paused ? mg : onInput(game, mg, event);
  else if (event.type === 'player') next = onPlayer(game, mg, event);
  else if (event.type === 'vip') next = onVip(game, mg, event);
  else if (event.type === 'speech' || event.type === 'speechStart')
    next = !paused && mg.stage === 'play' ? { ...mg, inner: feed(game, mg.inner, event) } : mg;
  const holds = event.type === 'vip' && (event.action === 'pause' || event.action === 'resume');
  if (!(event.type === 'vip' && event.action === 'resume') && next.phase.paused)
    return rephase(next, event.now, false, holds);
  return rephase(settle(game, next, event.now), event.now, event.type === 'timer', holds);
}
