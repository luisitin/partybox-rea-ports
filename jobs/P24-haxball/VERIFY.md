# P24 verification

Runner `r3-local`, branch `job/P24-haxball`; implementation milestone `c51f050`.
Install is reused from P03. Local starts are 2026-10-11; UTC starts are 2026-10-12.

| Check                | Exact command / evidence                                                                                                  | Actual result                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript           | `pnpm.cmd typecheck`                                                                                                      | PASS on the current source.                                                                                                                                                      |
| Client               | `pnpm.cmd vitest run games/haxball/client --maxWorkers=1 --pool=threads`                                                  | PASS: 25 tests / 2 files, 13.32 s; start 22:39:10 local / 03:39:10 UTC.                                                                                                          |
| Rules                | `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts --maxWorkers=1 --pool=threads`                                  | PASS: 34 tests / 1 file, 546 ms; start 22:46:32 local / 03:46:32 UTC.                                                                                                            |
| SSR / fixtures       | Evidence environment below; `pnpm.cmd vitest run games/haxball/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads` | PASS: 11 tests / 1 file, 4.86 s; start 22:43:14 local / 03:43:14 UTC. Near-final second-half fixture and replayed done state regenerated.                                        |
| Full Haxball scope   | Evidence environment below; `pnpm.cmd vitest run games/haxball --maxWorkers=1 --pool=threads`                             | PASS: 98 tests / 7 files, 906.54 s, root session 81617; start 22:47:25 local / 03:47:25 UTC. Includes SDK 20, property 1, rules 34, client 25, SSR 11 and simulation 7.          |
| Final static capture | P24_CPU_CAPTURE=1 `node jobs/P24-haxball/capture.mjs`; `media/layout.json`                                                | PASS:55 HTML/PNG pages at1920x1080/390x844, zero geometry/typography issues; final capture2026-10-12T04:14:00.653Z. Actual frame/raster wait verified the phone identity header. |
| Mounted controls     | Same one-browser capture; `media/interaction.json` and final `media/layout.json`                                          | PASS:67/67 checks,3 PNGs,60px minimum buttons and8px minimum separation. Chrome154.0.8037.99; native owned-process exits and exact CDP endpoint closure verified.                |
| Simulation           | Full-scope command above; `media/simulation.json`                                                                         | PASSED: complete 7,000/7,000 attempts terminated, zero failed runs, 22,275 goals and 24,319,603 physics steps.                                                                   |
| Mutation             | `node jobs/P24-haxball/mutate.mjs`; `media/mutations.json`                                                                | PASS: 20/20 killed, 0 survived, 0 invalid; originalsRestored=true, root session 25271.                                                                                           |

For evidence commands, set `$env:PB_WRITE_EVIDENCE = '1'` in PowerShell before
running the stated command, then restore/remove that environment variable.
The SDK wrapper loads only the real Haxball contract shard. Property coverage uses
seeds 1/2/3 plus 1,000 reproducible sampled seeds, with deep-freeze, replay, JSON,
privacy and termination checks.

Simulation uses the default two 90-second halves, 50 ms physics steps and a 400 ms
driver; physics and bots remain active. Each count 2–8 has 1,000 matches, rotating
easy/normal/sharp 334/333/333 times. Every strength records actual goals at every
count. At every count the virtual minimum, median and maximum are all 188,000 ms
(two halves plus 8 s halftime), below the 4-minute estimate x 2 bound of 480,000 ms.
The earlier 1,000-game count-2 probe passed in 21.36 s with 5,320 goals; the full
report supersedes that probe as the required simulation evidence.

The mutation script plants one fault at a time, runs only the Haxball rule tests,
and restores originals in `finally`. Its child command is
`node node_modules/vitest/vitest.mjs run games/haxball/__tests__/game.test.ts --maxWorkers=1 --no-file-parallelism --reporter=json`.
The report records the resolved Node/Vitest paths, original source SHA-256 hashes,
and assertion failures; syntax/import failures do not count.

| #   | Planted bug                                          | Result |
| --- | ---------------------------------------------------- | ------ |
| 1   | Credit the wrong attacking team                      | Killed |
| 2   | Count crossing before the whole ball clears the goal | Killed |
| 3   | Score outside the mouth                              | Killed |
| 4   | Judge goal from final y rather than crossing y       | Killed |
| 5   | Reverse own-goal attribution                         | Killed |
| 6   | Award two goals for one crossing                     | Killed |
| 7   | Leave the scored puck in the net after reset         | Killed |
| 8   | Never expire held controls                           | Killed |
| 9   | Give diagonal movement extra acceleration            | Killed |
| 10  | Allow kicking a distant ball                         | Killed |
| 11  | Keep a successful held kick armed                    | Killed |
| 12  | Remove the kick recovery interval                    | Killed |
| 13  | Accept a duplicate sequence in applyControl          | Killed |
| 14  | Let an old-instance input advance live physics       | Killed |
| 15  | Accept controls from disconnected players            | Killed |
| 16  | Let a permanent leaver drive after reconnect         | Killed |
| 17  | Never swap goals at halftime                         | Killed |
| 18  | Double the second-half clock                         | Killed |
| 19  | Start delayed goal reset at receipt time             | Killed |
| 20  | Leak every player's intent in the public match view  | Killed |

Earlier failures, retained honestly:

- First focused run: 23 passes / 7 incorrect rank/timer expectations, corrected on
  rerun. A paused VIP End bug was later fixed and regression-tested; its discovery
  interrupted an earlier full attempt before results.
- Full run 2934: 89 passes / 4 failures, 508.54 s, from zero-goal simulations at
  counts 2/3/4 and an early play-last fixture exceeding the SDK's 500-step finisher.
  Bot strategy and a genuine near-final fixture were corrected without changing
  the SDK guard; final run 81617 passes all 98 tests.
- First mounted setup: `SyntaxError: Unexpected identifier 'object'`, capture exit
  1. Setup was fixed and the later 67/67 mounted pass supersedes that failure.

Final local gates: `pnpm.cmd typecheck` and `pnpm.cmd format` PASS. Manual visual review covered every phase/role and final changed layouts. `node jobs/P24-haxball/hash-media.mjs` produced120 hashes for120 media files totaling5,832,972 bytes; independent PowerShell SHA-256 recomputation is required after every media change. Source SHA-256 values match all four restored mutation files. Temporary Chrome profiles can remain locked with EBUSY after their browser/endpoint are verified closed; no owned active browser remains.

Pending: P24 PR CI and post-green KEEP GOING.

Original live practice and a human eight-stranger network playtest were unavailable.
Research, simulation, SSR and mounted evidence are not original live play.
