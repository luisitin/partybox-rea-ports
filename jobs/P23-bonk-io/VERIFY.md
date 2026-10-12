# Verification

Install once completed during P07: `corepack.cmd enable`; `pnpm.cmd install`. Windows script policy requires cmd shims. P23 adds no dependency.

Root ran only `games/bonk-io` tests with one worker. No whole-suite tests/browser run. Expanded all-size simulations run in scoped CI after local pilots to preserve desktop CPU. The full baseline batch is green; the R1 client changes require a fresh green head before readiness or convergence.

## Checks and contracts

- `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: passed and generated four real phase fixtures from a seeded eight-bot match. The first build incorrectly saved the first-round score fixture; the real SDK rejected it. It now saves the fifth-round verdict, whose timer produces the exact done fixture.
- `PB_SIM_GAMES=3 PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/bonk-io --maxWorkers=1`: **99/99 tests in 10 files**, 51.75 s. Includes 1,003 property traces and 21 full seeded pilot matches, three per player count. Historical local-pilot.log and simulation-results retain this partial-batch provenance; they do not count as the required full batch.
- `pnpm.cmd vitest run games/bonk-io/__tests__/contract.test.ts --maxWorkers=1 --reporter=verbose`: **20/20 real SDK contracts**, 1.80 s, including purity, deterministic replay, fuzz/stale events, all presence/phone-only combinations and fast/random/idle/skipper schedulers.
- Latest focused build: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/server games/bonk-io/client games/bonk-io/__tests__/game.test.ts games/bonk-io/__tests__/contract.test.ts games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: **97/97 in 8 files**, 4.24 s. Includes neutral-release timestamps, optimized symmetric contacts, truthful skipped-draw copy, modified-key rejection, all hold-release lifecycle paths and regenerated artifacts.
- `pnpm.cmd typecheck` and `pnpm.cmd format`: passed after shortening an over-limit manifest instruction and correcting two test-only type annotations. No policy or dependency changes.
- R1: `PB_BUILD_ARTIFACTS=1 pnpm.cmd vitest run games/bonk-io/client games/bonk-io/__tests__/artifacts.test.tsx --maxWorkers=1`: **46/46 in 5 files**, 2.21 s; `pnpm.cmd typecheck` passed. Five new regressions cover the final-round countdown, differing round/match winners, draw/shared verdict context and immediate Jump feedback/release.

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

`node jobs/P23-bonk-io/tools/capture.mjs`: **39 PNG screens**, TV 1920×1080 and phones 390×844 with 80 px shell reservations at both ends. Every phase includes local/stage/remote/spectators; stress variants cover out, pause, permanent departure, adjacent heavy balls, long names, a real host-skipped draw with eight survivors and a true idle round at 20 seconds with shrinking platforms. One isolated cached Chromium, closed in finally; no browser installed, no server remains.

R1 fresh fit report: **zero overflow, outside elements or internal scrolling**; smallest active control **88 px**, smallest captured ball digit **16.775 px**. Initial independent review covered all 39 captures through 28 unique groups and three contact sheets. Root manually reviewed the larger long-name final standings and final TV context; a second independent review checks the recaptured groups. Ranked phone text increased 14 to 18 px and rows 28 to 40 px. SHA256SUMS covers every final media byte; media remains below 10 MB.

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

P23 workflow uses read-only permissions, Ubuntu, 30-minute limit and actions/* only. It installs, typechecks, formats and runs only this game, then prints exact generated simulation/property evidence. Draft [PR #16](https://github.com/luisitin/partybox-rea-ports/pull/16) triggered the successful baseline. It remains draft until fresh R1 CI passes. Post-green iterations go in LOOP.md; no convergence claimed yet.
