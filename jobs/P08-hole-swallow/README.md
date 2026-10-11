# P08 Hole Swallow

PartyBox city-swallowing game for 2–8 phones: grow from street furniture to buildings,
swallow smaller rivals and compete for points over 90 seconds. Supports phone-only rooms,
remote players, spectators and three bot strengths. Original SVG art; no new dependencies.

## Run and check

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm format
pnpm vitest run games/hole-swallow --maxWorkers=1
pnpm tsx jobs/P08-hole-swallow/simulate.ts
pnpm tsx jobs/P08-hole-swallow/fixtures.ts
node jobs/P08-hole-swallow/mutate.mjs
node jobs/P08-hole-swallow/render.mjs
node jobs/P08-hole-swallow/capture.mjs
```

On Windows PowerShell use `pnpm.cmd` if execution policy blocks the `.ps1` launcher.
Captures use one local headless browser, closed in finally; set CHROME_PATH for Edge.
TV and phone entries load through the PartyBox game contract, like the reference port.
The public workshop contains the SDK and game modules, not the full LAN server shell.

Game spec: `games/hole-swallow/README.md`. Verification: VERIFY.md.
Research, provenance and uncertain source facts: RESEARCH.md, SOURCES.md, ASSUMPTIONS.md.
Progress: NEXT.md. Measured player-facing improvements: LOOP.md.
Phase render artifacts: media/, with SHA256SUMS.txt.
