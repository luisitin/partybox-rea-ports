// ADR-088: the games a board can run as minigames. A game imports only the SDK, and the server may
// import only shared and engine, so the list lives here: the host (server boot, the sim) fills it once
// and it is sealed. Reads give the same list for a whole process, so `reduce` stays deterministic; a
// second fill is ignored; an unfilled registry is empty, so a board falls back to its own placeholder
// (the contract tests run with it empty).
import type { AnyGameDefinition } from './contract';

let games: readonly AnyGameDefinition[] | null = null;

/** Seals the games that declare `manifest.minigame`, in the order given. Returns false once sealed. */
export function registerMinigames(all: readonly AnyGameDefinition[]): boolean {
  if (games) return false;
  games = Object.freeze(all.filter((g) => !!g.manifest.minigame));
  return true;
}

/** Every game that can run as a minigame; empty until the host registers. */
export const registeredMinigames = (): readonly AnyGameDefinition[] => games ?? [];

/** Tests only: unseal. */
export function resetMinigamesForTests(): void {
  games = null;
}
