# P02 continuation

Latest state, r2-local, 2026-10-12: initial integrated CI is green at head `62b0491`. [P02 run 38267052105](https://github.com/luisitin/partybox-rea-ports/actions/runs/38267052105) passed 345 tests, and the companion P01 workflow also succeeded. The earlier local full run's sole talk-phase assertion failure was corrected and retried 8/8 before this green head. This is the initial-green baseline; applied post-green phone changes still require final verification/current-head CI after the remaining loop work.

All required simulation, SDK and property checks passed within that full run: 32,000 inherited Wager/Classic matches and 14,000 group matches. The fourteen saved group reports each contain 1,000 completed seeded matches for one mode/player count. Per-count median round and match values are in [VERIFY.md](VERIFY.md); median group rounds span 87,887–95,679 ms, and the longest match was 1,036,016 ms. Current properties cover 2,006 traces, 116,376 events, 1,078,010 views and 1,420,584 bot checks with a 2,542-byte maximum property state. The simulation maximum is separately 2,607 bytes.

Round 1 implemented the native-like beside-TV phone receipt: centered verdict/glyph, full-width team gauge, gain below it, current-place line and sticky player/team/shared-score footer. Correct and incorrect teammates show the same 50% accuracy and shared footer 498 while personal +995 versus +0 differs. Hidden finals show an em dash and translated score-after-podium status. Focused group-screens/classic-screens/group-render checks passed 21/21; typecheck exited 0. Manual review of all 11 updated beside-TV result frames found no visible issue. [LOOP.md](LOOP.md) records the five reviewed weaknesses and the measured gain; three zero-gain rounds have not occurred.

The 120 current captures have zero overflow, clipping, unstyled classes or receipt-geometry failures. The capture command exited 1 because its native verifier timed out after 15 s following the finally close attempt. Explicit Get-Process recovery confirmed owned browser PID 100888 closed/absent with exit 0; all 120 saved metrics were independently checked. Root raised the next verifier to 45 s. These captures use 35-character names, not exact 40-character names; root will append the planned suffix and perform the final fresh 120-frame capture after the remaining source changes.

Both final-ready images are static renders at `nextAt + 100`, currently beyond the automatic final-reveal deadline. They establish placeholder/privacy and 56 px Show podium geometry, not a usable live final Next window. A group-only pacing patch must size the Next window from the actual three-word Spanish label, `Mostrar el podio`, through SDK `readMs` (approximately 3,249 ms), preserving the translation and baseline Classic/Wager behavior; then capture readiness within the live phase.

Earlier checks remain recorded in [VERIFY.md](VERIFY.md): 60/60 focused integration checks and a semantic campaign killing 20/20 mutations with zero invalid mutants, green 93-check pre/post baselines, no timeout and exact restored source hashes. Historical standalone evidence and the canceled earlier run remain historical; they do not replace final current-source checks.

Fidelity material is under `games/kahoot/fidelity`. The comparison now publishes four port captures against three complete official inputs, including the complete correct/incorrect receipt pair. [GAPS.md](../../games/kahoot/fidelity/GAPS.md) closes the known static receipt-placement/footer gap using the measured result and manual review. PLAYBACK.md retains primary-source access failures and limited silent-clip observations; no full original personal-device flow, soundtrack or native transition duration is claimed. Saved discussion holds remain an explicit adaptive-reading accessibility adaptation.

Runner `r2-local`; branch `job/P02-quiz-rush-teams`; draft PR https://github.com/luisitin/partybox-rea-ports/pull/18, base `job/P01-quiz-rush`. P01 public head `4043226` resolved the former prerequisite blocker and remains unmerged. Older standalone source is historical in git `b254dd4` / HISTORICAL_VERIFY.md.

Remaining work:

1. Address the pending group-only pacing/duplicated-result-reading work and final Next window, custom-bot guessing, missing TV countdown cue and late-join identity against actual behavior. These are pending candidates, not preclassified cosmetic findings.
2. Correct the renderer fixture from its actual 35-character name to exact 40-character coverage with the planned suffix; regenerate the final 120 frames only after the remaining source changes. Use the 45 s native verifier and retain explicit finally closure/recovery evidence.
3. Run appropriate own-game focused and final checks, format source/docs/generated evidence, refresh the comparison and all hashes, and confirm media stays below 10 MB. Preserve the historical simulation table until its campaign is regenerated.
4. Push each milestone, refresh CLAIMS and PR18's body from README.md, and require green CI on the actual final head. Pull `--rebase` before every CLAIMS commit; keep milestones within 30 minutes.
5. Complete measured KEEP GOING until three consecutive rounds add no noticeable gain, then remove draft only after required final checks and CI are complete.

The completed required group campaign left `P02_SIM_RUNS` unset: 1,000 seeded matches per group mode at counts 2–8, cycling all six packs and three strengths. Every eighteen-seed cycle covers all pack/strength pairs; do not claim 1,000 per strength. Inherited 32,000-match assertions and property seeds 1/2/3 plus 1,000 sampled seeds per group passed. Only this game's tests may run.

Root owns executions, browser, git/claims/PR/CI and final verification. At most one isolated headless browser, closed in `finally`. Docs-only updates leave runtime source unchanged.

Read UPGRADE.md: core T-1146 already has wager teams; discussion, Room vote and donor packs remain the upgrade scope. This public work performs no private checkout edit or owner-core deployment.
