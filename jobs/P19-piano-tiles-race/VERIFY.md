# Verification — P19 Tile Tempo

| Check                           | Exact command                                                                                              | Result                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Install                         | `corepack enable; pnpm.cmd install`                                                                        | PASS;87 packages;no new dependency                                                                                          |
| Typecheck                       | `pnpm typecheck`                                                                                           | PASS,exit0                                                                                                                  |
| Format                          | `pnpm format`                                                                                              | PASS,all matched files                                                                                                      |
| Focused tests+full SDK contract | `pnpm vitest run games/tile-tempo --maxWorkers=1 --pool=threads --testTimeout=120000 --hookTimeout=120000` | PASS,86 tests across7files;47.27s total,2.70s assertions                                                                    |
| Bot simulation                  | `node --import tsx jobs/P19-piano-tiles-race/tools/simulate.ts`                                            | PASS,21,000 games:1000seeds at every2–8player count and easy/normal/sharp;max39s against120s budget                         |
| Median play length              | simulation above                                                                                           | 30.0s at every count/strength,including2,4,8players;SIMULATION.json                                                         |
| Mutation                        | `node jobs/P19-piano-tiles-race/tools/mutate.mjs`                                                          | PASS,20/20 assertion-caught bugs,each source restored;MUTATIONS.json lists all20                                            |
| Property seeds                  | focused test above                                                                                         | PASS,seeds1/2/3+1000 reproducible random seeds;16events each,frozen inputs,independent score oracle,replay+JSON+size checks |
| Fixtures                        | `pnpm tsx jobs/P19-piano-tiles-race/tools/fixtures.ts`                                                     | PASS,all4phases from one real event history;done continues score exactly                                                    |
| HTML/PNG                        | focused tests;`node jobs/P19-piano-tiles-race/tools/capture.mjs`                                           | PASS,16screens,TV1920×1080/phone390×844,TV-room+phone-only+spectator;all0overflow,controls>=44px                            |
| Manual fit                      | inspected phase PNGs and shared layouts                                                                    | PASS,readable sofa text,timer128px,all8seats fit,play controls stay onscreen,spectators have0buttons                        |
| Browser cleanup                 | capture tool finally                                                                                       | PASS,one isolated Chrome process at a time,closed;no server started                                                         |
| Media budget+hashes             | SHA256SUMS.txt                                                                                             | PASS,about1.3MB,allmedia files hashed                                                                                       |
| CI                              | .github/workflows/P19.yml                                                                                  | Pending draft PR;must be green before ready                                                                                 |

Windows cmd/pnpm transport stalled once during mutations; direct Node Vitest child fixed it.
The initial fork pool passed83assertions but timed out terminating workers. A loaded-desktop
thread retry hit20s timeouts in the old property loop and2SDK simulation cases. Final single-thread
run has a120s wall-clock allowance;all86tests passed. Property coverage is unchanged while repeated
large-track serializations fell32→2perseed. Static capture pipe transport failed once;the local
Chrome debugging port works and cleanup is verified. No live-original playthrough is claimed.
