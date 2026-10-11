# P20 verification record

Status recorded 2026-10-11. Results below reflect completed output reported in the
root session and the inspected `sim-results.json`; pending work is not a pass.
Only this game's tests run locally, with one worker. No whole-suite browser run.

| Check                 | Exact command / procedure                                                           | Observed result                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corepack              | `corepack enable`                                                                   | Succeeded.                                                                                                                                                                        |
| Dependency install    | `pnpm install`, then `pnpm.cmd install`                                             | PowerShell blocked `pnpm.ps1` under its execution policy. The installed CMD shim succeeded; Node 24.19 and pnpm 12.4.2.                                                           |
| Initial scoped tests  | `pnpm.cmd vitest run games/fruit-slice --maxWorkers=1`                              | 48 tests passed in the initial implementation. This predates expanded probes and final UI changes.                                                                                |
| Expanded scoped tests | `pnpm.cmd vitest run games/fruit-slice --maxWorkers=1`                              | First expanded run: 77 passed, one property test timed out at 120 seconds under desktop load; 78 total. No complete pass claimed.                                                 |
| Property rerun        | `pnpm.cmd vitest run games/fruit-slice --maxWorkers=1`                              | Pending. Root reduced deep assertion overhead and started a rerun.                                                                                                                |
| TypeScript            | `pnpm.cmd typecheck`                                                                | Running/pending while client work finishes.                                                                                                                                       |
| Formatting            | `pnpm.cmd format`                                                                   | Pending final formatting and check.                                                                                                                                               |
| Bot simulation        | `pnpm.cmd tsx jobs/P20-fruit-slice/sim.ts --seeds 1000`                             | Completed: 21,000 games; every player count 2-8, easy/normal/sharp, seeds 1-1000. All terminated. Details below.                                                                  |
| Source mutation check | `pnpm.cmd tsx jobs/P20-fruit-slice/mutate.ts`                                       | Pending actual execution. Tool defines 20 one-at-a-time mutations; its baseline and each mutant invoke only `games/fruit-slice/__tests__/mutation.test.ts` with `--maxWorkers=1`. |
| Phase media           | `node jobs/P20-fruit-slice/capture.mjs`                                             | Pending capture of 15 phase/surface variants as HTML and PNG.                                                                                                                     |
| Manual media fit      | Inspect captured TV at 1920x1080 and phone at 390x844                               | Pending; normal phone, phone-only and spectator behavior must be checked.                                                                                                         |
| Media budget/hashes   | Total media below 10 MB; SHA-256 of each retained media file                        | Pending captured artifacts and `SHA256SUMS.txt`.                                                                                                                                  |
| Job CI                | `.github/workflows/P20.yml` on the job PR; install, typecheck, format, scoped tests | Pending workflow/PR execution. CI must be green before leaving draft.                                                                                                             |
| Pull request          | `gh pr create` with title `P20 Fruit Slice` and job README as body                  | Pending required checks.                                                                                                                                                          |
| KEEP GOING            | Inspect eight-player flow, fix/measure weaknesses, record each round in `LOOP.md`   | Pending green PR; stop only after three rounds with no player-visible gain.                                                                                                       |

## Simulation evidence

Inspected `sim-results.json` records one current-view opportunity per player at
each two-second wave apex. Each of 21 player-count/skill combinations completed
1,000 games. Median play length was 60,000 ms; median and maximum whole-game
length were 67,000 ms, including the seven-second leaderboard. All runs finished
within `estimatedMinutes * 2`. Seeds 1, 2 and 3 also replayed event-by-event with
identical serialized states. Bot inputs were schema-checked and results included
all original players with finite, nonnegative scores.

The two-player means show that strengths produce different results in this
simulation strategy:

| Skill  | Mean score | Terminated |
| ------ | ---------: | ---------: |
| easy   |     238.24 |  1000/1000 |
| normal |    2186.48 |  1000/1000 |
| sharp  |    2604.34 |  1000/1000 |

The simulator's deterministic sequential seeds are separate from the required
property checks with seeds 1, 2, 3 and 1,000 generated random seeds. The property
timeout must be resolved and the actual rerun result recorded before declaring
that requirement passed.

## Outstanding evidence

Record the final scoped test count and property result, typecheck and format
outputs, the actual 20-mutation report (at least 19 caught), screenshot/manual-fit
findings, media byte total and hashes, PR URL and CI run result. Source research
does not include hands-on original-game play or measured reference audio; those
limits are recorded in `RESEARCH.md` and `ASSUMPTIONS.md`.
