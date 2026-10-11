// `@partybox/game-sdk/match` — the shared answer matcher (game pack Part 00 §4, ADR-048).
// Pure and deterministic on every machine (no Intl, no toLocale*), so a game server may call it
// inside `reduce`. Free of zod and React on purpose: a phone runs `isLegalClue` as the player
// types, and this entry must not pull the schemas into its download. The pack schema and
// `checkAnswerPack` live in `@partybox/game-sdk` (server, tests) for that reason.
export { fuzzAllowance, groupAnswers, matchAnswer, sameAnswer } from './match/answer';
export { CLUE_MAX_CHARS, isLegalClue } from './match/clue';
export type { ClueOptions, ClueReason, ClueVerdict } from './match/clue';
export { normalize } from './match/normalize';
export type { Normalized } from './match/normalize';
export { stem } from './match/stem';
export type { MatchItem, MatchLang, MatchLevel } from './match/types';
