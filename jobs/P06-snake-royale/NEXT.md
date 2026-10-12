# P06 handoff

Run r2-local; branch job/P06-snake-royale; PR https://github.com/luisitin/partybox-rea-ports/pull/19.

Implementation and required verification are complete. Official folder/id/name: games/slither-io / slither-io / Slither.io. Current production head daee44b passed 132 checks in 8 files in CI, including all 20 actual SDK assertions and 3000 lifecycle property traces. Current focused screen/artifact checks passed 37/37; all 16 fresh captures fit, all 19 live-control checks pass, and all 20 planted faults were caught. Browser cleanup completed.

Fresh reports cover 1000 default three-round matches at every count 2–8: counts 2–7 local, count 8 from the identical current server in green CI. The duplicate local eight-player batch was stopped to save CPU. All 7000 reported matches terminate within the manifest bound; median rounds are 90000ms. VERIFY.md records commands, provenance and limits.

KEEP GOING rounds 1–3 corrected cadence, geometry, fairness, presence, controls, identity and small cue/copy defects. Rounds 4–6 each found no further meaningful player-visible gain. No gameplay work remains.

Final evidence-only push reruns P06 CI. PR #19 is canonical for latest CI/draft status. If resumed while still draft, wait for green, make it ready and mark P06 DONE on main. Once DONE, continue the queue. No further job is claimed before this transition.

Owned claims worktree: C:/dev/rea-runs/r2-claims. Pull --rebase before each CLAIMS commit and refresh P06 on every branch push.
