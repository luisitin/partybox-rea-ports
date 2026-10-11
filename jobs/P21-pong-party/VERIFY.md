# Verification

Pending implementation integration. Every result below will name an exact reproducible command and its measured outcome; incomplete checks remain explicitly pending.

| Check                   | Command                                               | Result                             |
| ----------------------- | ----------------------------------------------------- | ---------------------------------- |
| Install                 | `corepack enable`, `pnpm.cmd install`                 | Passed, pnpm 12.4.2 / Node 24.19.0 |
| Types                   | `pnpm.cmd typecheck`                                  | Pending                            |
| Formatting              | `pnpm.cmd format`                                     | Pending                            |
| Game and contract tests | `pnpm.cmd vitest run games/pong-party --maxWorkers=1` | Pending                            |
| Seeded bot simulation   | Scoped job tool                                       | Pending                            |
| Properties              | Seeds 1, 2, 3 plus 1,000 generated seeds              | Pending                            |
| Mutation                | 20 sequential mutations, restored in finally          | Pending                            |
| Screens                 | Every phase, TV and both phone modes, spectators      | Pending                            |
| Media hashes/budget     | SHA256SUMS.txt, under 10 MB                           | Pending                            |
| CI                      | `.github/workflows/P21.yml` on draft PR               | Pending                            |
