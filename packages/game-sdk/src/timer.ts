// Phase + timer helpers for reducers (docs/GAME_CONTRACT.md "Timers are data"). All pure: they
// return new state and never touch the old one.
import type { GameEvent, GameStateBase, VipGameAction } from '@partybox/shared';

/** Enters a phase now; `durationMs = null` means no deadline (the phase must exit another way). */
export function enterPhase<S extends GameStateBase>(
  state: S,
  id: string,
  now: number,
  durationMs: number | null,
): S {
  return {
    ...state,
    phase: { id, startedAt: now, deadline: durationMs === null ? null : now + durationMs },
  };
}

/** True when a timer event belongs to the CURRENT phase instance (stale timers must be ignored). */
export function isTimerFor(state: GameStateBase, event: GameEvent<unknown>): boolean {
  return (
    event.type === 'timer' &&
    event.phaseId === state.phase.id &&
    event.startedAt === state.phase.startedAt
  );
}

/**
 * The next beat of the phase on stage (ADR-033, audit #14): the same phase instance — its id and
 * `startedAt` kept, so stale timers still miss — with a new `deadline`, which the engine fires as
 * the next beat. `step` sets which beat is on stage in the game's own state (a card's `land` →
 * `shown`); the views gate every secret of the later beat on it.
 */
export function nextStep<S extends GameStateBase>(
  state: S,
  deadline: number | null,
  step?: (state: S) => S,
): S {
  const stepped = step ? step(state) : state;
  return { ...stepped, phase: { ...stepped.phase, deadline } };
}

export function isPaused(state: GameStateBase): boolean {
  return state.phase.paused !== undefined;
}

/** How long the phase has been paused at `now` (0 while it runs): what a resume adds to the
 *  deadline, and what a game adds to clocks of its own (a secret pop time, a day's beats). */
export function pausedFor(state: GameStateBase, now: number): number {
  return state.phase.paused ? Math.max(0, now - state.phase.paused.at) : 0;
}

/** The keys of `T` that hold a timestamp (a number, or null / undefined while unset). */
export type ClockKey<T> = {
  [K in keyof T]-?: T[K] extends number | null | undefined ? K : never;
}[keyof T];

/** `clocks` with each named timestamp moved by `ms` (a resume's `pausedFor`); unset ones stay. */
export function shiftClocks<T extends object>(
  clocks: T,
  keys: readonly ClockKey<T>[],
  ms: number,
): T {
  const out = { ...clocks };
  for (const key of keys) {
    const at = out[key];
    if (typeof at === 'number') out[key] = (at + ms) as T[typeof key];
  }
  return out;
}

export interface PatienceNet {
  /** Someone is still at it (a human tapped, is picking a team): only then does the net wait. */
  busy: boolean;
  /** How far each re-arm reaches. */
  stepMs: number;
  /** The most the phase waits, from its start. */
  capMs: number;
}

/**
 * The hidden net under a phase that waits on people (audit #19: seating, a team pick, reading a
 * secret card), for its own timer: a room nobody is busy in moves on (null: call the phase's
 * `next`); otherwise the deadline re-arms `stepMs` on, never past `capMs` from the phase start,
 * and at the cap it moves on too. A forgotten phone can't hang the room; a slow one isn't rushed.
 */
export function patienceNet<S extends GameStateBase>(
  state: S,
  now: number,
  net: PatienceNet,
): S | null {
  if (!net.busy || now - state.phase.startedAt >= net.capMs) return null;
  const deadline = Math.min(now + net.stepMs, state.phase.startedAt + net.capMs);
  return { ...state, phase: { ...state.phase, deadline } };
}

/** Applies `player` events to `state.players[].connected`; other players are ignored. */
export function setConnected<S extends GameStateBase>(state: S, event: GameEvent<unknown>): S {
  if (event.type !== 'player' || !hasPlayer(state, event.playerId)) return state;
  const player = state.players[event.playerId];
  if (!player || player.connected === event.connected) return state;
  return {
    ...state,
    players: { ...state.players, [event.playerId]: { ...player, connected: event.connected } },
  };
}

export interface VipHandlers<S> {
  /** Advance past the current phase (what a deadline would do). */
  skip: (state: S, now: number) => S;
  /** Jump to the terminal phase so `results()` becomes non-null. */
  end: (state: S, now: number) => S;
}

/** Pause/resume shift the deadline; skip/end delegate to the game. Returns null for non-VIP events. */
export function applyVip<S extends GameStateBase>(
  state: S,
  event: GameEvent<unknown>,
  handlers: VipHandlers<S>,
): S | null {
  if (event.type !== 'vip') return null;
  const action: VipGameAction = event.action;
  const { phase } = state;
  switch (action) {
    case 'pause':
      if (phase.paused) return state;
      return { ...state, phase: { ...phase, paused: { at: event.now } } };
    case 'resume': {
      if (!phase.paused) return state;
      const shift = pausedFor(state, event.now);
      return {
        ...state,
        phase: {
          id: phase.id,
          startedAt: phase.startedAt,
          deadline: phase.deadline === null ? null : phase.deadline + shift,
          ...(phase.beatAt === undefined ? {} : { beatAt: phase.beatAt }),
        },
      };
    }
    case 'skip': {
      if (!phase.paused) return handlers.skip(state, event.now);
      const resumed = unpause(state, event.now);
      return beatNamed(handlers.skip(resumed, event.now), resumed, event.now);
    }
    case 'end':
      return handlers.end(state, event.now);
  }
}

/**
 * A skip while paused that moves the same instance on to a beat (nextStep: same id and startedAt, a new
 * deadline) names the beat by the skip's time, so the clocks read it as a new countdown and not as a
 * resume (ADR-101, T-0779 F6).
 */
function beatNamed<S extends GameStateBase>(next: S, resumed: S, now: number): S {
  const sameInstance =
    next.phase.id === resumed.phase.id && next.phase.startedAt === resumed.phase.startedAt;
  if (!sameInstance || next.phase.deadline === resumed.phase.deadline) return next;
  return { ...next, phase: { ...next.phase, beatAt: now } };
}

function unpause<S extends GameStateBase>(state: S, now: number): S {
  const resumed = applyVip(
    state,
    { type: 'vip', now, action: 'resume' },
    {
      skip: (s) => s,
      end: (s) => s,
    },
  );
  return resumed ?? state;
}

/** Ids of players who are connected (the usual "everyone submitted" denominator). */
export function connectedIds(state: GameStateBase): string[] {
  return Object.values(state.players)
    .filter((p) => p.connected)
    .map((p) => p.id);
}

/** True when every connected player id is in `done` (and at least one player is connected). */
export function allConnectedDone(state: GameStateBase, done: Iterable<string>): boolean {
  const set = new Set(done);
  const ids = connectedIds(state);
  return ids.length > 0 && ids.every((id) => set.has(id));
}

/**
 * True when `playerId` is one of the game's players. Use this instead of `state.players[id]`
 * truthiness: `state.players['__proto__']` is Object.prototype, which is truthy.
 */
export function hasPlayer(state: GameStateBase, playerId: string): boolean {
  return Object.hasOwn(state.players, playerId);
}

/** A `player` event: someone dropped, came back, or left for good (`gone`). */
export type PlayerEvent = Extract<GameEvent<unknown>, { type: 'player' }>;

export interface PlayerEventOptions<S> {
  /** Who goes on `left` when they leave for good (default: any of the game's players). */
  isIn?: (state: S, playerId: string) => boolean;
  /** The phase's "everyone it waits on is done" check (close it as if they had acted), run after
   *  a drop or a leave, never while paused and never on a reconnect. */
  closeIfDone?: (state: S, now: number) => S;
}

/**
 * The usual answer to a `player` event (audit #10): `connected` updated, a player who left for
 * good added once to `state.left` (in a game that keeps one), and — after a drop or a leave — the
 * phase closed if nobody it still waits on is left. A game with more to clear on a leave (a
 * volunteer, the sheep) does it on the result.
 */
export function onPlayerEvent<S extends GameStateBase & { left?: readonly string[] }>(
  state: S,
  event: PlayerEvent,
  { isIn = hasPlayer, closeIfDone }: PlayerEventOptions<S> = {},
): S {
  let after = setConnected(state, event);
  const left = after.left;
  if (event.gone && left && isIn(state, event.playerId) && !left.includes(event.playerId))
    after = { ...after, left: [...left, event.playerId] };
  if (event.connected || after.phase.paused || !closeIfDone) return after;
  return closeIfDone(after, event.now);
}

/**
 * After `applyVip`: a resume runs `closeIfDone` (a drop, or the last tap, during the pause must not
 * leave the phase to its timer); any other VIP result passes through.
 */
export function recheckOnResume<S extends GameStateBase>(
  vip: S,
  event: GameEvent<unknown>,
  closeIfDone: (state: S, now: number) => S,
): S {
  if (event.type !== 'vip' || event.action !== 'resume' || vip.phase.paused) return vip;
  return closeIfDone(vip, event.now);
}
