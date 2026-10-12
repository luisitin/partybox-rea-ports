# P01 verification

## Current two-mode upgrade (2026-10-12, r1-local)

Round-4 `1333563` [CI 38241666750](https://github.com/luisitin/partybox-rea-ports/actions/runs/38241666750)
is green. Round 5's stakes repair is applied and locally verified; final format/hash/push/head CI
remain pending. No three-no-gain completion or DONE is claimed. All executions remain game-only,
one thread worker and one owned browser closed in finally.

| Check                         | Command / evidence                                                                   | Current result                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                       | `corepack enable`; `pnpm.cmd install --frozen-lockfile`                              | PASS; no added dependencies                                                                                                                                      |
| Types                         | `pnpm.cmd typecheck`                                                                 | Round-5 PASS session 32345                                                                                                                                       |
| Focused render/SSR            | Game-only Vitest with `--maxWorkers=1 --pool=threads`                                | PASS 43 tests/3 files; final ten-renderer file PASS after the last CSS/helper corrections                                                                        |
| Full game/SDK/properties/bots | `pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads` with JSON reporting | PASS 242/242; 26 files; 484.58 s; session 37496 exit 0; SDK/properties/simulations included                                                                      |
| Mutations                     | `node jobs/P01-quiz-rush/mutate-upgrade.mjs`                                         | Pacing PASS 20/20, 72-test baseline, restored; current six restoration hashes match tested server source                                                         |
| Browser fit                   | `node jobs/P01-quiz-rush/capture.mjs`                                                | Session 50244 PASS 95/95 current; one labelled 85-clipped Finale baseline, 96 records total. Browser PID 52968 closed in finally; EPERM profile cleanup deferred |
| Format/hash/CI                | `pnpm.cmd format`; media hashes; P01 workflow                                        | Final round-5 format, stable source/media hashes, push and resulting-head CI pending; checkpoint 8,710,478 B before loop-5 JSON                                  |

### Round-5 applied source and measured gain

Five weaknesses: stakes identification, numeric density, extreme names, brief intro and wait
perception. Thirteen–sixteen-seat stakes now use game-owned four-column/two-line 32 px cards
for name/rank/score/placed; twelve or fewer retain the SDK board. Runtime edits are Tv.tsx,
Tv.module.css and Spanish strings. Native normal stakes names improve four ellipses → zero,
with 416 px name space; all sixteen scores/placed marks remain visible. Spanish twenty-question,
legal 40-character names, five-digit leader/score and all-placed cases pass the current capture.
`media/loop-5-stakes-fit.json` and archived `loop-5-stakes-before-tv.png` record the comparison.

First capture session 39757 failed with 20 clipped last-row items under a long Spanish leader.
The correction uses div.wagerStage specificity against SDK Stage plus wrapping 32 px rules.
Capture helper now also uses exact pinned global.css:99–105 .pb-muted/.pb-caption rules.
Final session 50244 passes all 95 current frames; 96 records include the separate deliberate
Finale before baseline. The earlier 90/91 PNG-byte-identity comparison belongs to round 4,
before this caption/reset correction, and is not claimed for the current recapture.
Browser PID 52968 closed in finally; EPERM deferred only temporary-profile cleanup.

Full 37496 PASS 242/242, 26 files, 484.58 s, exit 0. Raw report:
`r1-local-kahoot-loop5-tests-20261012.json`. Runtime JS/server stayed frozen throughout;
Tv.module.css and upgrade-evidence.ts changed early while properties ran. Do not claim the
round-4 93-file before/after freeze for this run. `media/verification-upgrade.json` explicitly
records those two before/after SHA values. The ten-renderer file ran after the final fixes and
the current recapture verifies the painted UI; current 77 capture-source/six restoration hashes
match. Typecheck 32345 PASS. Latest independent twelve-sheet/native phone/stakes QA found no
remaining concrete visual defect. Fresh final-head CI remains required for the final source.

Checkpoint media is 8,710,478 B before the loop-5 JSON; format/stable final hashes must record
the complete payload and decimal 10,000,000 B cap. Root will push after those checks. No future
CI PASS or no-gain result is implied; three consecutive no-gain walkthroughs remain required.

### Round-4 green baseline

Source 1333563/claim 3addcbb passed full 241/241, 26 files, 534.17 s; type/format and 235-file/
8,279,090 B hashes passed. All 93 then-frozen game/test, 77 capture and six restoration hashes
matched. Finale same-state clipped items fell 85 → zero; 94 current captures passed plus one
labelled before baseline. PID 87684 closed, profile cleanup deferred. The 90/91 old PNG identity
comparison and twelve-sheet/native review belong to that pre-caption-correction baseline.
CI 38241666750 is green; these old freeze/artifact counts do not verify the later round-5 source.

### Completed round-3 pacing baseline

The server removed only the obsolete reveal minimum combining choices/roster words from disjoint
old phone layouts, retaining 2 s settling plus max actual TV/phone/staged reading floors and the
original scoring window. Eight-seat regressions improve EN 58,063 → 53,734 ms (4,329 ms saved)
and ES 63,257 → 56,331 ms (6,926 ms saved). Full session 36474 PASS 240/240, 26 files, 881.47 s,
exit 0; 32,000 bots and 2,006 property seeds regenerated. Mutation session 84630 PASS 20/20,
72-test baseline, exit 0, source restored. Raw report: `round3-tests-20261012.json` in local temp.
Typical wager medians improve eight-player 84,906 → 84,473 ms (433 ms) and sixteen-player
115,642 → 113,910 ms (1,732 ms); longest sixteen-player match remains 1,425,695 ms.

The `8cb7355` push omitted a regenerated fixture, an avoidable incomplete milestone by root;
[CI 38238453616](https://github.com/luisitin/partybox-rea-ports/actions/runs/38238453616) failed its
deadline comparison (108,498 versus 103,736). Root added the fixture at `df5322a`, then
[CI 38238947209](https://github.com/luisitin/partybox-rea-ports/actions/runs/38238947209) failed
formatting 21 fixtures. Root formatted/pushed `bd91828` and
[CI 38239089152](https://github.com/luisitin/partybox-rea-ports/actions/runs/38239089152) passed.
Both failures remain recorded; the later green verifies pacing, not the new Finale/copy source.

### Completed round-2 baseline

The full run passed 32,000 seeded matches: 1,000 at every count 1–16 in each mode, rotating
strengths, packs, Spanish wager content and staged phones. Properties passed 1,003 seeds per mode
(2,006 total), 96,436 events and 1,205,348 views. All 20 fresh mutations were behavioral kills
against 72 baseline tests, with zero invalid mutations and source restored. The raw full report is
`C:/Users/luisi_xlnbc7h/AppData/Local/Temp/r1-local-kahoot-round2-tests-20261012.json`;
`media/verification-upgrade.json` and `media/loop-2-fit-pacing.json` record this baseline.

Separate wager chart/race and ranked standings removed repeated question text. Median wager
rounds improved at eight players 97,027 → 84,906 ms (12,121 ms saved), and at sixteen
129,494 → 115,642 ms (13,852 ms saved). The longest sixteen-player wager match improved
1,566,388 → 1,425,695 ms, below 26 × 120 = 3,120 s. These numbers precede the round-3 repair.

Capture uses licensed Nunito Variable, pinned global h2/reset rules, a 692 px TV Stage/626 px
inner area and the 60 px VIP phone header/27.6 px counter/4 px bar without an invented footer
or extra timer. Intro/reveal/podium strips hide names/scores without freeing their height.
All 91 round-2 frames pass, including all-seat totals, wide paired/3+ tied podiums, small rooms,
EN/ES streak-20 races and the later rank separator. Browser PID 39756 closed in finally.
Shared adjacent token/font assets prevent repeated CSS. Final baseline hashes cover 226 media
files/9,843,669 B, below decimal 10,000,000 B; all 76 source, six restoration, font and token
hashes matched. Round-3 source/capture/evidence changes require new hashes and a new cap check.

### Earlier upgrade attempts and baseline evidence

The following preserves earlier diagnostics and green baselines. Their dates/counts/frame sizes
are historical; the current result and pending gates are above.

The initial full run passed 196/227 tests and exposed an outdated 8-minute duration estimate,
stale fixtures/SSR clock assumptions, remote-phone lock text pointing at a TV, and SDK minigame
pool tests that require unrelated games. Those results are not counted as green. The estimate is
now 26 minutes. The unmodified published SDK contract remains imported with discovery restricted
to Kahoot!; dedicated game tests exercise the real SDK minigame wrapper for FFA/duel and its 100-second
play budget. Only unrelated pool-availability assertions are omitted. Bounded reducer loops make
phase-exit mutants fail behaviorally instead of hanging.

The first upgrade capture failed five inherited wager phone-only reveals. Separate chart and
standings beats plus compact final rows corrected them in the standalone capture harness.
Black wager button text was an incomplete capture-shell reset, confirmed against pinned core
`packages/client/src/styles/global.css`; the shell now inherits the same token text colour.
An additional final-reveal case now covers 16 legal 40-character player names and five-digit
totals in tests and phone-only/remote/spectator captures. An earlier four-file focused run passed 33/33
in 14.58 s, and its 78-frame standalone capture was clean. Its owned browser PID 112464 closed in
`finally`; temporary profile cleanup remains deferred after Windows returned EPERM.

Round 1 is complete: default sixteen-seat race-name truncations fell from 15 to 0 in the old
harness (name space 65 → 337 px, body 36 px, delta 32 px), and combined longest EN/ES text with
streak 20 was repaired. The 82 resulting frames were clean only in that fake 900 px TV stage;
their zero-overflow and safe-margin results do not prove fit inside the actual PartyBox host.
Round 2 then identified the pinned actual host's smaller Stage: a 133.2 px header, 152.8 px player
strip, 22 px bar and 80 px footer leave about 692 px, or 626 px inside Stage. At that checkpoint
root was recreating the chrome; repairs, tests and captures were pending. The current results
above supersede that checkpoint; the old standalone fit figures remain historical.

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

The earlier baseline simulation run passed 32,000/32,000 default-setting matches: 1,000 seeds at every count
1–16 in each mode, rotating easy/normal/sharp, the three classic packs, Spanish wager games and
phone-only rooms. The longest match was 1,566.388 s, below 26 × 120 = 3,120 s. Reports are
`media/sim-{classic,wager}-{1..16}.json`. Median round lengths (question plus automatic reveal) at
2/4/8/16 players: classic 52.171/56.933/66.024/84.205 s; wager 67.590/77.114/97.027/129.494 s.
Properties passed seeds 1, 2, 3 plus 1,000 sampled seeds per mode: 96,436 events and 1,205,348 views.
`media/property-upgrade.json` records seeds and invariants. The initial upgraded full rerun passed 224/224
in 25 files (481.32 s, exit 0). `media/verification-upgrade.json` records the result and test hashes.
Baseline repository formatting passed. Its 194 media files had SHA256 sums and total 7,373,326 bytes,
below 10 MB. In that standalone harness, the smallest captured touch target was 45.27×46.19 px;
TV timers were 128 px. Primary TV body text used 36 px or larger tokens, with captions for metadata.
These measurements do not establish fit at the actual host's smaller Stage height.
Baseline runtime/capture source hashes and all six mutation source hashes matched the verified bytes.
[Initial CI run 38225649131](https://github.com/luisitin/partybox-rea-ports/actions/runs/38225649131)
passed at `ca58d1b`. After round 1, full checks passed 226/226 in 25 files, 196.07 s, and
[CI run 38229318876](https://github.com/luisitin/partybox-rea-ports/actions/runs/38229318876)
passed at `4cf1a53`. These initial/post-round-1 results are historical baseline evidence for
PR #2. They do not establish CI success for the current `e189d22` source milestone.

## Owner-required upgrade baseline (historical, 2026-10-12)

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
