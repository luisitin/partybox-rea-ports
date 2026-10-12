# P02 continuation

Runner `r2-local`; branch `job/P02-quiz-rush-teams`; draft [PR18](https://github.com/luisitin/partybox-rea-ports/pull/18), base `job/P01-quiz-rush`. P02 extends the canonical P01 module directly; current public upgrade scope is in [UPGRADE.md](UPGRADE.md). No owner-core deployment has been performed.

Initial integrated [P02 CI 38267052105](https://github.com/luisitin/partybox-rea-ports/actions/runs/38267052105) was green at `62b0491` with 345 tests; companion P01 CI also passed. This is the pre-KEEP-GOING baseline. Current round-1–6 changes are focused-green and still require final current-head verification/CI.

Baseline full campaigns: 32,000 inherited Wager/Classic matches plus 14,000 group matches (1,000 seeds per mode/count, both groups at 2–8 players, all six packs/three strengths cycled). Group median rounds were 87,887–95,679 ms; longest match 1,036,016 ms; maximum simulation state 2,607 bytes. Baseline properties: 2,006 traces, 116,376 events, 1,078,010 views, 1,420,584 bot checks; maximum property state 2,542 bytes. [VERIFY.md](VERIFY.md) retains per-count medians and the earlier 344/345 local run plus its 8/8 assertion-only correction; initial CI then passed all 345. These campaigns have not been regenerated for the quality-loop changes.

Baseline semantic mutation campaign killed 20/20, with zero invalid mutants, green 93-check pre/post baselines and exact restored hashes. The expanded final 22-mutation campaign remains pending.

Applied quality gains, detailed with five weaknesses per round in [LOOP.md](LOOP.md):

1. Phone result hierarchy/shared-score footer: correct/incorrect teammates share the 50% team gauge and footer 498; personal +995/+0 remains distinct. Eleven beside-TV receipts were reviewed; 21/21 focused renderer checks and types passed.
2. Actual EN/ES group result budgets and a 3,249 ms final VIP window: matched exact-40 final reveals saved 10,171 ms for teams and 6,275 ms for room vote. Six files passed 71/71; final-ready timestamps were 3,149 ms before deadline.
3. TV countdown cue through the public quiet SDK Timer: 16/16 adapter checks plus 32/32 existing screen/renderer checks and types passed. No private host pitch/original soundtrack identity is claimed.
4. Public custom-prompt bot facts: three focused files passed 92/92 and types passed. Actual 45,000 custom answer samples measured easy/normal/sharp 29.36/49.5/79.4% in each mode; unknown or ambiguous owner facts still guess without reading keys.
5. Reveal-only room tie explanation from public aggregate counts: one cue per surface for actual seeded 4–4 results, none for clear/empty/Teams/open states. Four files passed 29/29 and types passed.
6. Missed-intro own-team discovery and factual presence: beside-TV full own roster; staged/remote native teammate disclosure swaps roster and question panes. Reconnected leavers remain labeled Left; temporary disconnects Away; spectators get watching copy. Five focused files passed 71/71 in 10.24 s; typecheck exited 0. Native clicks and maximum-text fit remain pending.

Saved PNG/layout/comparison evidence is still the 120-frame round-1 capture with 35-character names: zero clipping/overflow/unstyled/receipt-placement failures. Its closure verifier timed out after the finally attempt; explicit recovery confirmed owned PID 100888 closed/absent. The next verifier is 45 s. Saved SSR fixtures use exact 40-character names ending ` XIII`; that does not establish refreshed PNG fit.

Remaining work:

1. Check legal maximum custom text and wrapping/layout cases before release: 110-character prompt, four 42-character choices, 120-character explanation and four 40-character own-team names. Keep both discussion panes and spectators within 390×844 without scrolling or below-token text.
2. Regenerate the expanded fresh capture (approximately 165+ surfaces, plus opened teammate panes), including true 4–4 room ties, presence, exact-40 names and both usable final-ready states. Verify native mouse/Enter toggles, keyboard/focus/touch targets and all TV/phone surfaces; close the one browser in `finally` and confirm closure.
3. Run final own-game tests/SDK/required simulations/properties and the expanded 22-mutation campaign. Replace baseline reports/medians only with completed current-source evidence; refresh fidelity comparison, hashes, formatting and the below-10-MB media budget.
4. Continue measured KEEP GOING until three consecutive rounds yield no player-visible gain. Maximum-text geometry, repeated-name/readability and mobile cue review remain candidates; six gains do not establish convergence.
5. Push milestones within 30 minutes, refresh CLAIMS and PR18 from README.md; pull `--rebase` before every CLAIMS commit. Require final-head green CI and completed checks/convergence before removing draft.

Custom packs compile from UTF-8 text to `games/kahoot/content/classic-custom.json`; rebuild/restart and choose Custom. Exact public prompts can reuse independent standard facts with narrow count word/digit equivalence; edited/unknown/conflicting prompts and multiple equivalent choices remain seeded guesses. Owner keys/explanations never teach the bot.

[games/kahoot/fidelity](../../games/kahoot/fidelity/) retains complete official reference inputs. PLAYBACK.md records actual primary-source access limitations; no full original personal-device flow, soundtrack or native exact timings were measured. Adaptive SDK reading, fixed presence/reconnect membership and the final phone VIP window are explicit PartyBox adaptations.

Root owns executions, the single browser, git/claims/PR/CI and final evidence. Only `games/kahoot` tests may run. Historical standalone source/evidence in `b254dd4` and HISTORICAL_VERIFY.md do not release the current implementation.
