# P23 Bonk.io

A five-round PartyBox platform battle for 2–8 players. Hold Left/Right, tap Jump and time Heavy to bump rivals off. Last standing wins a point; most wins takes the match. Original numbered SVG art, public stage phones/spectators, deterministic bots and shrinking platforms keep the living-room game readable and bounded.

## Run and check

Install once: `corepack enable`, `pnpm install` (already completed by r4-local).

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/bonk-io --maxWorkers=1`
- `PB_RECORD_VERIFY=1 pnpm vitest run games/bonk-io --maxWorkers=1` records simulation/property evidence.
- `PB_BUILD_ARTIFACTS=1 pnpm vitest run games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1` builds fixtures and static phase screens.
- `node jobs/P23-bonk-io/tools/capture.mjs` captures one isolated cached browser and closes it in `finally`.
- `node jobs/P23-bonk-io/tools/mutate.mjs` plants 20 serial source mutations, tests them and restores original bytes.

The spec is `games/bonk-io/README.md`. RESEARCH/SOURCES separate observed mechanics from authored physics, layouts and timing. VERIFY records exact checks; LOOP records the post-green convergence audits. Media stays below 10 MB and every file is hashed in SHA256SUMS.txt.

CI `.github/workflows/P23.yml` runs install, typecheck, format and only this game's tests on Ubuntu with read-only permissions. No runtime requests, copied assets or new dependencies. Verification includes every player count 2-8, SDK contracts, seeded properties, serial mutations and 46 phase/role captures; exact current results are in VERIFY.md.
