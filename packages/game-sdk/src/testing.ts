// `@partybox/game-sdk/testing` — the contract suite's building blocks, for the sim, the e2e harness
// and the stress session, and each game's unit-test kit (`testKit`). Node-only (reads games/ from
// disk): a game's `__tests__` may import it, its server and client code never.
export { fuzzEvents, fuzzOnce } from './contract-tests/fuzz';
export { fnv1a, hashState, jsonSize, stableStringify } from './contract-tests/hash';
export { GAMES_DIR, REPO_ROOT, listGameIds, loadAllGames, loadGame } from './contract-tests/load';
export type { ContractConfig, LoadedGame } from './contract-tests/load';
export {
  T0,
  defaultSettingsOf,
  finishGame,
  makePlayers,
  playGame,
  replay,
} from './contract-tests/play';
export type { PlayOptions, PlayResult, PlayStrategy } from './contract-tests/play';
export { TEST_NAMES, testKit, testPlayers } from './contract-tests/kit';
export type { KitOptions, RosterOptions, StartOptions, TestKit } from './contract-tests/kit';
