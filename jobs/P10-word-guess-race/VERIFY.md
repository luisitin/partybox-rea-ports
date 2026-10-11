# P10 verification

Only Word Guess Race tests run locally. One worker, no browser in these scripts.

| Check                                         | Exact command                                                                                        | Result                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Dependencies                                  | `corepack enable`; `pnpm install`                                                                    | Pending owner runner installation             |
| Types                                         | `pnpm typecheck`                                                                                     | Pending                                       |
| Formatting                                    | `pnpm format`                                                                                        | Pending                                       |
| Game and SDK contract                         | `pnpm vitest run games/word-guess-race --maxWorkers=1`                                               | Pending                                       |
| Fixtures                                      | `pnpm exec tsx jobs/P10-word-guess-race/fixtures.ts`                                                 | Pending                                       |
| 21,000 bot games                              | `pnpm exec tsx jobs/P10-word-guess-race/simulation.ts 1000 jobs/P10-word-guess-race/simulation.json` | Pending                                       |
| Mutation baseline and 20 planted bugs         | `node jobs/P10-word-guess-race/mutations.mjs`                                                        | Pending; waits for exclusive server ownership |
| Property seeds 1, 2, 3 and 1,000 random seeds | Included in game-local tests above                                                                   | Pending                                       |
| TV and both phone modes, every phase          | Capture command and manual fit report to be added by root                                            | Pending                                       |
| Media integrity                               | `Get-FileHash -Algorithm SHA256 jobs/P10-word-guess-race/media/*`                                    | Pending                                       |
| P10 CI                                        | `.github/workflows/P10.yml` on the PR                                                                | Pending                                       |

Simulation uses seeds 1–1,000 separately at every player count 2–8 and every SDK strength (`easy`, `normal`, `sharp`). Timings are simulated event time, not execution time. Its JSON records each group's median round length, median and maximum whole-game time, solve fraction and event cap. Budget is twice the manifest estimate. No timer is skipped and no secret is supplied to a bot.

Mutation results must contain actual failing assertions, not syntax errors or tool failures. Each source edit is restored in `finally`. Logs and the per-bug result table will be linked after execution.
