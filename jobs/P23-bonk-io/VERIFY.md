# Verification

Install once completed during P07: `corepack.cmd enable`; `pnpm.cmd install`. Windows script policy requires cmd shims. P23 adds no dependency.

Root ran only `games/bonk-io` tests with one worker. No whole-suite tests/browser run. Expanded all-size simulations run in scoped CI after local pilots to preserve desktop CPU. Baseline, R1 and R2 full batches are green; R3 requires fresh full CI and current-source mutations before readiness or convergence.

## Checks and contracts

- `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: passed and generated four real phase fixtures from a seeded eight-bot match. The first build incorrectly saved the first-round score fixture; the real SDK rejected it. It now saves the fifth-round verdict, whose timer produces the exact done fixture.
- `PB_SIM_GAMES=3 PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/bonk-io --maxWorkers=1`: **99/99 tests in 10 files**, 51.75 s. Includes 1,003 property traces and 21 full seeded pilot matches, three per player count. Historical local-pilot.log and simulation-results retain this partial-batch provenance; they do not count as the required full batch.
- `pnpm.cmd vitest run games/bonk-io/__tests__/contract.test.ts --maxWorkers=1 --reporter=verbose`: **20/20 real SDK contracts**, 1.80 s, including purity, deterministic replay, fuzz/stale events, all presence/phone-only combinations and fast/random/idle/skipper schedulers.
- Latest focused build: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/server games/bonk-io/client games/bonk-io/__tests__/game.test.ts games/bonk-io/__tests__/contract.test.ts games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: **97/97 in 8 files**, 4.24 s. Includes neutral-release timestamps, optimized symmetric contacts, truthful skipped-draw copy, modified-key rejection, all hold-release lifecycle paths and regenerated artifacts.
- `pnpm.cmd typecheck` and `pnpm.cmd format`: passed after shortening an over-limit manifest instruction and correcting two test-only type annotations. No policy or dependency changes.
- R1: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/client games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: **46/46 in 5 files**, 2.21 s; `pnpm.cmd typecheck` passed. Five new regressions cover the final-round countdown, differing round/match winners, draw/shared verdict context and immediate Jump feedback/release.
- R1 full [CI 38200031558](https://github.com/luisitin/partybox-rea-ports/actions/runs/38200031558), head `ef6012e041319257014a393214e350d415149dfb`: **110/110 in 10 files**, 107.28 s, all 7,000 matches and 1,003 traces passed. `tools/r1-scoped-ci.json` retains exact evidence; subsequent R2 sources differ as its hashes correctly report.
- R2 focused artifact/server/client/game/contract command above: **111/111 in 8 files**, 11.39 s; `pnpm.cmd typecheck` passed. Six new server regressions cover nongrid release barriers, bounded neutral releases, long paused drops and permanent departure; three SSR regressions distinguish final/earlier-round elimination and retired seats. Mutation definitions 16/17 follow the changed call signatures; fresh mutation/full-CI results remain pending.
- R2 full [CI 38200726369](https://github.com/luisitin/partybox-rea-ports/actions/runs/38200726369), head `5ef7f1bb90127051f965cd34f411a8c1b8a2f0f5`: **119/119 in 10 files**, 148.37 s, all 7,000 matches and 1,003 traces passed. `tools/r2-scoped-ci.json` retains historical source-hashed evidence.
- R3 rejected 40 ms snapshot candidate: own-game one-match-per-size/property pilot **123/127 passed**, 46.94 s. Three real SDK schedulers exceeded the unchanged 5,000-event budget; one SSR assertion incorrectly counted an accessibility label as visible text. Exact 200 ms bot marks still exceeded the eight-seat event budget and risked missing asynchronous host samples. Final code uses 80 ms snapshots and decision buckets; no SDK contract, deadline cap or event limit was changed.
- R3 final local command: `PB_SIM_GAMES=1 PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/server games/bonk-io/client games/bonk-io/__tests__/game.test.ts games/bonk-io/__tests__/contract.test.ts games/bonk-io/__tests__/artifacts.test.tsx games/bonk-io/__tests__/simulation.test.ts --maxWorkers=1`: **128/128 in 9 files**, 17.26 s. Includes all 20 real SDK contracts and seven full pilot matches at 2–8 seats. `pnpm.cmd typecheck` passed. Full R3 properties/simulations will run in scoped CI.

## Simulations and properties

The pilot played **21 matches / 105 rounds**: 104 last-standing wins, one draw, no timeout. Per-count median round ms: 2=23,440; 3=26,440; 4=26,600; 5=26,000; 6=27,200; 7=27,120; 8=27,440. Maximum whole match 175,400 ms, below the manifest estimate × 2 (480,000 ms). Every result retained all seats with finite points/ranks. These are pilot observations, not the required 1,000-per-count result.

Property source runs seeds 1,2,3 plus 1,000 reproducibly generated seeds; each trace varies 2–8 seats and 128 events. It checks frozen input/state purity, paired replay, finite bounded physics, 0–5 scores, exact pause shifts, temporary drops, permanent departure churn, invalid input, outsiders and stale timers. The local full property check passed inside the 99-test pilot. CI writes and prints the exact trace count/event total.

Full baseline [CI 38199152567](https://github.com/luisitin/partybox-rea-ports/actions/runs/38199152567), head `5ecd63010ce0b37a390e17760e0e97f132df1056`: **105/105 tests in 10 files**, 190.79 s. **7,000 full matches / 35,000 rounds** passed, with 1,000 seeds per count and easy/normal/sharp counts 334/333/333. **1,003 property traces / 128,384 events** passed. `tools/initial-scoped-ci.json` retains exact results and source hashes; its false current-head flag correctly identifies the subsequent client changes, not a test failure.

| Players | Matches | Median round ms | Maximum match ms | Last standing / draw / timeout | Shared match wins |
| ------- | ------- | --------------- | ---------------- | ------------------------------ | ----------------- |
| 2       | 1,000   | 26,240          | 178,000          | 4,951 / 49 / 0                 | 15                |
| 3       | 1,000   | 25,840          | 174,400          | 4,974 / 26 / 0                 | 359               |
| 4       | 1,000   | 26,400          | 176,200          | 4,976 / 24 / 0                 | 355               |
| 5       | 1,000   | 26,600          | 176,200          | 4,963 / 37 / 0                 | 291               |
| 6       | 1,000   | 26,760          | 177,200          | 4,966 / 34 / 0                 | 320               |
| 7       | 1,000   | 26,920          | 177,200          | 4,953 / 47 / 0                 | 343               |
| 8       | 1,000   | 27,040          | 177,400          | 4,959 / 41 / 0                 | 349               |

All maximum whole matches are below 480,000 ms. Every match produces finite retained-seat points/ranks. Timed platform pressure finishes ordinary rounds before the hard cap; ties at match level remain intentional after five rounds.

## Screens

R3 full [CI 38202130126](https://github.com/luisitin/partybox-rea-ports/actions/runs/38202130126), head `4ad90adc18a7653d386f59c8cafb340ed6c49cdc`: **129/129 in 10 files**, 188.75 s, 7,000 matches and 1,003 traces passed. All reports show 80 ms snapshots, 200 ms decision targets and actual 160/240 ms spacing. Median rounds ms: 2=26,120; 3=25,880; 4=26,520; 5=26,560; 6=26,760; 7=26,920; 8=27,040. Maximum match 176,840 ms, below 480,000. `tools/r3-scoped-ci.json` retains historical evidence; subsequent UI/instrumentation changes correctly differ in its hashes.

R4 focused artifact/server/client/game/contract command above: **124/124 in 8 files**, 10.00 s; typecheck passed. Three new SVG regressions cover above-arena alive/partial/crowded identity, no dead revival and final number-layer order. Two authored stress captures added: **44/44 fit**, controls at least **88 px**, root manually reviewed both markers. Natural launch frequency remains unclaimed pending the minimum published alive-y metric. Current-source mutations/final CI remain pending.

`node jobs/P23-bonk-io/tools/capture.mjs`: **42 PNG screens**, TV 1920×1080 and phones 390×844 with 80 px shell reservations at both ends. Every phase includes local/stage/remote/spectators; stress variants cover out, pause, permanent departure, adjacent heavy balls, long names, a real host-skipped draw with eight survivors and a true idle round at 20 seconds with shrinking platforms. R2 adds three true fifth-round out screens collected from the same seeded match, rather than changing a first-round fixture's number. One isolated cached Chromium, closed in finally; no browser installed, no server remains.

R2 fresh fit report: **zero overflow, outside elements or internal scrolling**; smallest active control **88 px**, smallest captured ball digit **16.775 px**. Initial independent review covered all 39 captures through 28 unique groups and three contact sheets. Root manually reviewed the larger long-name final standings, final TV context and three added fifth-round out screens; a second independent review checked the recaptured groups and identified the final-out correction. Ranked phone text increased 14 to 18 px and rows 28 to 40 px. SHA256SUMS covers every final media byte; media remains below 10 MB.

R3 recaptured **42/42 fits**, controls at least **88 px**; live/ready roster text also now 18 px/40 px rows. Root reviewed the phone-only spectator and shrinking-platform controls with their new round context. `motion-report.json` comes from the same single finally-closed browser: the CSS transition is exactly **0.08 s**, both layers move from x=499.565 through the 40 ms midpoint x=519.565 to x=539.565, with identical y=372. Pause, app motion-off and OS reduced motion each report **0 s**. This verifies browser interpolation, not original live gameplay or a device frame-rate measurement. 92 media files are about 4.57 MB; all final bytes are hashed after formatting.

## Mutation check

`node jobs/P23-bonk-io/tools/mutate.mjs`: **20/20 caught by failed assertions**, no compiler-only catches. Clean baselines before/after passed **90/90**. Each replacement was unique, compile-valid and applied serially; every original byte was restored in finally and hashes matched. mutation-results.json retains exact source replacements, failing test names/messages and restoration hashes. No secret gameplay data exists; the visibility/identity cases target stage omission and spectator impersonation rather than inventing hidden information.

1. Movement acceleration is disabled - caught.
2. Gravity is disabled so a jump never lands - caught.
3. A grounded normal jump has no impulse - caught.
4. Heavy gains a higher jump instead of trading mobility away - caught.
5. Heavy loses its bump resistance and impulse transfer advantage - caught.
6. Shrinking starts ten seconds late - caught.
7. The bottom fall plane kills balls inside the arena and spares fallen balls - caught.
8. A neutral release fails to record its time allowing an older hold to override it - caught.
9. The physics control helper accepts a control older than its latest accepted input - caught.
10. The sole surviving ball is denied its round win - caught.
11. Survivors at the exact hard cap lose their declared shared point - caught.
12. Entering the same score verdict twice double credits the win - caught.
13. Round five starts an illegal sixth round instead of ending the match - caught.
14. A timer for another phase instance advances the live physics beat - caught.
15. Permanent leave and kick stop being recorded for later rounds - caught.
16. Temporary disconnect keeps movement and Heavy held - caught.
17. Pause retains held movement and Heavy after the room resumes - caught.
18. Resume moves the end clock but leaves the physics start unshifted - caught.
19. Phone only players lose their public arena stage during play - caught.
20. Spectators inherit the first player identity and role instead of watching - caught.

## CI and convergence

P23 workflow uses read-only permissions, Ubuntu, 30-minute limit and actions/* only. It installs, typechecks, formats and runs only this game, then prints exact generated simulation/property evidence. Draft [PR #16](https://github.com/luisitin/partybox-rea-ports/pull/16) triggered successful baseline/R1/R2 CI. It remains draft until final R3 CI and current-source mutations pass. Post-green iterations go in LOOP.md; no convergence claimed yet.
