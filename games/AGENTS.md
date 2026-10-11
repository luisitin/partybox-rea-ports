# games — local rules

- To add a game: `docs/ADDING_A_GAME.md`. To understand the interface: `docs/GAME_CONTRACT.md`.
- Each game's `README.md` is its spec; keep it true. Its `AGENTS.md` holds game-local rules (its `CLAUDE.md` only imports it).
- Imports: only `@partybox/game-sdk` (+ `react` in `client/`). The linter blocks everything else. Exception: `games/chess/server` also imports `chess.js` and `js-chess-engine` (ADR-075).
- One file per phase under `server/phases/`; `reduce` composes them; every phase has `fixtures/<id>.json`.
- Content is JSON under `content/`, validated by `content/schema.ts`; family-friendly by default.
- After adding or renaming a game: `pnpm gen-registry` (the scaffold does it), then `pnpm verify`.
