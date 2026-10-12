# P06 handoff

Claim r2-local; branch job/P06-snake-royale; draft PR https://github.com/luisitin/partybox-rea-ports/pull/19. Resume this job before claiming another.

Official-name migration is complete. The reviewed game passed 130 tests across 8 files, including all 20 actual SDK assertions and 3000 mixed lifecycle property traces. All 16 captures fit, 19 live-control checks pass, and all 20 planted bugs are caught. Browser was closed in finally; no production server runs. P06 CI for 9da0b2f is green (10m14s).

Quality loop rounds 1–2 fixed cadence, boost body length, wall/head order, corpse fairness, occupied returns, presence chronology, compass/key releases and snake identity. The additional covered-ring regression passed 5/5 arena checks. Round 3 corrects fractional rich-food and minimum-mass boost cues plus configured-match onboarding; focused screen checks and refreshed captures must run after the exhaustive worker exits. VERIFY.md distinguishes fresh results from inherited evidence.

Running: 1000 default three-round matches at every player count 2–8 in one Vitest worker, as part of the full game command. Counts 2–6 have completed with fresh reports; 7–8 are still historical until overwritten. Finish the worker, run the focused screen/artifact checks for the latest client cues, capture again, format, refresh SHA256SUMS and obtain green P06 CI. Then record three consecutive KEEP GOING rounds with no player-visible gain, make PR ready and mark the claim DONE. No new job may be claimed before this one is finished.

Owned claims worktree is now C:/dev/rea-runs/r2-claims so pnpm format does not scan a duplicate repo. Pull --rebase in that worktree before each CLAIMS commit and refresh P06 every branch push. No further job is claimed.
