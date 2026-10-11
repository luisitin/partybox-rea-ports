# Resume

Claim P09 r8-local, branch job/P09-2048-race, game games/merge-sprint.

All local gates passed: typecheck, format, 76 own-game tests including actual SDK
contract and 1,003 race seeds, 21,000 bot games (all counts 2–8/all strengths),
20/20 mutations, all 15 TV/phone/player/spectator surfaces manually reviewed,
and all 31 media checksums independently verified. Media: 4,218,520 bytes.
Details and exact commands are in VERIFY.md. Server sources were restored after
mutations. Latest capture cleanup proved zero living owned browser processes.

Research and implementation milestone ea63c08 and verification milestone
a2a3aa7 are pushed. Main claims are refreshed via a temporary .claims-r8 worktree:
pull --rebase, edit only P09 line, commit/push main, remove worktree. The local
exclude hides that temporary directory; remove it before whole-repo formatting.

Remaining required work:

1. Push the final capture/verification evidence and refresh the main claim.
2. Open draft PR title P09 Merge Sprint, body exactly this job's README.
3. Wait for P09 CI green and mark ready; record URL/run in VERIFY.md.
4. KEEP GOING after CI: list five weaknesses, fix worst, measure, log and push.
   Known candidates: intent-only buzz, missing accepted-merge gain feedback,
   target-finish tie footer, and clearer phone-only buzzer scoring.
5. Repeat until three consecutive rounds give no player-noticeable gain.
6. Read fresh main claims and claim the next eligible lowest numbered job.

Do not repeat the completed simulation/mutations for client-only edits. Re-run
typecheck/format/own tests and recapture any affected surface, then refresh hashes.
Never run another game's tests or launch a second active headless browser.
