# P07 Paper Territory

An original two-minute territory race for 2–8 PartyBox players. Tap four absolute arrow buttons, draw a loop from your numbered home, close it to claim land, and cut rival trails. The TV is the shared map; stage phones show the same map above their controls. Protected homes and three-second returns keep everyone involved.

## Run and check

Install once: `corepack enable`, `pnpm install`.

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/paper-territory --maxWorkers=1`
- `PB_RECORD_VERIFY=1 pnpm vitest run games/paper-territory --maxWorkers=1` records simulation/property metrics.
- `PB_BUILD_ARTIFACTS=1 pnpm vitest run games/paper-territory/__tests__/artifacts.test.tsx --maxWorkers=1` rebuilds fixtures and static renders.
- `node jobs/P07-paper-territory/tools/capture.mjs` captures one isolated browser, closed in `finally`.
- `node jobs/P07-paper-territory/tools/mutate.mjs` runs 20 serial source mutations and restores every original byte.

The full rules are in `games/paper-territory/README.md`. RESEARCH/SOURCES distinguish corroborated mechanics from the browser/mobile self-cross split and our explicit simultaneous collision rules. VERIFY records exact checks, LOOP records player-focused iteration, media contains the reviewed screens and SHA256SUMS records every media artifact.

CI `.github/workflows/P07.yml` runs install, typecheck, format and only this game's tests on Ubuntu with read-only permissions. No runtime requests, copied assets or added dependencies.
