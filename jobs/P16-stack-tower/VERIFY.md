# P16 verification

Run commands only for this game's tests. No whole-suite browser run.

| Check                               | Exact command                                          | Result                                               |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| Install                             | `corepack enable` then `pnpm.cmd install`              | Pass; pnpm 12.4.2, locked dependencies, no additions |
| Typecheck                           | `pnpm.cmd typecheck`                                   | Pending                                              |
| Format                              | `pnpm.cmd format`                                      | Pending                                              |
| Game tests and SDK contracts        | `pnpm.cmd vitest run games/stack-tower --maxWorkers=1` | Pending                                              |
| Simulation                          | `pnpm.cmd exec tsx jobs/P16-stack-tower/tools/sim.ts`  | Pending                                              |
| Property seeds                      | Included in scoped game tests                          | Pending                                              |
| Twenty real source mutations        | Scoped mutation tool                                   | Pending                                              |
| Every phase, TV and two phone modes | Scoped render/capture tools                            | Pending                                              |
| CI                                  | `.github/workflows/P16.yml`                            | Pending draft PR                                     |
