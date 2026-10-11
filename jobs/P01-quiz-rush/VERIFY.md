# P01 verification

Run r1-local on Windows 11, Node 24 and pnpm 12.4.2. `pnpm.cmd` is the Windows entry point
because this desktop blocks PowerShell shim scripts. No complete repository test suite was run.

| Check                              | Exact command                                                                                            | Result                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                            | `corepack enable`; `pnpm.cmd install`                                                                    | PASS; frozen workspace dependencies reused, no new dependencies                                                                                                                                |
| Types                              | `pnpm.cmd typecheck`                                                                                     | PASS                                                                                                                                                                                           |
| Game + SDK + property + simulation | `pnpm.cmd vitest run games/quiz-rush --maxWorkers=1`                                                     | PASS; 106 tests, 1 opt-in fixture-generation test skipped; 18.11 s; separately generated fixtures and 7000 simulations also pass                                                               |
| Published SDK contract             | Included by `games/quiz-rush/__tests__/sdk.test.ts` in the command above                                 | PASS; 20 unmodified SDK tests, discovery restricted to quiz-rush only                                                                                                                          |
| Property tests                     | `pnpm.cmd vitest run games/quiz-rush/__tests__/properties.test.ts --maxWorkers=1` (also in game run)     | PASS; seeds 1, 2, 3 + 1000 independently sampled reproducible seeds; generated event traces, fuzz, immutable state, JSON, replay                                                               |
| Mutations                          | `node jobs/P01-quiz-rush/mutate.mjs`                                                                     | PASS: 20/20 behavioral kills, zero invalid/load/syntax kills; 25 baseline tests green; original source hashes restored                                                                         |
| Formatting                         | `pnpm.cmd format`                                                                                        | PASS; all matched files formatted                                                                                                                                                              |
| Screens                            | Opt-in `screens.test.tsx` renders; `node jobs/P01-quiz-rush/capture.mjs`                                 | 44 HTML/PNG frames and 47 SSR assertions pass; zero scrolling, clipping or missing CSS, including maximum text and eight tied long names; final pacing recapture and all 90 checksums complete |
| CI                                 | `.github/workflows/P01.yml`: install, types, format, this game's tests, ubuntu-latest, 30 min, read-only | PASS; GitHub run 38176682177 (40 s), PR #2 ready after success; integration includes updated main SDK                                                                                          |

## Seeded bots

`simulation.test.ts` runs 1000 distinct seeds at **every** supported player count, rotating easy,
normal and sharp strengths and all three packs. One in ten matches has 20 questions, the others 10. All 7000/7000 matches finished with complete finite results before the 1200-second ceiling
(manifest estimate × 2). Round durations below include question, explanation and standings beats;
the final round includes the podium. Evidence: `sim-2.json` through `sim-8.json`.

| Players | Matches | Median round (s) | Longest match (s) |
| ------- | ------- | ---------------- | ----------------- |
| 2       | 1000    | 30.931           | 645.048           |
| 3       | 1000    | 32.724           | 702.403           |
| 4       | 1000    | 34.334           | 755.061           |
| 5       | 1000    | 35.858           | 786.671           |
| 6       | 1000    | 37.460           | 812.068           |
| 7       | 1000    | 39.646           | 853.805           |
| 8       | 1000    | 41.311           | 893.346           |

## Reproducibility

Fixtures come from a single fully played eight-seat match via:
`$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/generate.test.ts --maxWorkers=1`.
The SDK checks that `done.json` is the podium fixture played to completion. Mutations restore the
exact original bytes in `finally`; `mutation-results.json` lists all planted defects and failing
behavioral tests. CI skips fixture/media generation and checks the committed artifacts instead.

Screen evidence command: `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/screens.test.tsx --maxWorkers=1`, then `node jobs/P01-quiz-rush/capture.mjs`, `pnpm.cmd exec prettier --write jobs/P01-quiz-rush/media`, and `node jobs/P01-quiz-rush/hash-media.mjs`.
One owned headless Chrome process captures sequentially and closes in `finally`. Static renders
settle SDK animation hooks for readable final frames; actual components, views and module CSS run.
Independent visual review covers all 44 frames. TV body text is at least 32.736 px; the smallest
answer target is 173 × 210.7 px. Phones reserve an 84 px header and 48 px footer. No second browser
or whole-suite browser run was started. SHA256SUMS covers all 90 media files, below 10 MB.

No secrets, tracking, runtime network calls, imported artwork or imported audio. Original live
play was unavailable; source reconstruction is explicitly recorded in RESEARCH/ASSUMPTIONS.
