# P01 verification

Run r1-local on Windows 11, Node 24 and pnpm 12.4.2. `pnpm.cmd` is the Windows entry point
because this desktop blocks PowerShell shim scripts. No complete repository test suite was run.

| Check                              | Exact command                                                                                            | Result                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                            | `corepack enable`; `pnpm.cmd install`                                                                    | PASS; frozen workspace dependencies reused, no new dependencies                                                                                         |
| Types                              | `pnpm.cmd typecheck`                                                                                     | PASS                                                                                                                                                    |
| Game + SDK + property + simulation | `pnpm.cmd vitest run games/quiz-rush --maxWorkers=1`                                                     | Final complete run in progress; baseline 53 passed, generated fixtures and 7000 simulations passed again after bot public-wording fix                   |
| Published SDK contract             | Included by `games/quiz-rush/__tests__/sdk.test.ts` in the command above                                 | PASS; 20 unmodified SDK tests, discovery restricted to quiz-rush only                                                                                   |
| Property tests                     | `pnpm.cmd vitest run games/quiz-rush/__tests__/properties.test.ts --maxWorkers=1` (also in game run)     | PASS; seeds 1, 2, 3 + 1000 independently sampled reproducible seeds; generated event traces, fuzz, immutable state, JSON, replay                        |
| Mutations                          | `node jobs/P01-quiz-rush/mutate.mjs`                                                                     | PASS: 20/20 behavioral kills, zero invalid/load/syntax kills; 24 baseline tests green; original source hashes restored                                  |
| Formatting                         | `pnpm.cmd format`                                                                                        | Pending final complete artifacts and main CLAIMS sync                                                                                                   |
| Screens                            | Opt-in `screens.test.tsx` renders; `node jobs/P01-quiz-rush/capture.mjs`                                 | 44 HTML/PNG frames captured, 47 SSR assertions passed; final recapture correcting measured small-phone standings and eight-way-tie overflow in progress |
| CI                                 | `.github/workflows/P01.yml`: install, types, format, this game's tests, ubuntu-latest, 30 min, read-only | Pending draft PR                                                                                                                                        |

## Seeded bots

`simulation.test.ts` runs 1000 distinct seeds at **every** supported player count, rotating easy,
normal and sharp strengths and all three packs. One in ten matches has 20 questions, the others 10. All 7000/7000 matches finished with complete finite results before the 1200-second ceiling
(manifest estimate × 2). Round durations below include question, explanation and standings beats;
the final round includes the podium. Evidence: `sim-2.json` through `sim-8.json`.

| Players | Matches | Median round (s) | Longest match (s) |
| ------- | ------- | ---------------- | ----------------- |
| 2       | 1000    | 10.511           | 257.329           |
| 3       | 1000    | 10.810           | 276.614           |
| 4       | 1000    | 10.964           | 289.334           |
| 5       | 1000    | 11.144           | 292.799           |
| 6       | 1000    | 11.265           | 300.074           |
| 7       | 1000    | 11.375           | 303.770           |
| 8       | 1000    | 11.452           | 315.066           |

## Reproducibility

Fixtures come from a single fully played eight-seat match via:
`$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/generate.test.ts --maxWorkers=1`.
The SDK checks that `done.json` is the podium fixture played to completion. Mutations restore the
exact original bytes in `finally`; `mutation-results.json` lists all planted defects and failing
behavioral tests. CI skips fixture/media generation and checks the committed artifacts instead.

No secrets, tracking, runtime network calls, imported artwork or imported audio. Original live
play was unavailable; source reconstruction is explicitly recorded in RESEARCH/ASSUMPTIONS.
