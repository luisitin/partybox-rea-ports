# games/

One folder per game. `_template/` is the scaffold source (`pnpm new-game <id>`); it is tested by the
contract suite but never registered. This folder is one workspace package (`@partybox/games`, ADR-008)
that supplies `@partybox/game-sdk` and `react` to every game — a new game needs no `pnpm install`.

## Layout of a game (docs/ADDING_A_GAME.md has the full list)

```
games/<id>/
  manifest.json  README.md (the spec)  AGENTS.md (local rules)  CLAUDE.md (imports AGENTS.md)
  server/  index.ts  types.ts  phases/<phaseId>.ts  scoring.ts  content.ts      # pure
  client/  index.ts  Tv.tsx  Controller.tsx                                     # React, dumb
  content/ schema.ts  *.json      fixtures/<phaseId>.json      __tests__/
```

## Rules

- Games import only `@partybox/game-sdk` (and `react` in `client/`). Never other games, engine, server, client.
- `server/` is pure: no `Date.now`, `Math.random`, timers, I/O, module-level mutable state (lint enforces).
- Every phase has a file and a fixture; `README.md` is the spec the stress session tests against.

## Test

`pnpm vitest --project games` (unit) · `pnpm vitest --project contract` (contract) · `pnpm sim --game <id>`
