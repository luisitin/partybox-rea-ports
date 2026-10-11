# P06 verification

All commands run in the r6 clone. On Windows `pnpm.cmd` avoids the disabled PowerShell shim. Only this game's tests are run; one worker is used. Screen capture starts one isolated Chromium browser and closes it in finally. No full-suite browser run.

| Check                | Exact command                                                                                                                              | Result                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Install once         | `corepack enable`; `pnpm.cmd install`                                                                                                      | Pass, frozen workshop dependencies reused                                                                                |
| Typecheck            | `pnpm.cmd typecheck`                                                                                                                       | Pass after resolving a Windows case-insensitive helper/component filename collision                                      |
| Semantic rules       | `pnpm.cmd vitest run games/snake-royale/server/rules.test.ts --maxWorkers=1`                                                               | 39/39 pass                                                                                                               |
| Property seeds       | `pnpm.cmd vitest run games/snake-royale/__tests__/properties.test.ts --maxWorkers=1`                                                       | Seeds 1, 2, 3, each 1000 generated random seeds: 3000 pass, including immutable inputs and byte-identical chained replay |
| Fixtures and SSR     | `$env:SNAKE_WRITE_ARTIFACTS='1'; pnpm.cmd vitest run games/snake-royale/__tests__/artifacts.test.tsx --maxWorkers=1`                       | Pass; play, score, final score and done generated; TV, phone, phone-only and spectator HTML                              |
| Screen fit           | `node jobs/P06-snake-royale/capture.mjs`                                                                                                   | Pass: 16 screens, exact viewport/document dimensions and zero offscreen text at 1920×1080 and 390×844; PNGs reviewed     |
| Actual SDK contract  | `pnpm.cmd vitest run games/snake-royale/__tests__/contract.test.ts --maxWorkers=1`                                                         | Wrapper limits the actual SDK suite to this game; final run pending generated fixtures                                   |
| Seeded simulation    | `$env:SNAKE_WRITE_REPORTS='1'; $env:SNAKE_SIM_ALL_COUNTS='1'; pnpm.cmd vitest run games/snake-royale/__tests__/sim.test.ts --maxWorkers=1` | Running: 1,000 seeds at every player count from 2–8, three strengths                                                     |
| Mutation experiment  | `node jobs/P06-snake-royale/mutate.mjs`                                                                                                    | Pass: 20/20 actual semantic faults caught, exact source restored in finally; diagnostics in media/mutations.json         |
| Formatting           | `pnpm.cmd format`                                                                                                                          | Final run pending                                                                                                        |
| Complete game checks | `pnpm.cmd vitest run games/snake-royale --maxWorkers=1`                                                                                    | Final run pending                                                                                                        |
| CI                   | P06 workflow on pull request                                                                                                               | Pending draft PR                                                                                                         |

## Discovered and fixed

- Boost at size8.1 emitted0.3 food while spending0.1; food now equals actual spend.
- VIP end during pause advanced the frozen world; it now banks at pause time.
- Rounded bot angles could exceed±π; they are clamped to the schema.
- Windows chose `standings.ts` for a `Standings.tsx` import; the helper has a distinct filename.
- First static capture omitted SDK Stage CSS. It now includes the actual frame style.
- Eight two-line TV rows overfilled the stage. TV roster text is 32 px with explicit line height; all recaptures fit.

All shipped media must remain below10MB and every media file is listed in SHA256SUMS.txt. Exact final counts, simulated median lengths, killed mutants and CI URL will be recorded before readiness.
