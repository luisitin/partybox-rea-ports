// ADR-087: choosing a minigame for a board's teams. The SDK never imports the registry (games
// import the SDK), so the host passes the definitions in.
import type {
  AnyGameDefinition,
  MinigameCategory,
  MinigameMode,
  Rng,
  SpeechRequest,
} from '@partybox/shared';
import { MINIGAME_MODES } from '@partybox/shared';
import type { MinigameState } from './types';

/** The mode a board's sides play as: 1+1 a duel, 2+2 a 2v2, 1+3 a 1v3, anything else free-for-all. */
export function minigameModeFor(teams: readonly (readonly string[])[]): MinigameMode {
  const sizes = teams.map((t) => t.length).sort((a, b) => a - b);
  if (sizes.length !== 2) return 'ffa';
  const [lo, hi] = sizes;
  if (lo === 1 && hi === 1) return 'duel';
  if (lo === 2 && hi === 2) return '2v2';
  if (lo === 1 && hi === 3) return '1v3';
  return 'ffa';
}

/** Can this game run in this mode with this many players (its manifest's modes and player range)? */
export function minigameSupports(
  game: AnyGameDefinition,
  mode: MinigameMode,
  players: number,
): boolean {
  const m = game.manifest;
  return (
    !!m.minigame &&
    m.minigame.modes.includes(mode) &&
    players >= m.minPlayers &&
    players <= m.maxPlayers
  );
}

/** Every game that can run as a minigame in this mode for this many players, in the order given. Categorised
 *  games (`minigame.category`: boss, duel, coin, showdown, survivathon, rhythm, mouse, bowser-live, kaboom-squad) are left out unless `category` asks for them, and then only they come. */
export function minigameGames(
  games: readonly AnyGameDefinition[],
  mode: MinigameMode,
  players: number,
  category?: MinigameCategory,
): AnyGameDefinition[] {
  return games.filter(
    (g) => minigameSupports(g, mode, players) && g.manifest.minigame?.category === category,
  );
}

/** One game for the board, never `avoid` (the last one played) unless it is the only choice. */
export function pickMinigame(
  games: readonly AnyGameDefinition[],
  mode: MinigameMode,
  players: number,
  rng: Rng,
  avoid?: string,
): AnyGameDefinition | null {
  const all = minigameGames(games, mode, players);
  const fresh = all.filter((g) => g.manifest.id !== avoid);
  const from = fresh.length ? fresh : all;
  return from.length ? rng.pick(from) : null;
}

/** The modes a game lists, in contract order (for docs and the preview). */
export const minigameModesOf = (game: AnyGameDefinition): MinigameMode[] =>
  MINIGAME_MODES.filter((m) => game.manifest.minigame?.modes.includes(m));

/** The readings the wrapped game wants while the minigame plays; the host's `speech` events come
 *  back through `minigameReduce`. Empty outside play, and for a game without a voice. */
export function minigameSpeech(
  game: AnyGameDefinition,
  mg: MinigameState,
): readonly SpeechRequest[] {
  if (mg.stage !== 'play' || !mg.inner || !game.speech) return [];
  try {
    return game.speech(mg.inner);
  } catch {
    return [];
  }
}
