# P08 verification

Checks in progress; no unchecked item is represented as passed.

| Check                   | Exact command                                                 | Result                                  |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------- |
| Install                 | `corepack enable`; `pnpm.cmd install`                         | Passed, pnpm 12.4.2; lockfile unchanged |
| TypeScript              | `pnpm.cmd typecheck`                                          | Pending                                 |
| Formatting              | `pnpm.cmd format`                                             | Pending                                 |
| Own game + SDK contract | `pnpm.cmd vitest run games/hole-swallow --maxWorkers=1`       | Pending                                 |
| Bot simulation          | `pnpm.cmd tsx jobs/P08-hole-swallow/simulate.ts`              | Pending                                 |
| Property seeds          | Own-game tests, explicit seeds 1, 2, 3 + 1000 generated seeds | Pending                                 |
| Mutations               | 20 one-at-a-time mutations, restore after each run            | Pending                                 |
| Phase renders           | SSR TV 1920×1080 and phone 390×844, both modes, every phase   | Pending                                 |
| CI                      | `.github/workflows/P08.yml`                                   | Pending                                 |

Browser inventory through the available computer-use tool returned no apps or browsers.
Original live browser play could not be performed; source research includes public client inspection.
Static React renders are allowed by RULES.md and will be retained for every surface/phase.

CPU discipline: only this game's tests, one Vitest worker, no whole-suite browser runs.
