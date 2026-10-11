# P20 Fruit Slice

Fruit Slice is a complete 2–8-player PartyBox arcade game: a 60-second race to
slice the same seeded fruit fountain, with personal cuts, combo rewards and
recoverable bomb mistakes. Original inline SVG art; no runtime network calls.

## Run

`corepack enable`, then `pnpm install`. On Windows PowerShell use `pnpm.cmd`.
The host loads `games/fruit-slice/server/index.ts` and the separate TV/phone entries.
No new dependency is required.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/fruit-slice --maxWorkers=1`
- `pnpm tsx jobs/P20-fruit-slice/fixtures.ts` regenerates phase fixtures.

The game-local wrapper executes the actual SDK contract suite for Fruit Slice
only. Seeded simulation, property tests, mutation checks and screens are recorded
in VERIFY.md. Research evidence and adaptation limits are in RESEARCH.md;
NEXT.md identifies the current milestone and remaining work.
