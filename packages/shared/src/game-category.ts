/**
 * The picker's tabs (ADR-099, T-0699, owner 10-09): every game is in exactly one. Four tabs and All:
 * Classics (the games with a film), Jamboree (the Mario Party minigames, copies of Super Mario Party
 * Jamboree), Modes (Party World and its whole modes) and Arcade (ports of web games from REA
 * inspections: their own thing, not Jamboree apps; added 2026-10-10, T-1044). The labels are picker
 * strings in the client; the names are the owner's to approve (docs/games/catalog.md).
 */
export const GAME_CATEGORIES = ['classics', 'jamboree', 'modes', 'arcade'] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];
