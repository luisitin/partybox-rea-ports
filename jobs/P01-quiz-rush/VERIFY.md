# P01 verification

## Current two-mode upgrade (2026-10-12, r1-local)

Current implementation is `games/kahoot`, derived from the pinned Lightning Round source in
`core-base/SOURCE.json`. The historical standalone checks below do not verify this implementation.
All local game executions use one thread worker; no repository-wide or whole-suite browser run.

| Check                                | Exact command                                                                                                                                                                                                                                                             | Current result                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install                              | `corepack enable`; `pnpm.cmd install --frozen-lockfile`                                                                                                                                                                                                                   | PASS; no added dependencies                                                                                                                                                                |
| Types                                | `pnpm.cmd typecheck`                                                                                                                                                                                                                                                      | PASS on the latest implementation                                                                                                                                                          |
| Focused screens/minigame/reload      | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/kahoot/__tests__/render-upgrade.test.tsx games/kahoot/__tests__/minigame-upgrade.test.ts games/kahoot/__tests__/stage-screens.test.tsx games/kahoot/__tests__/final-reload.test.tsx --maxWorkers=1 --pool=threads` | Latest PASS 33/33; 4 files; 14.58 s; reducer-backed fixtures and legal long-name cases included                                                                                            |
| Published SDK contract               | `pnpm.cmd vitest run games/kahoot/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads`                                                                                                                                                                                    | PASS 20/20; 25.27 s; exit 0; unmodified assertions                                                                                                                                         |
| Mutation check                       | `node jobs/P01-quiz-rush/mutate-upgrade.mjs`                                                                                                                                                                                                                              | PASS 20/20 behavioral kills; 72 baseline tests; zero invalid mutations; all 6 tested source hashes restored and rechecked                                                                  |
| Browser fit                          | `node jobs/P01-quiz-rush/capture.mjs`                                                                                                                                                                                                                                     | Latest PASS 78/78 at 1920×1080 and 390×844; zero overflow, clipping, scrollers or missing CSS; browser PID 112464 closed in finally; temporary profile cleanup deferred after EPERM        |
| Full game/SDK/properties/32,000 bots | `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads --reporter=default --reporter=json --outputFile=jobs/P01-quiz-rush/upgrade-tests.json`                                                                                        | Baseline PASS 224/224; 25 files; 481.32 s; exit 0; all SDK, 32,000 matches and property checks included                                                                                    |
| Format/CI/hashes                     | `pnpm.cmd format`; job P01 CI; `node jobs/P01-quiz-rush/hash-media.mjs`                                                                                                                                                                                                   | Baseline format PASS; 194 files / 7,373,326 bytes hashed; [initial CI PASS](https://github.com/luisitin/partybox-rea-ports/actions/runs/38225649131) at ca58d1b; round 1 artifacts pending |

The initial full run passed 196/227 tests and exposed an outdated 8-minute duration estimate,
stale fixtures/SSR clock assumptions, remote-phone lock text pointing at a TV, and SDK minigame
pool tests that require unrelated games. Those results are not counted as green. The estimate is
now 26 minutes. The unmodified published SDK contract remains imported with discovery restricted
to Kahoot!; dedicated game tests exercise the real SDK minigame wrapper for FFA/duel and its 100-second
play budget. Only unrelated pool-availability assertions are omitted. Bounded reducer loops make
phase-exit mutants fail behaviorally instead of hanging.

The first upgrade capture failed five inherited wager phone-only reveals. Separate chart and
standings beats plus compact final rows corrected them; final originals were checked by hand.
Black wager button text was an incomplete capture-shell reset, confirmed against pinned core
`packages/client/src/styles/global.css`; the shell now inherits the same token text colour.
An additional final-reveal case now covers 16 legal 40-character player names and five-digit
totals in tests and phone-only/remote/spectator captures. The latest four-file focused run passed 33/33
in 14.58 s, and the latest 78-frame capture is clean. Its owned browser PID 112464 closed in
`finally`; temporary profile cleanup remains deferred after Windows returned EPERM.

All 20 planted defects were caught: inflated base points; inflated speed bonus; inflated streak
cap; reduced streak growth; wrong-answer streak retention; double streak increments; wrong final
wager wins; points for wrong answers; collection completes on first pick; duplicate replacement;
wrong question id; wrong opening stamp; disconnected answer; deadline answer; early answer;
question timer cannot exit; reveal timer cannot exit; removed reading hold; asking-phase key leak;
all podium tiers unveiled immediately. `media/mutation-upgrade.json` records the failing behavioral
assertions and source hashes. `mutate.mjs` below belongs to the superseded standalone port.

The follow-up `pnpm.cmd vitest run games/kahoot/__tests__/sdk.test.ts --maxWorkers=1 --pool=threads`
passed all 20 unmodified SDK contract checks (25.27 s, exit 0). The sole failure in the prior
221/222 full run compared the canonical wager done fixture with the classic podium fixture.
The documented `lastScores` hint now selects `wager-final-reveal`, preserving same-match continuity
with canonical default-wager `done.json`; the classic podium remains a separate fixture. Added
continuation regressions cover both classic and wager matches. No contract assertion was skipped.

The complete simulation run passed 32,000/32,000 default-setting matches: 1,000 seeds at every count
1–16 in each mode, rotating easy/normal/sharp, the three classic packs, Spanish wager games and
phone-only rooms. The longest match was 1,566.388 s, below 26 × 120 = 3,120 s. Reports are
`media/sim-{classic,wager}-{1..16}.json`. Median round lengths (question plus automatic reveal) at
2/4/8/16 players: classic 52.171/56.933/66.024/84.205 s; wager 67.590/77.114/97.027/129.494 s.
Properties passed seeds 1, 2, 3 plus 1,000 sampled seeds per mode: 96,436 events and 1,205,348 views.
`media/property-upgrade.json` records seeds and invariants. The initial upgraded full rerun passed 224/224
in 25 files (481.32 s, exit 0). `media/verification-upgrade.json` records the result and test hashes.
Baseline repository formatting passed. Its 194 media files have SHA256 sums and total 7,373,326 bytes,
below 10 MB. The smallest captured touch target is 45.27×46.19 px; TV timers are 128 px.
Primary TV body text uses the 36 px or larger tokens; smaller metadata uses caption tokens.
Baseline runtime/capture source hashes and all six mutation source hashes matched the verified bytes.
[Initial CI run 38225649131](https://github.com/luisitin/partybox-rea-ports/actions/runs/38225649131)
passed at `ca58d1b`; PR #2 is ready. KEEP GOING round 1 is active: the combined long-Spanish-text /
streak-20 edge is being repaired, with 80 captures recorded so far. Final round metrics, regenerated
capture count and evidence remain pending; round 1 is not complete and no upgraded DONE claim is made.

## Owner-required upgrade baseline (2026-10-12)

The results below this section describe the superseded standalone Quiz Rush at 1c8d264. They do not verify the replacement Lightning Round upgrade in games/kahoot. Provenance is pinned in core-base/SOURCE.json and CHANGE_NOTES.md. No new install/dependency was needed.

`pnpm.cmd typecheck` passed on the imported 74-file baseline. `pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads --reporter=dot` passed 108 tests and failed one expected old recap-name assertion (17 files, 15.37 s); this is not a green suite. Updated that assertion to official Kahoot! and ran `pnpm.cmd vitest run games/kahoot/__tests__/content-es.test.ts --maxWorkers=1 --pool=threads --reporter=dot`:8/8 passed, 2.15 s, exit 0. Existing libraries and wagering are not yet claimed verified after classic changes. Fresh full contract/property/simulation/mutation/screen checks follow implementation.

## Historical standalone verification

Run r1-local on Windows 11, Node 24 and pnpm 12.4.2. `pnpm.cmd` is the Windows entry point
because this desktop blocks PowerShell shim scripts. No complete repository test suite was run.

| Check                              | Exact command                                                                                            | Result                                                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                            | `corepack enable`; `pnpm.cmd install`                                                                    | PASS; frozen workspace dependencies reused, no new dependencies                                                                                                                                       |
| Types                              | `pnpm.cmd typecheck`                                                                                     | PASS                                                                                                                                                                                                  |
| Game + SDK + property + simulation | `pnpm.cmd vitest run games/quiz-rush --maxWorkers=1 --pool=threads`                                      | PASS; 116 tests, 1 opt-in fixture-generation test skipped; exit 0, 87.96 s; separately generated fixtures and final 7000 simulations also pass                                                        |
| Published SDK contract             | Included by `games/quiz-rush/__tests__/sdk.test.ts` in the command above                                 | PASS; 20 unmodified SDK tests, discovery restricted to quiz-rush only                                                                                                                                 |
| Property tests                     | `pnpm.cmd vitest run games/quiz-rush/__tests__/properties.test.ts --maxWorkers=1` (also in game run)     | PASS; seeds 1, 2, 3 + 1000 independently sampled reproducible seeds; generated event traces, fuzz, immutable state, JSON, replay                                                                      |
| Mutations                          | `node jobs/P01-quiz-rush/mutate.mjs`                                                                     | PASS: 20/20 behavioral kills, zero invalid/load/syntax kills; 25 baseline tests green; original source hashes restored                                                                                |
| Formatting                         | `pnpm.cmd format`                                                                                        | PASS; all matched files formatted                                                                                                                                                                     |
| Screens                            | Opt-in `screens.test.tsx` renders; `node jobs/P01-quiz-rush/capture.mjs`                                 | 48 HTML/PNG frames and 57 SSR assertions pass; zero scrolling, clipping or missing CSS, including locked maximum text and eight tied long names; final pacing recapture and all 98 checksums complete |
| CI                                 | `.github/workflows/P01.yml`: install, types, format, this game's tests, ubuntu-latest, 30 min, read-only | PASS; final source run 38180027626, final artifact run 38180772871 and round-six run 38180856440; PR #2 ready; final review-only follow-up is checked on the PR                                       |

## Seeded bots

`simulation.test.ts` runs 1000 distinct seeds at **every** supported player count, rotating easy,
normal and sharp strengths and all three packs. One in ten matches has 20 questions, the others 10. All 7000/7000 matches finished with complete finite results before the 1200-second ceiling
(manifest estimate × 2). Round durations below include question, explanation and standings beats;
the final round includes the podium. Evidence: `sim-2.json` through `sim-8.json`.

| Players | Matches | Median round (s) | Longest match (s) |
| ------- | ------- | ---------------- | ----------------- |
| 2       | 1000    | 31.557           | 657.602           |
| 3       | 1000    | 33.361           | 715.391           |
| 4       | 1000    | 34.956           | 768.915           |
| 5       | 1000    | 36.487           | 800.523           |
| 6       | 1000    | 38.093           | 825.489           |
| 7       | 1000    | 40.276           | 867.659           |
| 8       | 1000    | 41.970           | 907.200           |

## Reproducibility

Fixtures come from a single fully played eight-seat match via:
`$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/generate.test.ts --maxWorkers=1`.
The SDK checks that `done.json` is the podium fixture played to completion. Mutations restore the
exact original bytes in `finally`; `mutation-results.json` lists all planted defects and failing
behavioral tests. CI skips fixture/media generation and checks the committed artifacts instead.

Final fixtures and simulations were regenerated together with
`$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/generate.test.ts games/quiz-rush/__tests__/simulation.test.ts --maxWorkers=1 --pool=threads`:
8 tests passed, exit 0, 69.05 s. A focused default-fork run passed all 31 assertions but failed
Windows worker cleanup and ended at -1 after its verified owned process tree was terminated;
that command is not counted as green. Final local verification uses one thread worker. Linux CI
keeps its default pool. The new reveal regression counts actual phone-rendered text and checks
433–1732 ms of formerly omitted repeated-answer reading time.

Screen evidence command: `$env:PB_WRITE_EVIDENCE='1'; pnpm.cmd vitest run games/quiz-rush/__tests__/screens.test.tsx --maxWorkers=1 --pool=threads`, then `node jobs/P01-quiz-rush/capture.mjs`, `pnpm.cmd exec prettier --write jobs/P01-quiz-rush/media`, and `node jobs/P01-quiz-rush/hash-media.mjs`.
One owned headless Chrome process captures sequentially and closes in `finally`. Static renders
settle SDK animation hooks for readable final frames; actual components, views and module CSS run.
Independent visual review covers all 48 frames. TV body text is at least 32.736 px; the smallest
answer target is 173 × 210.7 px. Phones reserve an 84 px header and 48 px footer. No second browser
or whole-suite browser run was started. SHA256SUMS covers all 98 media files (5,629,999 bytes), below 10 MB.
The final 57-assertion SSR run exited 0 in 254.50 s under shared-desktop load. Two file-navigation
capture attempts timed out and closed their owned browsers; the final capture loaded each exact
self-contained HTML fixture with CDP `Page.setDocumentContent` and completed all 48 frames.
The final capture command exited 0.
Its finally block terminated only its owned browser tree (PID 103932); a subsequent native process
check confirmed `HasExited=True` and no owned children. The five-second in-tool exit verifier timed
out under load, so the temporary profile was conservatively preserved. No game assertion or fit
failure was hidden by this cleanup delay.

No secrets, tracking, runtime network calls, imported artwork or imported audio. Original live
play was unavailable; source reconstruction is explicitly recorded in RESEARCH/ASSUMPTIONS.
