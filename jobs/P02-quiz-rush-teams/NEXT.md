# P02 continuation

Latest frozen-source state, 2026-10-12 around 14:42 UTC: the new full own-game run is active, including default 14,000 group matches, inherited 32,000 Wager/Classic matches, properties and actual SDK group variants. Its final result is pending. Keep runtime source frozen during this run.

Completed current checks: `pnpm typecheck` exited 0; five focused server/accuracy/screens/render/inherited-renderer files passed 60/60; the fresh semantic campaign killed 20/20 mutations with zero invalid mutants, green 93-check pre/post baselines, no timeout and exact restored source hashes. Fresh 115 captures passed fit checks, all were manually reviewed, media totals 5,529,571 bytes, and owned browser PID 52292 was verified closed.

The fresh mutation campaign supersedes the earlier 89-check cleanup-timeout/retry campaign, preserved in git history. The earlier failing full run was canceled through its exact owned Vitest PID 99268 before further expensive work. Its inherited renderer phase assertion is corrected: Wager/Classic are covered there, and talk is covered by group-render. Neither earlier run is presented as the current full result.

Fidelity HUD/result work and matching discussion reading budgets are complete. Groups have an original-style question header, circular clock, answer-count cue, bottom choices, vertical team scoreboard and correctness/gain receipt. Frozen team accuracy and reveal-only correctPercent have presence/privacy regression coverage. Existing Wager/Classic paths and timers are retained.

Fidelity material belongs under `games/kahoot/fidelity`. Original references, comparison assets and gap notes are there. PLAYBACK.md and PLAYBACK_REFERENCES.json record actual publisher access failures, limited silent clip observations, dimensions and hashes; three playback PNGs are documentation references. No full original personal-device team round, soundtrack or native transition duration is claimed.

Root fixed generated CSS formatting by bounded five-pass stabilization because the printer needs multiple passes to converge. The latest full `pnpm format` check failed fidelity comparison JSON and playback Markdown. Targeted formatting of the moved playback Markdown/JSON and the verification documents has now exited 0; comparison JSON and the final full check remain outstanding. Milestone `9c79258` CI failed first-pass generated CSS formatting. A final artifact push and green current-head CI are pending.

Runner `r2-local`; branch `job/P02-quiz-rush-teams`; draft PR https://github.com/luisitin/partybox-rea-ports/pull/18, base `job/P01-quiz-rush`. P01 public head `4043226` resolved the former prerequisite blocker and remains unmerged. Older standalone source is historical in git `b254dd4` / HISTORICAL_VERIFY.md.

Remaining work:

1. Let the active full `pnpm vitest run games/kahoot --maxWorkers=1 --pool=threads` finish. Record actual results, completed match counts and per-count median round lengths. Resolve observed failures after the source freeze ends.
2. Format fidelity JSON/Markdown and regenerated evidence, then run final `pnpm format`. Verify the bounded CSS generator output stays stable.
3. Finish fidelity comparison/gap review and update every evidence hash. Keep media below 10 MB. Recapture only if subsequent player-visible source changes require it.
4. Update VERIFY.md from executed results, push final artifacts, refresh PR18's body from README.md and obtain green CI on the actual final head before removing draft.
5. Run KEEP GOING after green CI, measuring the largest player-visible weaknesses until three consecutive rounds add no noticeable gain. One discussion concern: remote/phone-only players who miss intro see a team name but no member names, which may make teammates hard to identify.
6. Push milestones at least every 30 minutes and refresh CLAIMS after each push, pulling `--rebase` before each claim commit.

Required group simulations leave `P02_SIM_RUNS` unset: 1,000 seeded matches for each group mode at counts 2–8, cycling six packs and three strengths. Every eighteen-seed cycle covers all pack/strength pairs; do not claim 1,000 per strength. Retain inherited 32,000-match assertions and property seeds 1/2/3 plus 1,000 sampled seeds per group. Only this game's tests may run.

Root owns executions, browser, git/claims/PR/CI and final verification. At most one isolated headless browser, closed in `finally`. Docs-only movement/formatting leaves runtime source unchanged.

Read UPGRADE.md: core T-1146 already has wager teams; discussion, Room vote and donor packs remain the upgrade scope. This public work performs no private checkout edit or owner-core deployment.
