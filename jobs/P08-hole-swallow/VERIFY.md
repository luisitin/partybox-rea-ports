# P08 verification

Runner r7-local; local evidence recorded on2026-10-11. All local checks pass. CI is pending until the draft PR runs.

| Check                          | Exact command                                                                                                | Result                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Install                        | `corepack enable`; `pnpm.cmd install`                                                                        | Passed; pnpm12.4.2, lockfile unchanged                                                 |
| TypeScript                     | `pnpm.cmd typecheck`                                                                                         | Passed, exit0                                                                          |
| Formatting                     | `pnpm.cmd format`                                                                                            | Passed, exit0                                                                          |
| Own game + actual SDK contract | `pnpm.cmd vitest run games/hole-swallow --maxWorkers=1`                                                      | Passed90/90 (6 files),150.71s, exit0; includes20 actual SDK checks                     |
| Bots                           | `pnpm.cmd tsx jobs/P08-hole-swallow/simulate.ts`                                                             | 7,000 passed; 1,000 each for2,3,4,5,6,7,8 players, seed1-1000, three strengths         |
| Duration                       | Same simulation                                                                                              | All counts: median90,000ms play, max97,000ms including reveal; budget240,000ms         |
| Properties                     | Own-game properties.test.ts, fast-check seeds1,2,3                                                           | 1,000 generated cases each; 3,000 total pass                                           |
| Mutations                      | `node jobs/P08-hole-swallow/mutate.mjs`                                                                      | 20/20 caught by assertion failures, zero invalid or surviving; each source restored    |
| Screens                        | `node jobs/P08-hole-swallow/render.mjs`; `CHROME_PATH` set to Edge, `node jobs/P08-hole-swallow/capture.mjs` | 12 HTML +12 PNG; every phase, TV1920x1080 and phone390x844 withTV/phone-only/spectator |
| CI                             | `.github/workflows/P08.yml`                                                                                  | Pending draft PR                                                                       |

## Mutation audit

One mutation at a time, one threads worker, focused44-test baseline first. The actual SDK and
3,000 properties run in the separate full game command. Syntax/import failures do not count.
`mutations.json` records source hashes, commands and the assertions that caught each mutation.

| ID  | Planted bug                                   | Result                |
| --- | --------------------------------------------- | --------------------- |
| M01 | Double the intake score                       | KILLED; 13 assertions |
| M02 | Lose growth from swallowed props              | KILLED; 8 assertions  |
| M03 | Award final growth instead of retained intake | KILLED; 2 assertions  |
| M04 | Allow an equal-width object to fit            | KILLED; 1 assertions  |
| M05 | Consume an object without footprint overlap   | KILLED; 1 assertions  |
| M06 | Let diagonal steering move faster             | KILLED; 1 assertions  |
| M07 | Accept an input from before the settled world | KILLED; 1 assertions  |
| M08 | Accept a stale timer phase stamp              | KILLED; 1 assertions  |
| M09 | Keep the old round end after resuming a pause | KILLED; 1 assertions  |
| M10 | Miss the phase exit at exactly ninety seconds | KILLED; 4 assertions  |
| M11 | Leak private RNG state through the stage view | KILLED; 1 assertions  |
| M12 | Remove sharp bots selective hunting strategy  | KILLED; 1 assertions  |
| M13 | Drop protection when a victim respawns        | KILLED; 2 assertions  |
| M14 | Erase accumulated score when swallowed        | KILLED; 1 assertions  |
| M15 | Allow equal holes to swallow one another      | KILLED; 3 assertions  |
| M16 | Bypass the victims active shield              | KILLED; 1 assertions  |
| M17 | Double the forced respawn wait                | KILLED; 4 assertions  |
| M18 | Slow growing holes twice as quickly           | KILLED; 1 assertions  |
| M19 | Give a contested prop to the farther hole     | KILLED; 1 assertions  |
| M20 | Remove small-object recycling                 | KILLED; 1 assertions  |

## Screen fit and manual review

Production React components, production CSS modules and design tokens rendered inside a shell
with reserved header/footer space. Checked all12 PNGs and HTML. Play phone has no scrolling;
stage/joystick and eight-player results fit. Initial TV clipping was corrected: the eighth row and
all six growth labels now remain in the visible stage. Numbers and color both identify seats.
Overlapping city rims use top-layer callouts. Final label-spacing recapture passed; all eight crowded identities remain visible.

The fit report retains element scroll-height probes. Inline text and SVG glyph bounds can report
overflow without clipping; the meaningful button/heading/list outside-viewport count is zero
on every corrected screen. Manual review remains the fit criterion. Media is about1.3MB, below10MB.

## Scope and access limits

Original live play was not performed. Independent firsthand sources, official listings and public
client inspection substitute; source constants not observed directly remain labeled adaptations.
Computer-use inventory had no enabled surfaces. Own headless Edge was used for static port capture;
the prior stalled Chrome instance was closed first. Every capture browser closes in finally.

Only this game tests and one worker ran; no whole-suite or whole-suite browser runs. No new
dependencies, runtime network calls, tracking, secrets or copied original assets.

The loaded-desktop90-test run took350.02s: transforms15.29s, imports28.52s.
SDK random/fast strategy assertions completed in95.184s/126.167s and exceeded
the inherited20s test clock. The game-local contract wrapper allows240s wall time;
virtual estimated-duration checks, all roster sizes and all SDK assertions remain unchanged.

The final rerun passed all90 assertions and exited0 in150.71s (74.97s test work).
Windows fork-shutdown warnings did not change the pass or exit status.
