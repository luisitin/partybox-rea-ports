# P01 handoff

## Resumed locally (2026-10-12, r1-local)

- P01 remains the only unfinished r1-local claim; P22 remains DONE. Work stays on `job/P01-quiz-rush`. Frozen dependencies are installed with no additions; the owner's core checkout remains read-only.
- Wager/default and additive classic modes are implemented, including stamped answers, three twenty-question packs, staged remote/spectator phones, occupied podium tiers and the 26-minute estimate. Earlier fixture continuity was repaired with the documented `lastScores: wager-final-reveal` hint; both-mode continuation regressions are present.
- KEEP GOING round 1 is complete. In its standalone harness, default sixteen-player race-name truncations fell from 15 to 0; name space grew from 65 to 337 px, with 36 px body and 32 px deltas. Combined longest EN/ES text with streak 20 was also repaired. This measured result does not establish fit in the actual host frame.
- Post-round-1 full checks passed 226/226 in 25 files, 196.07 s. [CI run 38229318876](https://github.com/luisitin/partybox-rea-ports/actions/runs/38229318876) passed at `4cf1a53`. PR #2 is open with that green baseline; current round 2 source changes still need verification.
- Prior evidence retains 32,000 bot matches, 1,003 property seeds per mode (96,436 events / 1,205,348 views) and 20/20 behavioral mutation kills with restored source hashes. Those checks and earlier full-run counts are baseline evidence, not a green result for pending round 2 repairs.
- The 82 captured frames were clean only in the old fake TV harness, which granted a 900 px stage. Round 2 found that pinned actual host chrome leaves about 692 px for Stage and 626 px inside it. Earlier standalone zero-overflow/safe-margin claims do not prove actual-host fit. Browser PID 31420 from the prior capture closed in `finally`; earlier EPERM profile cleanup remains deferred.
- Root is rebuilding the capture host with a 133.2 px header, 152.8 px player strip, 22 px bar and 80 px footer at 1920×1080, then recapturing. Actual-host source repairs, focused/full tests, captures and refreshed formatting/hashes are pending. Do not reuse the old 900 px frame as fit evidence.
- Root owns one worker and at most one browser closed in `finally`. Continue the current round 2 repair and verify its measured result before logging completion. No round 2 verification, three-no-gain completion or DONE is claimed.

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
