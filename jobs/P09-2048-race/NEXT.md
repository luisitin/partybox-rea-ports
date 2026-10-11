# Resume

Claim: P09 r8-local, branch job/P09-2048-race, game games/merge-sprint.

Research, server, client, phase fixtures, CI workflow and focused tests are complete.
Milestone ea63c08 pushed. Main claim refreshed using an isolated temporary local
worktree, with pull --rebase immediately before the claim commit. That worktree
was removed afterward. Typecheck and 68 focused tests passed before later test additions.

Next required work:

1. Simulation completed: 21,000 games, all 2–8 counts and 3 skills; median/max
   play 180 seconds and full results by 188 seconds. See simulation.json.
2. Mutation run completed: 20/20 caught with assertion failures; sources restored
   in finally. See mutations.json. No server edits during this run.
3. All 15 HTML surfaces regenerated with readable rectangular TV maps (32px
   minimum numeric text). First Chrome startup timed out at 20 seconds; cleanup
   closed it. Capture startup allowance/diagnostics are being improved before a
   single-browser retry. PNG/manual fit review remains required.
4. Final typecheck and own-game tests are running. Finish format/VERIFY/hashes.
5. Push the verification milestone and refresh main claim with pull --rebase.
6. Open draft PR with this job's README as body. Wait for CI green, mark ready.
7. KEEP GOING improvements until three player-invisible rounds; then claim next.
