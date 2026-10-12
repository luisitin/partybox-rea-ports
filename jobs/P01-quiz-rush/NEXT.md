# P01 handoff

## Resumed locally (2026-10-12, r1-local)

- P01 is unfinished; P22 is DONE. Stay on `job/P01-quiz-rush`; no added dependencies, owner core read-only. Round-4 `1333563` [CI 38241666750](https://github.com/luisitin/partybox-rea-ports/actions/runs/38241666750) is green; last recorded main claim refresh `3addcbb`. Round-5 source/artifacts await final format/hash/push/CI.
- Round 5 is applied: only 13–16-seat stakes use own four-column/two-line 32 px name/rank/score/placed cards; ≤12 retains SDK. Four normal stakes-name ellipses → zero, name width 416 px, all sixteen scores/marks visible. Spanish 40-character/five-digit/long-leader/all-placed cases pass; before PNG and loop-5 fit JSON are recorded.
- First new capture 39757 failed 20 clipped last-row items. Corrected div.wagerStage specificity and wrapping 32 px rules; helper now matches pinned global .pb-muted/.pb-caption. Final 50244 PASS 95/95 current, plus one deliberate 85-clipped Finale baseline (96 records). PID 52968 closed in finally; EPERM profile cleanup deferred. The old 90/91 byte identity was round 4 before caption correction.
- Full 37496 PASS 242/242, 26 files, 484.58 s, exit 0; raw `r1-local-kahoot-loop5-tests-20261012.json`. Runtime JS/server froze throughout, but Tv.module.css and upgrade-evidence.ts changed early during properties. No 93-file freeze claim for this run. Verification JSON records both before/after SHAs; final ten-renderer file ran after fixes and current 77 capture/six restoration hashes match.
- Typecheck 32345 PASS; focused 43 tests/3 files and final ten-renderer PASS. Independent twelve-sheet/native phone/stakes QA found no remaining concrete visual defect. Final media checkpoint 8,710,478 B before loop-5 JSON; complete final hashes/format and resulting-head CI remain pending. No no-gain rounds or DONE.

Next actions:

1. Finish final round-5 formatting and stable source/capture/restoration/media hashes; verify the complete payload below 10,000,000 B. Preserve the two-file early-change disclosure and avoid applying the round-4 93-file freeze to this run.
2. Push source/artifacts/docs, pull --rebase before P01 claim refresh, and refresh PR #2 from the job README. Require CI at that resulting head; prior round-4 green does not release this source.
3. After latest CI, conduct a fresh five-weakness walkthrough and record its measured outcome. Continue until three consecutive no-gain rounds pass; none is claimed yet and historical standalone rounds do not count. DONE requires the loop and final-head checks.

Root owns one test worker and one headless browser closed in finally. Final format/hash/push/CI,
three no-gain rounds and DONE remain pending.

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
