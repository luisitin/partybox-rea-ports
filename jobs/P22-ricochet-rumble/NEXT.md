# P22 handoff

- Run r1-local; branch job/P22-ricochet-rumble; official game games/tank-trouble.
- Resumed P01 first: PR #2 head 1c8d264 passed CI 38181046868; P01 is DONE on main.
- Install completed once during P01. Use pnpm.cmd on Windows.
- Research/reference/contract/design prerequisites complete. Fresh main owner naming instructions merged; no Tank Trouble counterpart exists in PartyBox.
- Initial full game run passed 106 tests: 1003 property seeds and 7000 matches at every count 2..8. Longest match 339824 ms, budget 720000 ms.
- Shared bot route tree passed 60000 independent differential paths and 76 final focused lifecycle/physics/SDK/routing tests. Eight-seat graph visits reduced 5.31 times; gameplay decisions unchanged.
- Official-name SSR/SDK run passed 43 tests (14.17 s). Current fixtures recaptured: all 40 screens fit; browser PID 108768 closed in finally. All media hashes refreshed, 90 files / 4683051 bytes.
- Final mutation run passed 54 baseline tests, caught 19/20 valid behavioral defects, restored 6 source hashes with zero mismatches. M19 survives because a second stale-time guard independently rejects the input.
- pnpm.cmd typecheck and pnpm.cmd format pass. No worker/browser running.
- Next: open draft PR titled P22 Tank Trouble using this job README as body; collect green CI. Then KEEP GOING, fix worst demonstrated weakness, measure/log/push/refresh claim each round. Three consecutive rounds with no player-visible gain complete the loop.
- Reviews found major repeated-reading dead time (244825 ms at eight seats), gone-seat tank0/spectator ready copy, misleading Burst capacity, disabled Fire contrast and mismatched pickup legend. Compact READY/score text can reduce actual SDK reading floors; preserve full final standings and own interim rank.
- Root owns git/docs/verification/client; server agent can own pacing when delegated. Run only this game's tests, one worker; root reserves the one owned browser closed in finally.
