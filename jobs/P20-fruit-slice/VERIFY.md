# P20 verification record

Only Fruit Slice tests run locally, with one worker. No whole-suite browser run.
Source research limits are recorded in RESEARCH.md and ASSUMPTIONS.md.

| Check                                 | Exact command / procedure                                                                                          | Result                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                               | `corepack enable`, `pnpm.cmd install`                                                                              | PASS, Node 24.19.0 / pnpm 12.4.2. PowerShell blocked pnpm.ps1; the existing CMD shim worked.                                                                                                 |
| Scoped tests and actual SDK contracts | `pnpm.cmd vitest run games/fruit-slice --maxWorkers=1`                                                             | PASS: 81 tests in 5 files, 107.16 s under desktop load. SDK discovery restricted to this game.                                                                                               |
| Properties                            | Same scoped command                                                                                                | PASS: seeds 1, 2, 3 at every player count; fast-check seed 20261011 generates 1,000 random seeds/counts. Replay, totality, JSON, bounded state, private cuts, drop/rejoin and pause checked. |
| TypeScript                            | `pnpm.cmd typecheck`                                                                                               | PASS after all source changes.                                                                                                                                                               |
| Format                                | `pnpm.cmd format`                                                                                                  | PASS: all matched files use Prettier code style.                                                                                                                                             |
| Simulation                            | `pnpm.cmd tsx jobs/P20-fruit-slice/sim.ts --out jobs/P20-fruit-slice/sim-results.json`                             | PASS: 21,000 games, 1,000 seeds at each count 2–8 and each easy/normal/sharp strength. All terminate.                                                                                        |
| Mutation first run                    | `pnpm.cmd tsx jobs/P20-fruit-slice/mutate.ts --out jobs/P20-fruit-slice/mutation-report.json`                      | 18 killed, M09/M10 inconclusive due process timeouts. Retained as mutation-first-report.json.                                                                                                |
| Mutation retries                      | `pnpm.cmd tsx jobs/P20-fruit-slice/mutate.ts --only M09,M10 --out jobs/P20-fruit-slice/mutation-retry-report.json` | PASS: both killed, no invalid probes, source restored. Combined final result: 20/20 caught. Original/restored SHA-256 values match for every source.                                         |
| Phase screens                         | Scoped tests use react-dom/server; `node jobs/P20-fruit-slice/capture.mjs` captures the HTML                       | PASS: 15 HTML + 15 PNG variants, every phase on TV and phone with TV/phone-only, including spectators. One recycled Chromium tab; browser closes in finally.                                 |
| Fit and manual QA                     | Chromium at 1920×1080 and 390×844; inspect every PNG                                                               | PASS: zero overflow in all 15 variants. Names, 96 px TV timer, scores, shapes, bomb X and touch controls readable; eight rows fit; spectators have no controls; no scrolling in play.        |
| Media budget/hashes                   | Sum media bytes; Get-FileHash SHA256                                                                               | PASS: 31 files, 1,137,692 bytes after initial formatting, below 10 MB. SHA256SUMS.txt covers each media file; refresh after changes.                                                         |
| CI                                    | .github/workflows/P20.yml: install, typecheck, format, scoped tests                                                | Pending draft PR; CI must be green before readiness.                                                                                                                                         |
| KEEP GOING                            | Five-weakness review and measured fixes in LOOP.md                                                                 | Pending green PR.                                                                                                                                                                            |

The first expanded property run timed out (77/78 passed). Using Node's assertion
library for repeated deep comparisons preserved the traces and checks; the
complete 1,000-seed rerun passed. Mutation timeouts are not counted as kills;
only real failed assertions from the retries are counted.

## Simulation evidence

Each bot gets one current-view opportunity at each two-second wave's apex. All
21 player-count/strength combinations complete 1,000 games. Median play is
60,000 ms; median and maximum whole match are 67,000 ms, including the score
beat. The two-minute manifest estimate allows 240,000 ms; every game meets it.
Seeds 1–3 replay every event byte-identically. Every bot input passes its schema,
and every original player has a finite score.

Two-player mean scores: easy 238.24, normal 2186.48, sharp 2604.34. All strengths
use current-view decisions; easy prefers singles, stronger bots search safe
combo paths and hesitate less. Full results are in sim-results.json.

## Actual planted bugs

| ID  | One-at-a-time bug                        | Result          |
| --- | ---------------------------------------- | --------------- |
| M01 | Inflate fruit base points                | caught          |
| M02 | Two fruit incorrectly qualifies as combo | caught          |
| M03 | Remove combo multiplier                  | caught          |
| M04 | Remove streak cap                        | caught          |
| M05 | Bomb swipe earns fruit points            | caught          |
| M06 | Bomb preserves streak                    | caught          |
| M07 | Bomb no longer locks its wave            | caught          |
| M08 | Duplicate swipe sequence accepted        | caught          |
| M09 | Cut fruit scores twice                   | caught on retry |
| M10 | Twenty-first stroke accepted             | caught on retry |
| M11 | Stale wave accepted                      | caught          |
| M12 | Future gesture frame accepted            | caught          |
| M13 | Disconnected player scores               | caught          |
| M14 | Round deadline cannot leave play         | caught          |
| M15 | Score deadline cannot leave leaderboard  | caught          |
| M16 | TV exposes raw personal cut history      | caught          |
| M17 | Own phone retains sliced fruit           | caught          |
| M18 | Every missed segment counts as hit       | caught          |
| M19 | Resume fails to extend round clock       | caught          |
| M20 | Bot acts for disconnected player         | caught          |

Reports include exact source replacements, actual failed test names and matching
restoration hashes. No mutant is committed. The browser's private-profile
Crashpad handler was stopped; capture.mjs now handles that in its Windows
finally. No other runner's browser or Node process was stopped.
