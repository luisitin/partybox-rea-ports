// A minimal headless runner that drives a GameDefinition the way the engine does: inputs from
// bots, one timer per deadline (ADR-033), optional VIP skips. Used by the contract suite; the sim
// package builds its richer strategies on top of it.
import type {
  AnyGameDefinition,
  GameEvent,
  GamePresence,
  GameResults,
  GameStateBase,
  InitContext,
  PlayerInfo,
  Settings,
} from '@partybox/shared';
import { AVATAR_IDS, createRng } from '@partybox/shared';

export type PlayStrategy = 'random' | 'fast' | 'idle' | 'skipper';

export interface PlayOptions {
  players: number;
  seed: number;
  strategy: PlayStrategy;
  settings?: Settings;
  /** ADR-047: where everyone is (absent: a host from before presence), and how many of the last
   *  seats can't see the TV. */
  presence?: GamePresence;
  remote?: number;
  /** Simulated wall-clock budget; the run stops (stuck=true) when exceeded. */
  maxSimMs: number;
  /** Hard cap on events, independent of simulated time. */
  maxEvents?: number;
  onEvent?: (event: GameEvent<unknown>, state: GameStateBase) => void;
}

export interface PlayResult {
  init: InitContext;
  events: GameEvent<unknown>[];
  finalState: GameStateBase;
  results: GameResults | null;
  simMs: number;
  stuck: boolean;
  invalidInputs: string[];
}

export const T0 = 1_700_000_000_000;

/** Refusals in a row at a phase's last moment after which its inputs stop and its timer fires. */
const MAX_LATE_REFUSALS = 50;

export function makePlayers(n: number): PlayerInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    avatarId: AVATAR_IDS[i % AVATAR_IDS.length] as string,
    connected: true,
  }));
}

export function defaultSettingsOf(game: AnyGameDefinition, overrides: Settings = {}): Settings {
  const out: Settings = {};
  for (const spec of game.manifest.settings) out[spec.key] = spec.default;
  return { ...out, ...overrides };
}

function phaseKey(state: GameStateBase): string {
  return `${state.phase.id}:${state.phase.startedAt}`;
}

export function playGame(game: AnyGameDefinition, options: PlayOptions): PlayResult {
  const rng = createRng(options.seed);
  const remote = options.remote ?? 0;
  const players = makePlayers(options.players).map((p, i) =>
    options.presence ? { ...p, canSeeTv: i < options.players - remote } : p,
  );
  const settings = defaultSettingsOf(game, options.settings);
  const init: InitContext = {
    players,
    settings,
    seed: options.seed,
    now: T0,
    ...(options.presence ? { presence: options.presence } : {}),
  };
  let state: GameStateBase = game.init(init);
  let now = T0;
  const events: GameEvent<unknown>[] = [];
  const invalidInputs: string[] = [];
  const maxEvents = options.maxEvents ?? 5000;
  let firedFor: string | null = null;
  let stuck = false;
  // Refusals in a row at the last moment of one phase (see MAX_LATE_REFUSALS).
  let refusedPhase = '';
  let refused = 0;

  const apply = (event: GameEvent<unknown>): void => {
    state = game.reduce(state, event);
    events.push(event);
    options.onEvent?.(event, state);
  };

  const fireTimerIfDue = (): boolean => {
    const { deadline } = state.phase;
    if (deadline === null || state.phase.paused || firedFor === phaseKey(state)) return false;
    if (now < deadline) return false;
    const key = phaseKey(state);
    firedFor = key;
    apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
    // ADR-033: staying in the phase with a later deadline is a second beat, and it fires too.
    if (phaseKey(state) === key && state.phase.deadline !== null && state.phase.deadline > deadline)
      firedFor = null;
    return true;
  };

  while (game.results(state) === null) {
    if (events.length >= maxEvents || now - T0 > options.maxSimMs) {
      stuck = true;
      break;
    }
    let acted = false;
    if (options.strategy !== 'idle') {
      for (const player of rng.shuffle(players)) {
        if (game.results(state) !== null) break;
        const before = phaseKey(state);
        if (before !== refusedPhase) {
          refusedPhase = before;
          refused = 0;
        }
        const input = game.bot.sampleInput(state, player.id, rng);
        if (input === null) continue;
        const parsed = game.inputSchema.safeParse(input);
        if (!parsed.success) {
          invalidInputs.push(`${state.phase.id}/${player.id}: ${JSON.stringify(input)}`);
          continue;
        }
        const delta = options.strategy === 'fast' ? 100 : rng.int(200, 2500);
        const deadline = state.phase.deadline;
        // Inputs that would land at or after the deadline are pinned to the last ms before it. A
        // refusal there repeats at that instant, so after MAX_LATE_REFUSALS in a row the phase
        // takes no more inputs and its timer fires.
        const late = deadline !== null && now + delta >= deadline;
        if (late && refused >= MAX_LATE_REFUSALS) break;
        now = late && deadline !== null ? Math.max(now, deadline - 1) : now + delta;
        const prior = state;
        apply({ type: 'input', now, playerId: player.id, input: parsed.data });
        acted = true;
        if (state !== prior) refused = 0;
        else if (late) refused += 1;
        if (phaseKey(state) !== before) break; // phase moved on; re-sample everyone
      }
    }
    if (game.results(state) !== null) break;
    if (acted) continue;
    // Nobody can act: advance time to the deadline or skip.
    const { deadline } = state.phase;
    if (deadline !== null && !state.phase.paused && firedFor !== phaseKey(state)) {
      now = Math.max(now, deadline);
      fireTimerIfDue();
      continue;
    }
    if (options.strategy === 'skipper') {
      now += 1000;
      apply({ type: 'vip', now, action: 'skip' });
      continue;
    }
    stuck = true;
    break;
  }

  return {
    init,
    events,
    finalState: state,
    results: game.results(state),
    simMs: now - T0,
    stuck,
    invalidInputs,
  };
}

/** Re-applies a recorded event list from the same init; returns every intermediate state. */
export function replay(
  game: AnyGameDefinition,
  init: PlayResult['init'],
  events: GameEvent<unknown>[],
): GameStateBase[] {
  let state: GameStateBase = game.init(init);
  const states: GameStateBase[] = [state];
  for (const event of events) {
    state = game.reduce(state, event);
    states.push(state);
  }
  return states;
}

/**
 * Drives a state to the end with nobody playing: each phase's timer fires at its deadline, and a
 * phase without one (or paused) is VIP-skipped a minute in. Returns the terminal state, or null
 * when the game neither ends nor moves within `maxSteps`. Fixture continuity (T-0207) uses it:
 * the done fixture is the late scores fixture played forward, so the two tell one game.
 */
export function finishGame(
  game: AnyGameDefinition,
  from: GameStateBase,
  maxSteps = 500,
): GameStateBase | null {
  let state = from;
  for (let i = 0; i < maxSteps && game.results(state) === null; i++) {
    const { phase } = state;
    const event: GameEvent<unknown> =
      phase.deadline !== null && !phase.paused
        ? { type: 'timer', now: phase.deadline, phaseId: phase.id, startedAt: phase.startedAt }
        : { type: 'vip', now: phase.startedAt + 60_000, action: 'skip' };
    const next = game.reduce(state, event);
    if (next === state) return null;
    state = next;
  }
  return game.results(state) === null ? null : state;
}
