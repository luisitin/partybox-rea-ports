# P01 handoff

## Resumed locally (2026-10-12, r1-local)

- P01 remains the unfinished r1-local claim; P22 is DONE. Continue `job/P01-quiz-rush`; dependencies have no additions and the owner's core checkout is read-only. Pacing head `bd91828` is green; last recorded claim refresh `646f3a0`. New Finale/copy source awaits final push/CI.
- Round 3 pacing is complete: [CI 38239089152](https://github.com/luisitin/partybox-rea-ports/actions/runs/38239089152), local 240/240 tests in 26 files/881.47 s, 32,000 simulations/2,006 property seeds and fresh 20/20 mutations against 72 baseline tests with restored source. Eight-/sixteen-player wager median gains are 433/1,732 ms. The omitted fixture and 21-format CI failures were corrected before that green; retain their history in VERIFY.md.
- Round 4 fixes Finale host fit and misleading Classic start text. EN/ES instructions distinguish Classic podium/Wager final bet. Real Results Stage is 866.8 px/758.8 px inside, including winner hero/recap. All sixteen bet/delta/total rows remain at 32 px.
- Current capture PASS 94/94, zero overflow/clipped/unstyled elements/scrolling. A deliberately labelled same-state before-repair baseline has 85 clipped items, giving 95 records total. Ninety earlier PNGs are byte-identical to `e189d22` except the separate standings rank-separator change. Shared `evidence.css` avoids duplicate CSS; media checkpoint is 235 files/8,279,094 B.
- Browser PID 87684 verified closed in finally. Temporary profile cleanup is deferred after Windows EPERM; it is not a live browser. Typecheck 41896 PASS; current SSR 42/42 and the nine-renderer follow-up PASS after guards/type fixes.
- Current full session 60859 remains active (expected 241 tests/26 files, not a result), without PB_WRITE_EVIDENCE so formatted fixtures stay intact. Current runtime differs from the pacing baseline; stable fresh hashes, final formatting, source/artifact push and resulting-head CI remain pending. No no-gain rounds or DONE are claimed.

Next actions:

1. Finish session 60859 and record actual test count/files/time/exit. Keep the 95 capture records separated into 94 current PASS plus one deliberate before-repair baseline.
2. Finish current format and stable source/capture/media hashes; verify all-media bytes below 10,000,000 B. Preserve the confirmed browser closure and record EPERM profile cleanup as deferred. Carry mutation evidence only with matching tested-source/restoration hashes.
3. Push Finale/copy sources and artifacts/docs, pull --rebase before refreshing P01's claim, and refresh PR #2 from the job README. Require CI at that resulting head; `bd91828` green verifies pacing only.
4. Finish round 4's measured-gain/full/CI record and continue fresh five-weakness walkthroughs until three consecutive no-gain rounds pass. None is claimed yet; historical standalone rounds do not count. DONE requires that loop and all final-head checks.

Root owns one test worker and one headless browser closed in finally. Current full/head CI,
final hashes/format, three no-gain rounds and DONE remain pending.

## Owner-required upgrade baseline (historical context)

The following records the initial upgrade assignment and imported baseline. Its draft status,
implementation instructions and pending checks are historical; current resume status is above.

- P22 completed first: PR15 ready, head9ea55b4 passed CI38212237338, claimDONE. P01 reopened r1-local on main at 2026-10-12; PR2 returned to draft. Branchjob/P01-quiz-rush merged fresh main for official naming/overlap requirements.
- Canonical module games/kahoot now derives from existing core games/lightning-round, frozen core HEAD6ce46e613d3705624a56647592979613c4d6e468, game commit d0b89e3a89f40250349e2233fffe056960febb94. Source/change/migration provenance in core-base/. Owner core checkout remains read-only.
- Former Quiz Rush module is archived locally at C:/Users/luisi_xlnbc7h/AppData/Local/Temp/pb-p01-legacy-58d0f91e6672498bb69db8becd391260/quiz-rush and in git at 1c8d264284d13ea7d35f58bf63f7708df04e1de2. Reuse its 60 authored questions/shape assets, not its duplicate engine.
- Imported baseline typecheckPASS. First game-only run108/109 tests passed; sole failure expected old recap title. Corrected title expectation, then 8/8 Spanish tests passed. No complete upgraded-game result claimed. No owned browser or test worker remains.
- Implement additive quizMode:wager(default/legacy)|classic and classicPack:general|movies|science, preserving1–16/wager/EN+ES/streak 300/custom bets/minigame. Add stamped answers, exactly requested classic questions, mode-aware final predicates, partial3→2→1 podium and spectator/remote stage. Hide future podium scores/rows/ranks by omission, including generic envelope chips.
- Server agent owns server/content/manifest and classic-server tests; client agent owns client and classic-screens/stage-screens tests after shared view contract. Root owns docs/workflow/contract/property/simulation/fixture/evidence tools and all executions. One worker; root owns at most one browser closed in finally.
- CI path now games/kahoot. Fresh verification must cover 1000 matches at every count 1–16 in both modes (32000), three strengths, 1003 property seeds, 20 meaningful mutations, all-phase/adversarial screens and fresh hashes. Old 116-test/7000-match/media/loop results below are historical and do not verify the replacement.
- New KEEP GOING loop starts after upgraded PR is green; old three no-gain rounds cannot release this reopened claim. Push milestones within 30 minutes and refresh P01 claim after every push with pull--rebase.

## Historical standalone port

- Run: r1-local; branch job/P01-quiz-rush.
- Claim committed on main. corepack enable and pnpm install completed (Windows uses pnpm.cmd).
- Reference and contract/design docs read. Original research complete from paired official and independent sources; live play unavailable and documented.
- Server, original 60-question content and client implemented and independently reviewed.
- Types green; 7000 bots at every supported count finish; 1003 property seeds pass.
- Mutation rerun catches all 20 bugs with behavioral assertions, zero invalid mutations; source bytes restored.
- 48 all-phase/adversarial frames fit without scrolling or clipping, including locked maximum text; independent visual review passes every frame.
- Required visible-text floors now include question/reveal/standings/podium and animation settling; regenerated 7000 simulations pass, longest match 907.2 seconds under the 1200-second ceiling.
- Final pacing capture and 20/20 mutation rerun are complete; all restored hashes match. Typecheck, format and all 116 game tests pass.
- PR https://github.com/luisitin/partybox-rea-ports/pull/2 is ready; final source CI run 38180027626 passed all checks. First milestone pushed at 21:13 UTC.
- KEEP GOING rounds 1–3 fixed departed-seat controls, phone-only waiting feedback and movie variety. The movie pack spans sixteen films, with sixty matched facts overall. Final media includes the updated SDK CSS and all 98 checksums, under 10 MB.
- Round 4 is verified: all three science answer cues removed; astronomy 10 → 6/20, geography 9 → 7/20. The phone reveal budget includes its repeated correct answer (433–1732 ms) and a real rendered-text regression. Stage hint and minimum-seconds label copy are corrected. Types, all 116 game tests and all 57 SSR assertions pass with clean exits. Nine fixtures and 7000 simulations regenerated; longest match 907.2 s. All 48 final frames fit; 98 media files total 5,629,999 bytes and have fresh checksums. Capture loads standalone HTML directly to avoid Windows file-navigation stalls, and its owned browser tree is verified closed. Windows default-fork cleanup failure is recorded separately; local checks use one thread worker.
- A sparse temporary main worktree handles claim updates without switching the active game's checkout during captures. No other runner's branch or process is changed.
- Capture agent owns at most one headless browser and closes it in finally; root started none.
- KEEP GOING rounds 5–7 found no demonstrated player-visible repair: mechanics, all sixty sourced facts, and final TV/phone/phone-only screens were independently reviewed. Three consecutive no-gain rounds complete the loop. Final artifact and round-six CI are green (38180772871 and 38180856440); release the claim as DONE once the final review-only head is green. Leave PR #2 open for owner review; no merge is authorized by the queue instruction.
