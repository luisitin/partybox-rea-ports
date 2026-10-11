# Verification — P21

All tests are scoped to this game. Browser captures use one cached headless Chromium instance, closed in finally. No other runner process or worktree is touched.

| Check                            | Exact command                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                          | `corepack enable`; `pnpm.cmd install`                                                                                                                        | Passed once; Node 24.19.0, pnpm 12.4.2, existing lockfile.                                                                                                                                                                                                                                                                |
| Typecheck                        | `pnpm.cmd typecheck`                                                                                                                                         | Passed, exit 0, after the final engine and UI changes.                                                                                                                                                                                                                                                                    |
| Format                           | `pnpm.cmd format`                                                                                                                                            | Passed, exit 0, after formatting only the game, job folder, and scoped workflow.                                                                                                                                                                                                                                                                               |
| Game + real SDK contract helpers | `pnpm.cmd vitest run games/pong-party --maxWorkers=1`                                                                                                        | 6 files, 57 tests passed in 50.00 s; CLI exit 0. Contracts exercise fixtures/content/manifest, totality, JSON/views, secrets, real SDK strategies, presence modes, complete results, replay, and bounded state.                                                                                                           |
| Simulation                       | Same scoped test command                                                                                                                                     | 7,000/7,000 active bot games terminate: 1,000 seeds at every player count 2–8. Easy 334 / normal 333 / sharp 333 per count, 400 ms reaction, fixed 20 ms physics. Median round 60 s at every count; longest match 66 s versus the 240 s budget. See `simulation.json`.                                                    |
| Properties                       | Same scoped command; focused rerun `pnpm.cmd vitest run games/pong-party --maxWorkers=1 -t property:`                                                        | Passed 1,003 cases: seeds 1, 2, 3 and 1,000 reproducible random seeds, 24,072 events. Frozen input purity, byte-identical replay, finite JSON bounds, and tick partition. Direct invariant checks passed in 845 ms versus an initial assertion-heavy 465,055 ms timeout, with every case retained. See `properties.json`. |
| Mutation                         | `node jobs/P21-pong-party/mutation.mjs`                                                                                                                      | Twenty source bugs planted sequentially; 20/20 caught, required 19. Original bytes restored in finally. Internally runs only `pnpm.cmd vitest run games/pong-party --maxWorkers=1 -t mut:`. See `mutation.json`.                                                                                                          |
| SSR                              | Same scoped command; focused `pnpm.cmd vitest run games/pong-party --maxWorkers=1 -t screens:`                                                               | Fifteen React HTML documents: three phases × TV, phone with TV, phone-only, spectator with TV, and spectator-only. CSS mapping assertions prevent unstyled captures.                                                                                                                                                      |
| Browser fit                      | Local `node .git/r20-capture-run.mjs`; reproducible public entry `node jobs/P21-pong-party/capture.mjs` with REA_PLAYWRIGHT_MODULE and REA_CHROMIUM supplied | Styled capture passed zero clipped items, a 96 px TV clock, TV body ≥32 px, a 70.4 px slider, and native keyboard change. Final overscan/rank refresh pending. See `capture.json`.                                                                                                                                        |
| Media hashes and budget          | `node jobs/P21-pong-party/hash-media.mjs`                                                                                                                    | Thirty HTML/PNG files hashed; 1,231,477 bytes total, under 10 MB. All 15 final PNGs inspected by hand, with clear TV labels and fitted phones/spectators.                                                                                                                                                                                                                                |
| CI                               | `.github/workflows/P21.yml`, draft PR checks                                                                                                                 | Pending PR creation. Ubuntu, 30 minutes, read-only permissions, actions/* only; install, typecheck, format, and scoped tests.                                                                                                                                                                                             |

## Actual planted bugs

1. only four initial lives — caught by 1 failing rule test(s).
2. oversized paddles hide legal misses — caught by 3 failing rule test(s).
3. collision ignores ball radius — caught by 1 failing rule test(s).
4. round lasts ninety seconds — caught by 3 failing rule test(s).
5. second ball arrives too late — caught by 1 failing rule test(s).
6. a fifth ball may spawn — caught by 2 failing rule test(s).
7. missing serve has no grace period — caught by 1 failing rule test(s).
8. opening ball moves too slowly — caught by 3 failing rule test(s).
9. save bonus can beat another life — caught by 1 failing rule test(s).
10. two players get neighboring sides — caught by 1 failing rule test(s).
11. a miss removes two lives — caught by 1 failing rule test(s).
12. a hit grants two saves — caught by 1 failing rule test(s).
13. future serves move before release — caught by 6 failing rule test(s).
14. wall reflection points outside — caught by 1 failing rule test(s).
15. elimination does not record its time — caught by 1 failing rule test(s).
16. one survivor fails to end the match — caught by 1 failing rule test(s).
17. lives have too little score weight — caught by 1 failing rule test(s).
18. done never produces results — caught by 4 failing rule test(s).
19. score deadline never exits — caught by 1 failing rule test(s).
20. views expose future serve directions — caught by 1 failing rule test(s).

## Honest limits and fixes

The original live client loaded; a practice click executed, then navigation waiting timed out. No full original match or exact original audio/timing measurement is claimed. Independent primary sources and public client inspection are logged in RESEARCH.md.

The first screenshots failed with 43 clipped items because Vitest CSS proxies do not enumerate class keys. The harness now parses CSS selectors, reads class properties directly, reproduces host flex sizing, and asserts styles exist. Only corrected final screens count as evidence.

The workshop omits a live PartyBox room server. Pure input/reconnect/pause/lifecycle checks and real React/native control screen tests cover the plugin. Screens are checked at 1920×1080 and 390×844; a 320×568 reduced-motion smoke is also run. No whole-suite browser run occurs.

The final Windows Vitest run printed a fork shutdown timeout warning after its passing summary, then exited 0. The exact exit was awaited before recording success. CI verifies the same scoped command on Ubuntu.
