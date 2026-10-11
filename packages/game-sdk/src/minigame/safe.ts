// ADR-087: the calls into the wrapped game, each guarded: a game that throws leaves its state alone.
import type {
  AnyGameDefinition,
  GameEvent,
  GameResults,
  GameStateBase,
  InitContext,
  Rng,
  RngState,
  Settings,
} from '@partybox/shared';
import { nextFloat, nextInt, pick, shuffle } from '@partybox/shared';
import type { MinigameState } from './types';

/** The game's settings as a minigame: its defaults, then `manifest.minigame.settings`. */
export function minigameSettings(game: AnyGameDefinition): Settings {
  const out: Settings = {};
  for (const spec of game.manifest.settings) out[spec.key] = spec.default;
  return { ...out, ...(game.manifest.minigame?.settings ?? {}) };
}

/** A fresh game (or demo) for this minigame, or null if `init` threw. */
export function initInner(
  game: AnyGameDefinition,
  mg: MinigameState,
  now: number,
  seed: number,
): unknown {
  const sp = game.manifest.minigame;
  if (!sp) return null;
  const ctx: InitContext = {
    players: mg.players,
    settings: minigameSettings(game),
    seed,
    now,
    ...(mg.presence ? { presence: mg.presence } : {}),
    ...(mg.contentLang ? { contentLang: mg.contentLang } : {}),
    minigame: {
      mode: mg.mode,
      teams: mg.teams,
      seconds: sp.seconds,
      ...(mg.lead ? { lead: mg.lead } : {}),
    },
  };
  try {
    return game.init(ctx);
  } catch {
    return null;
  }
}

export function feed(game: AnyGameDefinition, state: unknown, event: GameEvent<unknown>): unknown {
  if (!state) return state;
  try {
    return game.reduce(state, event) ?? state;
  } catch {
    return state;
  }
}

export function resultsOf(game: AnyGameDefinition, state: unknown): GameResults | null {
  if (!state) return null;
  try {
    return game.results(state) ?? null;
  } catch {
    return null;
  }
}

export function phaseOf(state: unknown): GameStateBase['phase'] | null {
  const p = (state as GameStateBase | null)?.phase;
  return p && typeof p === 'object' ? p : null;
}

/** The deadline a game's timer event is due at: set, not paused. */
export function innerDeadline(state: unknown): number | null {
  const p = phaseOf(state);
  return p && !p.paused ? p.deadline : null;
}

/** The game's timer event for its current phase instance (what the engine would send it). */
export function timerFor(state: unknown, now: number): GameEvent<unknown> {
  const p = phaseOf(state);
  return { type: 'timer', now, phaseId: p?.id ?? '', startedAt: p?.startedAt ?? 0 };
}

/** A mutable Rng over a state held in JSON; read `state()` back afterwards. */
export function rngOver(start: RngState): Rng {
  let s = start;
  const rng: Rng = {
    float: () => {
      const [v, n] = nextFloat(s);
      s = n;
      return v;
    },
    int: (min, max) => {
      const [v, n] = nextInt(s, min, max);
      s = n;
      return v;
    },
    pick: (items) => {
      const [v, n] = pick(s, items);
      s = n;
      return v;
    },
    shuffle: (items) => {
      const [v, n] = shuffle(s, items);
      s = n;
      return v;
    },
    chance: (p) => rng.float() < p,
    state: () => s,
  };
  return rng;
}
