# P24 verification

Runner `r3-local`, branch `job/P24-haxball`; implementation milestone `c51f050`.
Install is reused from P03. Initial local starts are 2026-10-11; UTC starts are 2026-10-12.

## Initial verification (historical, before post-green physics and tactics)

| Check                | Exact command / evidence                                                                                                  | Actual result                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript           | `pnpm.cmd typecheck`                                                                                                      | PASS on the initial implementation source.                                                                                                                                       |
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

Initial PR CI: PASS on `4337c3db16ca062e98ed682279dc934e68280cee`,
run [38203229374](https://github.com/luisitin/partybox-rea-ports/actions/runs/38203229374).
Draft PR [17](https://github.com/luisitin/partybox-rea-ports/pull/17) remains draft during
post-green improvements and final exact-head checks.

Post-green round 1: `pnpm.cmd typecheck` PASS. With `PB_WRITE_EVIDENCE=1`,
`pnpm.cmd vitest run games/haxball/client games/haxball/__tests__/evidence.test.tsx --maxWorkers=1 --pool=threads`
PASS: 37 tests / 3 files, 17.63 s, start 23:32:48 local / 04:32:48 UTC.
The added SSR regression projects goals judged by the real reducer directly into goal,
halftime, done and delayed play views, with no foreign intent or kick metadata.
Mounted round 1: `P24_CPU_CAPTURE=1 P24_INTERACTION_ONLY=1 node jobs/P24-haxball/capture.mjs`
PASS: 64/64 goal-cue checks in `media/goal-audio.json` and 67/67 control checks in
`media/interaction.json`; real TV and controller components use their actual surface tokens.
Two goal PNGs fit, and native browser/process plus exact endpoint closure is verified in
`media/interaction-capture.json`. Measurements are semantic cue requests, not speaker acoustics.
The first round-1 capture passed all 64 goal checks but failed one existing heartbeat bound:
steady intervals 282/312/347/470 ms against its unchanged 200–450 ms tolerance. All were within
the 650 ms lease. A justified rerun passed the unchanged check at 297/313 ms; no tolerance was
relaxed and no product input code changed.

Post-green round 2: the same focused client/SSR command PASS 46 tests / 3 files, 5.87 s,
start 23:46:18 local / 04:46:18 UTC. Its first attempt had 45 passes and one erroneous assertion
that an active phone in a TV room contains a pitch/credit row; the actual phone deliberately
keeps controls while the TV carries that credit. The corrected assertion checks that behavior.
SVG title children are single strings, removing React's multi-child title warnings.

`P24_CPU_CAPTURE=1 node jobs/P24-haxball/capture.mjs` PASS, capture
2026-10-12T04:46:58.495Z: 75 full static layouts with no fit/typography issues, 67/67 mounted
controls, 64/64 goal-cue checks and 12/12 retained-credit checks. The 64-W-name own-goal credit
fits a 704 px product mount in a 390x844 phone; its visible jersey headline is one 15.39 px line,
and aria-label/title retain the full name. TV minimum jersey/body/timer sizes are
34.61328125/36/128 px. Native browser/process and exact endpoint closure verified in layout.json.
After canonical formatting and hashing: 167 media files, 8,642,244 bytes, below the strict 10 MB
limit. Round-1 CI also passed on `823d36e`, run
[38204769866](https://github.com/luisitin/partybox-rea-ports/actions/runs/38204769866).

Original live practice and a human eight-stranger network playtest were unavailable.
Research, simulation, SSR and mounted evidence are not original live play.

Round 3 test-first evidence:

- `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts -t 'solid posts and goal-crossing priority' --maxWorkers=1 --pool=threads`
  failed all 8 new cases on the unchanged server (34 skipped), 655 ms, start 23:51:00 local /
  04:51:00 UTC. Four post drives reached separation 5.10425 instead of at least 5.49999; four
  late keeper kicks overwrote scorer/own-goal credit. The initial fixes then passed all 42 rules.
- `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts -t 'swept goal crossings before endpoint walls' --maxWorkers=1 --pool=threads`
  failed all 8 further cases (42 skipped), 885 ms, start 00:11:32 local / 05:11:32 UTC. Four valid
  early crossings were erased by later endpoint walls; four earlier post grazes falsely scored.
  These are real `step` regressions, not only direct `crossedGoal` unit calls.
- Final swept-post rule command (without `-t`) PASS: 58 tests / 1 file, 778 ms, start
  00:22:15 local / 05:22:15 UTC. Added mirrored legal bank goals and overlap-recovery cases.
  `pnpm.cmd typecheck` also PASS on this source. Full simulation and refreshed mutations remain
  pending at this milestone; the older 7,000-match report is not claimed for the new physics.

Physics milestone CI [38207797194](https://github.com/luisitin/partybox-rea-ports/actions/runs/38207797194)
failed on `87135fa`: 131 of 132 tests passed, 322.74 s. All 7,000 matches terminated at
188,000 virtual ms, but 333 two-player sharp matches had zero goals despite 2,484 accepted
kicks. The positive-goal check is retained. Correcting bot tactics is required before a final
local full run or readiness; earlier bot measurements do not establish current sharp activity.

Round 4 copy: with `PB_WRITE_EVIDENCE=1`, the focused client/SSR command above PASS:
46 tests / 3 files, 9.35 s, start 00:28:49 local / 05:28:49 UTC. Phone and TV instructions now
explain getting behind the ball and radial kicks. Halftime explicitly says goals switch when
play restarts, matching the retained old arrows during the interval. The completed-match timer
is labelled 'Match finished'. New browser fit capture is pending at this checkpoint.
Round 4 capture: `P24_CPU_CAPTURE=1 node jobs/P24-haxball/capture.mjs` PASS, captured
2026-10-12T05:33:06.395Z. All 75 static layouts and 67/64/12 mounted control/goal-cue/retained-credit
checks pass. The native browser/process records and exact CDP endpoint verify closure; the
temporary profile was removed. Root inspected revised phone-only and TV halftime PNGs by hand.

Round 4 canonical media: 167 files, 8,606,409 bytes; `hash-media.mjs` completed and independent
PowerShell `Get-FileHash -Algorithm SHA256` recomputed all 167 files with zero mismatches.

Corner recovery test-first evidence: `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts
-t 'sharp bot corner recovery' --maxWorkers=1 --pool=threads` FAILED all eight new cases on
unchanged tactics, 58 skipped, 553 ms, start 00:38:28 local / 05:38:28 UTC. Each case uses an
actual bot input and reducer timers at 400 ms batches, both attacking teams at all four corners.
No case produced an authoritative kick within eight seconds. The bound accepts an inward bank
clear or a legitimate goal; it does not prescribe the bot's direction or implementation.

The first bank-clear iteration passed four corner cases and failed four (58 skipped), 495 ms,
start 00:42:30 local / 05:42:30 UTC. It incorrectly used an oversized approach waypoint and
buffered wall bounds as a contact-feasibility check, reversing an already outward horizontal
component at the attacking corner. Actual player-center bounds and radial kick contact must
drive feasibility; the unchanged eight behavioral checks remain required.

Round 5 bot verification:

- Revised actual-contact bank tactics PASS all 66 rules, 1.46 s, start 00:44:56 local /
  05:44:56 UTC. The two-player 1,000-game activity probe then PASS, all three strengths
  scoring, 21.30 s, start 00:46:38 local / 05:46:38 UTC. This probe predates the public style
  rotation; the final full run must replace it as current simulation evidence.
- `pnpm.cmd exec tsx jobs/P24-haxball/trace-bots.ts` is the retained known-seed diagnostic,
  using actual bot snapshots and reducers. Before the corner fix: four kicks, 0–0, ball trapped.
  Contact-bank revision: 24 kicks, 0–24 with a repeated favorable p2 route. Public goal/half
  rotation: 24 kicks, 12–12. These traces are retained as `media/bot-trace-before.json`,
  `media/bot-trace-bank.json` and `media/bot-trace-rotated.json`. One fixture is not parity proof.
- The repeated-kickoff regression FAILED with the old fixed lane styles: one case failed,
  66 skipped, 608 ms, start 00:51:27 local / 05:51:27 UTC. Only p2 obtained the first confirmed
  kick at three real kickoffs. Root restored the rotating source in finally before further checks.
- Final focused command `pnpm.cmd vitest run games/haxball/__tests__/game.test.ts --maxWorkers=1
--pool=threads` PASS: all 67 rules, 1.04 s, start 00:52:10 local / 05:52:10 UTC. Corner tests
  retain strict kick geometry; the repeated-kickoff case now observes first kicks from both seats
  before halftime without specifying an angle, score or rotation formula. Full scope remains next.

Full rotating physics/tactics source `ad9ba08` PASS with `PB_WRITE_EVIDENCE=1`:
`pnpm.cmd vitest run games/haxball --maxWorkers=1 --pool=threads`, 141 tests / 7 files,
540.29 s, start 00:54:43 local / 05:54:43 UTC. All 7,000 default matches terminate, zero failed
runs, 23,869 goals, 553,070 accepted kicks and 24,251,818 physics steps. All seven roster counts
have minimum/median/maximum 188,000 ms; every strength scores at every count. CI also PASS on
this exact source: [38210012575](https://github.com/luisitin/partybox-rea-ports/actions/runs/38210012575).
Canonical formatting after final SSR export gives identical SHA-256 for all 75 HTML pages
against their 05:33 capture; no static layout changed through the physics/tactics work.

Round 6 keyboard baseline: `P24_CPU_CAPTURE=1 P24_INTERACTION_ONLY=1 node
jobs/P24-haxball/capture.mjs` exited 1 with six failures among 88 mounted control checks.
Across pause/resume, goal/new-play and blur/refocus, trusted repeated ArrowRight/X key-downs
revived neutral controls and restarted heartbeats without a real release/repress. The other
82 checks pass, including genuine new presses. The old hook is now regression-proven; both
baseline report and closed native browser/endpoint evidence are retained in
`media/keyboard-repeat-before.json` and `media/keyboard-repeat-before-cleanup.json`.
The fix ignores repeat key-downs after preventing their defaults; the 300 ms heartbeat still
sustains genuine presses. This is a client-only change: server physics and simulation stay fixed.

Round 6 final focused client/SSR command PASS: 46 tests / 3 files, 40.96 s, start 01:07:04
local / 06:07:04 UTC. Final mounted command (same interaction-only environment) PASS:
88/88 controls, 64/64 goal cues and 12/12 retained-credit checks; captured
2026-10-12T06:09:30.492Z. All three keyboard transitions now remain neutral through trusted
repeat events and restart only after a real release/repress. Current HTML hashes still match
all 75 captured static layouts. Native owned PID/creation/exit checks and the exact endpoint
confirm browser closure. Four lingering owned processes required bounded native shutdown;
Windows retained exited records and locked the temporary profile (EBUSY), with no owned active
browser remaining. The retained media report records this cleanup result.

Final mutation rerun: `node jobs/P24-haxball/mutate.mjs` PASS, 20/20 killed, zero survived,
zero invalid; its baseline has all 67 rules green. Independent PowerShell Get-FileHash checks
match all four restored source hashes and originalsRestored=true. An earlier attempt stopped
at mutation 2 because the swept goal helper introduced a second broad anchor. It restored all
originals, then the pattern was narrowed to the right crossing's before/after condition and
rerun. The same 20 semantic faults remain; no syntax/import failure counts as a kill.

Final media integrity: `node jobs/P24-haxball/hash-media.mjs` reports 172 files,
8,965,907 bytes < 10,000,000. Independent PowerShell Get-FileHash -Algorithm SHA256 verifies
all 172 digests with zero mismatches. Current guard source also passes `pnpm.cmd typecheck`.
