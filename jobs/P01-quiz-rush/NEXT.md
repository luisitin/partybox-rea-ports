# P01 handoff

## Resumed locally (2026-10-12, r1-local)

- Initial upgrade CI38225649131 atca58d1b is green and PR2 is ready. KEEP GOING round1 repairs TV race identities:15→0 default sixteen-seat name truncations,65→337px space, body36px/delta32px. Combined longest EN/ES withstreak20 also fits. Focused34tests pass;82captures pass Stage safe margins; browserPID31420closed in finally. Final artifact formatting/hash update and post-round CI are next; three consecutive no-gain rounds still required.

- Resume-first confirmed P01 is the only unfinished r1-local claim; P22 remains DONE. The existing uncommitted classic upgrade was preserved. Frozen dependencies were reinstalled with corepack/pnpm; no additions.
- The additive classic implementation is complete: stamped shape answers, three twenty-question packs, remote/spectator stage and occupied podium tiers. Wager/legacy stays the default. The audit repaired score-before-reveal timing, final-chart Next timing, paused final clocks and staged-phone totals, and expanded podium receipt reading budgets and Spanish UI keys.
- The 72/72 real-reducer mutation baseline passes; all 20 meaningful upgrade mutants were killed and original server hashes restored. The initial 227-test run exposed stale fixtures, an outdated 8-minute estimate, unrelated minigame pool assertions and remote copy. Those are corrected; the estimate is now 26 minutes.
- The prior full run passed 221/222 tests in 526.79 s. Its sole failure compared canonical wager `done.json` with the classic podium fixture. The documented `lastScores` hint now selects same-match `wager-final-reveal`; focused SDK checks pass 20/20 in 25.27 s. Added continuation regressions cover both classic and wager matches.
- All 32,000 bot matches and 1,003 property seeds per mode passed: 96,436 events and 1,205,348 views. Final full run passes 224/224 in25files (481.32s, exit0), including unmodified SDK, both-mode continuation and long-name regressions. Latest typecheck is PASS.
- Reducer-backed fixtures and HTML come from `render-upgrade.test.tsx` / `upgrade-evidence.ts`. Staged chart/standings and compact final rows repaired the five initial wager phone-only reveal overflows. Black button text was a capture-shell artifact; the helper now matches pinned core `global.css` and inherits token text colour.
- The additional 16-player final-name case uses legal 40-character names and five-digit totals and now has regression tests and phone-only/remote/spectator captures. Latest focused run: 4 files, 33/33 PASS, 14.58 s. Latest capture: 78/78 clean. Owned browser PID 112464 closed in `finally`; temporary profile cleanup is deferred after EPERM.
- Root owns one worker and at most one browser closed in `finally`. Repository format passes;194 media files total7,373,326bytes with fresh SHA256 sums; all runtime/capture and mutation source hashes match. Evidence push, PR #2 CI and the new KEEP GOING loop remain pending. PR stays draft; no READY/DONE claim is made.

## Current owner-required upgrade

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
