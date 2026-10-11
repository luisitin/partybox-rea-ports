# P09 verification

In progress on `job/P09-2048-race`. Completed evidence is distinguished from
pending gates below. An earlier passing command is not a claim about later edits.
All commands run from the repository root. Windows uses the existing `pnpm.cmd`
shim because machine policy blocks `pnpm.ps1`; CI uses `pnpm` on Ubuntu.

## Setup, research, and implementation checks

| Check              | Exact command or evidence                                                                               | Result                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install once       | `corepack enable`, then `pnpm.cmd install`                                                              | Passed; 87 packages, no dependency changes.                                                                                                              |
| Original rules     | Original GameManager exercised in an ephemeral Node VM; transcript and seven rule probes in RESEARCH.md | Merge ordering, merge points, no-op spawning, target, and blocked-board behavior verified against the original engine. No copied source/assets retained. |
| Independent source | Original creator and independently authored C++ engine, pinned URLs in SOURCES.md                       | Core rules cross-confirmed. Original visible-browser play unavailable; no visual/audio session claimed.                                                  |
| TypeScript         | `pnpm.cmd typecheck`                                                                                    | Passed at first complete milestone; final run after subsequent edits **pending**.                                                                        |
| Formatting         | `pnpm.cmd format`                                                                                       | Final whole-repository formatting check **pending**.                                                                                                     |
| Own-game tests     | `pnpm.cmd vitest run games/merge-sprint --maxWorkers=1`                                                 | First complete milestone: 68 tests passed. Added coverage and final run **pending**.                                                                     |
| SDK contract       | Included by `games/merge-sprint/__tests__/contract.test.ts` in the own-game command above               | Actual SDK contract suite passed at first milestone; discovery is filtered to this game. Final repeat **pending**.                                       |

Tests cover deterministic replay, mass and scoring invariants, once-per-input
merges, direction symmetry, identical shared draws independent of event order,
stale/duplicate/rapid/spectator inputs, deadline boundaries, pause/resume,
reconnection, dropped-player completion, all-phase views, private future draws,
phone-only play, spectators, and three visible-board bot strategies. These are
coverage descriptions; the latest pass count remains pending.

## Seeded completion simulation — passed

Exact command:

```text
node --import tsx ./jobs/P09-2048-race/tools/simulation.ts
```

[simulation.json](simulation.json) contains all 21 completed groups: every
player count from 2 through 8, each with easy, normal, and sharp bots, and seeds
1–1000 per group. Total: **21,000 completed games**. The evidence file was read
back and its 21 seed counts sum to 21,000.

| Players | Seeds per strength | Total games | Median play time, all strengths | Maximum play time, all strengths |
| ------- | ------------------ | ----------- | ------------------------------- | -------------------------------- |
| 2       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 3       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 4       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 5       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 6       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 7       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |
| 8       | 1000               | 3000        | 180,000 ms                      | 180,000 ms                       |

The longest matches enter terminal `done` at 188,000 ms including the 8,000 ms
reveal. The manifest estimate is four minutes; the required twice-estimate limit
is 480,000 ms. **188,000 < 480,000 ms.** Every run checks reveal exit, terminal
results, all original players, finite scores, a winner, and that time limit.

Simulation uses one decision per seat every 2,000 ms and the default 180-second
race. It measures completion and standings, not touch latency or live browser
performance. Every group records reasons, median score, accepted moves, and wall
time in the JSON evidence. No other game's tests or browser were used.

## Property seeds — final run pending

Included in the own-game command. Optional isolated reproduction:

```text
pnpm.cmd vitest run games/merge-sprint/__tests__/property.test.ts --maxWorkers=1
```

The source explicitly runs seeds **1, 2, 3**, plus 1,000 generated board cases
under recorded fast-check seed **204809**. A separate replay property generates
1,000 distinct race seeds and combines them with 1, 2, and 3, requiring exactly
1,003 unique seeds. It checks identical initial state, matching player starts,
deterministic timer transitions, equal public views, and absent future draws.
Latest result: **pending**; source presence is not recorded as a test pass.

## Mutation check — running, final result pending

Exact outer command:

```text
node --import tsx ./jobs/P09-2048-race/tools/mutate.ts
```

Each mutation runs this focused command after a passing baseline:

```text
pnpm.cmd vitest run games/merge-sprint/__tests__/board.test.ts games/merge-sprint/__tests__/game.test.ts --maxWorkers=1
```

The script plants one bug at a time and restores each source in `finally`.
Syntax/import/type failures do not count as caught rule bugs. Required result:
at least **19/20** caught. `mutations.json` will record the actual failing tests
and outcome of every entry; the complete result is not yet available.

| #   | Planted bug                          | Result  |
| --- | ------------------------------------ | ------- |
| 1   | Merge unequal tiles                  | Pending |
| 2   | Wrong merged tile value              | Pending |
| 3   | Half merge points                    | Pending |
| 4   | Reuse the second tile                | Pending |
| 5   | Reverse right input                  | Pending |
| 6   | Ignore vertical merges               | Pending |
| 7   | No empty-cell mobility               | Pending |
| 8   | Wrong spawn normalization            | Pending |
| 9   | Always spawn a four                  | Pending |
| 10  | No-op spends a spawn                 | Pending |
| 11  | Duplicate input accepted             | Pending |
| 12  | No anti-flood interval               | Pending |
| 13  | Deadline accepts final move          | Pending |
| 14  | Target never ends race               | Pending |
| 15  | Blocked boards never end race        | Pending |
| 16  | Wrong draw index                     | Pending |
| 17  | Score ignores earlier merges         | Pending |
| 18  | Finished racer loses to higher score | Pending |
| 19  | Reveal timer never exits             | Pending |
| 20  | Future draws leak to public views    | Pending |

## Screens, layout, and media hashes — final review pending

Exact SSR command:

```text
node --import tsx --import ./jobs/P09-2048-race/tools/css-loader.mjs ./jobs/P09-2048-race/tools/render.tsx
```

Fifteen HTML captures have been generated: `play`, `reveal`, and `done`, each
with a TV and player/spectator phones both with a TV and in phone-only mode.
TV is 1920 by 1080; phone is 390 by 844. The harness reserves shell space, embeds
the tokens and loaded SDK/game CSS modules, namespaces classes to avoid style
collisions, supplies the SDK clock/provider, and starts no browser.

Exact PNG/layout command, **pending**:

```text
node ./jobs/P09-2048-race/tools/capture.mjs
```

One headless Chrome process and one reused page capture every local HTML file.
Chrome is closed in `finally`, with a bounded process-tree fallback. The report
`media/layout.json` records viewport fit, scroll overflow, ancestor clipping,
text bounds/font sizes, and the 44 px direction targets. Manual inspection must
verify readable TV names/scores/best tiles, timer at least 96 px, phone play
without scrolling, all eight result rows, spectators without controls, and
phone-only race context. **No final fit verdict is claimed yet.**

After final HTML formatting and PNG capture, refresh every media checksum:

```text
node --import tsx --import ./jobs/P09-2048-race/tools/css-loader.mjs ./jobs/P09-2048-race/tools/render.tsx --hash-only
```

Final `SHA256SUMS.txt` and the total media size below 10 MB are **pending**.
Existing hashes must be refreshed after any formatted HTML or recapture.

## CI, pull request, and KEEP GOING — pending

`.github/workflows/P09.yml` targets pull requests touching this game/job. It uses
`ubuntu-latest`, a 30-minute timeout, `contents: read`, and only `actions/*`
actions. Its exact verification commands are:

```text
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm format
pnpm vitest run games/merge-sprint --maxWorkers=1
```

Draft PR, CI run URL/conclusion, and ready transition: **pending**. The PR title
must be `P09 Merge Sprint`, with the job README as its body. It remains draft
until CI is green.

After green CI, each KEEP GOING round must list the five biggest weaknesses of
an eight-stranger living-room session, fix the worst, record a measured gain in
LOOP.md, and push. Three consecutive rounds with no player-noticeable gain are
required before returning to the queue. Those rounds are **pending**.
