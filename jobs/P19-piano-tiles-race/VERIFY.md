# Verification — P19 Tile Tempo

Checks are in progress. No pending check is claimed green.

| Check                        | Exact command                                                     | Result                               |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Install                      | `corepack enable; pnpm.cmd install`                               | PASS, 87 packages; no new dependency |
| Typecheck                    | `pnpm.cmd typecheck`                                              | In progress                          |
| Format                       | `pnpm.cmd format`                                                 | Pending                              |
| Focused tests + SDK contract | `pnpm.cmd vitest run games/tile-tempo --maxWorkers=1`             | Pending                              |
| All-count simulation         | `pnpm.cmd tsx jobs/P19-piano-tiles-race/tools/simulate.ts`        | Pending                              |
| 20 mutations                 | `node jobs/P19-piano-tiles-race/tools/mutate.mjs`                 | Pending                              |
| Static HTML + PNG fit        | focused tests; `node jobs/P19-piano-tiles-race/tools/capture.mjs` | Pending                              |
| Property seeds               | Focused tests: 1, 2, 3 + 1,000 generated seeds                    | Pending                              |
| P19 CI                       | `.github/workflows/P19.yml`                                       | Pending PR                           |
