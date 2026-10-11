// A game's unit-test kit (D-010 wave 1, audit row 22): the event builders every game's
// `__tests__/helpers.ts` wrote for itself — start a room, send an input, fire the phase's timer,
// VIP actions, drops, readings, walk to a phase — bound to one GameDefinition. Each game keeps its
// own defaults (when an input lands, which settings a test room starts with) as options, so its
// tests read the same. Pure; tests only.
import type {
  ControllerView,
  GameDefinition,
  GameEvent,
  GamePresence,
  GameStateBase,
  PlayerInfo,
  Settings,
  TvView,
  VipGameAction,
} from '@partybox/shared';
import { AVATAR_IDS } from '@partybox/shared';

export const TEST_NAMES = 'Ana Ben Cy Dee Eli Fay Gus Hal Ivy Jo Kai Lu Max Nia Oz Pia'.split(' ');

export interface RosterOptions {
  /** Names in seat order (default TEST_NAMES). */
  names?: readonly string[];
  /** A seat's id: 'name' = the name in lower case ('ana'), 'seat' = p1, p2… (default 'seat'). */
  ids?: 'name' | 'seat';
  /** The last `bots` seats are bots. */
  bots?: number;
  /** A seat's avatar (default: the SDK's faces in order). */
  avatar?: (seat: number) => string;
}

/** `n` connected players, as a test room seats them. */
export function testPlayers(n: number, options: RosterOptions = {}): PlayerInfo[] {
  const names = options.names ?? TEST_NAMES;
  const bots = options.bots ?? 0;
  return Array.from({ length: n }, (_, i) => {
    const name = names[i % names.length] ?? `P${i + 1}`;
    const p: PlayerInfo = {
      id: options.ids === 'name' ? name.toLowerCase() : `p${i + 1}`,
      name,
      avatarId: options.avatar?.(i) ?? (AVATAR_IDS[i % AVATAR_IDS.length] as string),
      connected: true,
    };
    return i >= n - bots ? { ...p, bot: true } : p;
  });
}

export interface KitOptions {
  /** The clock at init (default 1_000_000). */
  t0?: number;
  /** The room `start` seats when a test names no players. */
  players?: readonly PlayerInfo[];
  /** Settings every test room starts from (a test's own override them). */
  settings?: Settings;
  seed?: number;
  /** When an input lands, in ms after its phase began (default 500). */
  inputAt?: number;
  /** When a VIP action lands (default: `inputAt`). */
  vipAt?: number;
  /** When a drop or a return lands (default: `inputAt`). */
  playerAt?: number;
  /** When a reading's length arrives (default 100). */
  speechAt?: number;
  /** A timer on a phase with no deadline fires this long after it began (default 0). */
  untimedAt?: number;
}

export interface StartOptions {
  players?: readonly PlayerInfo[];
  settings?: Settings;
  seed?: number;
  presence?: GamePresence;
}

export interface TestKit<S extends GameStateBase, I, TV extends TvView, CV extends ControllerView> {
  readonly t0: number;
  start(options?: StartOptions): S;
  reduce(state: S, event: GameEvent<I>): S;
  /** The current phase's own timer, at its deadline (or `now`). */
  timer(state: S, now?: number): S;
  input(state: S, playerId: string, input: I, now?: number, vip?: boolean): S;
  vip(state: S, action: VipGameAction, now?: number): S;
  /** A drop (`connected` false) or a return; `gone` for good ('left' | 'kicked'). */
  player(state: S, playerId: string, connected: boolean, gone?: 'left' | 'kicked', now?: number): S;
  /** The host's answer to a reading: its length in ms (-1 = could not be made). */
  speech(state: S, key: string, ms: number, now?: number): S;
  /** Fires timers until the phase is `phaseId`; throws when it never gets there. */
  until(state: S, phaseId: string, max?: number): S;
  /** Fires timers until the phase changes (its beats and steps included). */
  finish(state: S, max?: number): S;
  tv(state: S): TV;
  cv(state: S, playerId: string): CV;
}

export function testKit<
  S extends GameStateBase,
  I,
  TV extends TvView = TvView,
  CV extends ControllerView = ControllerView,
>(game: GameDefinition<S, I, TV, CV>, options: KitOptions = {}): TestKit<S, I, TV, CV> {
  const t0 = options.t0 ?? 1_000_000;
  const inputAt = options.inputAt ?? 500;
  const vipAt = options.vipAt ?? inputAt;
  const playerAt = options.playerAt ?? inputAt;
  const speechAt = options.speechAt ?? 100;
  const untimedAt = options.untimedAt ?? 0;
  const reduce = (state: S, event: GameEvent<I>): S => game.reduce(state, event);
  const timer = (state: S, now?: number): S =>
    reduce(state, {
      type: 'timer',
      now: now ?? state.phase.deadline ?? state.phase.startedAt + untimedAt,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
  return {
    t0,
    start: (o = {}) =>
      game.init({
        players: [...(o.players ?? options.players ?? testPlayers(4))],
        settings: { ...options.settings, ...o.settings },
        seed: o.seed ?? options.seed ?? 1,
        now: t0,
        ...(o.presence ? { presence: o.presence } : {}),
      }),
    reduce,
    timer,
    input: (state, playerId, input, now, vip) =>
      reduce(state, {
        type: 'input',
        now: now ?? state.phase.startedAt + inputAt,
        playerId,
        input,
        ...(vip ? { vip: true } : {}),
      }),
    vip: (state, action, now) =>
      reduce(state, { type: 'vip', now: now ?? state.phase.startedAt + vipAt, action }),
    player: (state, playerId, connected, gone, now) =>
      reduce(state, {
        type: 'player',
        now: now ?? state.phase.startedAt + playerAt,
        playerId,
        connected,
        ...(gone ? { gone } : {}),
      }),
    speech: (state, key, ms, now) =>
      reduce(state, { type: 'speech', now: now ?? state.phase.startedAt + speechAt, key, ms }),
    until: (state, phaseId, max = 200) => {
      let s = state;
      for (let i = 0; i < max && s.phase.id !== phaseId; i++) s = timer(s);
      if (s.phase.id !== phaseId) throw new Error(`never reached ${phaseId} (at ${s.phase.id})`);
      return s;
    },
    finish: (state, max = 50) => {
      let s = state;
      for (let i = 0; i < max && s.phase.id === state.phase.id; i++) s = timer(s);
      return s;
    },
    tv: (state) => game.tvView(state),
    cv: (state, playerId) => game.controllerView(state, playerId),
  };
}
