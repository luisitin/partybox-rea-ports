# P06 handoff

Claim r2-local; branch job/P06-snake-royale; draft PR https://github.com/luisitin/partybox-rea-ports/pull/19. Resume this job before claiming another.

Official-name migration is complete. Current reviewed game passed 130 tests across 8 files, including all 20 actual SDK assertions and 3000 mixed lifecycle property traces. Regenerated all fixtures/screens; all16 captures fit, 19 live-control checks pass, and all20 planted bugs are caught. Browser was closed in finally; no production server runs.

Quality loop1 fixed cadence, boost body length, wall/head order, corpse fairness, occupied returns, presence chronology, compass/key releases and snake identity. VERIFY.md distinguishes fresh results from inherited evidence.

Running next: exhaustive1000 default three-round matches at every player count2–8 in one Vitest worker, with per-count reports in media/sim-N.json. Keep old reports labelled historical until replaced. Finish that run, format reports, refresh SHA256SUMS, obtain green P06 CI, then perform three consecutive KEEP GOING rounds with no player-visible gain before making PR ready and marking claim DONE.

Owned claims worktree is now C:/dev/rea-runs/r2-claims so pnpm format does not scan a duplicate repo. Pull --rebase in that worktree before each CLAIMS commit and refresh P06 every branch push. No further job is claimed.
