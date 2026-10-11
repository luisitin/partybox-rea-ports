# P13 verification

No check below is marked passed until its command has completed.

| Check | Command | Result |
| --- | --- | --- |
| Install | `corepack enable`; `pnpm.cmd install` | PASS, pnpm 12.4.2 / Node 24.19.0 |
| Types | `pnpm.cmd typecheck` | Pending |
| Formatting | `pnpm.cmd format` | Pending |
| Focused unit + SDK contract | `pnpm.cmd vitest run games/dino-dash --maxWorkers=1` | Pending |
| Seeds 1,2,3 + 1,000 generated seeds | Same focused command | Pending |
| Bot games at every count/strength | `pnpm.cmd tsx jobs/P13-dino-dash/simulate.ts` | Pending |
| 20 planted mutations | `node jobs/P13-dino-dash/mutate.mjs` | Pending |
| Screens, every phase and mode | Capture script documented after inspection | Pending |
| CI | P13 workflow on draft PR | Pending |
