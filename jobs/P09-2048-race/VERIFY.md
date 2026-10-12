# P09 verification

## Latest r1-local checkpoint (2026-10-12 13:41 UTC)

Current simulation PASS: `node --import tsx jobs/P09-2048-race/tools/simulation.ts`,
exit 0; 21000/21000 games, all counts/skills, max total 275456 ms < 480000 ms.
Every group's median play is 180000 ms; group total medians 202296–265067 ms.
Recorded run: 13:31:06.002–13:36:19.124 UTC, stable source hashes.

Current capture PASS: `node jobs/P09-2048-race/tools/capture.mjs`, exit 0;
27 frames, all bounds/clipping/overlap/type/targets pass, owned browser closure verified.
All 15 standard and 12 stress frames manually reviewed. Media about 8.3 MB.
The receipt frame supplies labelled synthetic text to the SSR status slot; tests
verify accepted-counter behavior. Static reconstructed host frame, no running-room claim.

`node --import tsx jobs/P09-2048-race/tools/mutate.ts`: 20/20 behavior kills;
source restoration true, but final baseline 101 pass/1 fail is under investigation.
No overall mutation/tests PASS until that failure is fixed and baseline rerun green.
Typecheck passed before mutation planting; final type/format/CI gates remain pending.
Generated HTML's second embedded-CSS formatting pass is repaired; its check passes.

Earlier checkpoints below are superseded; their PASS figures are historical only.

## Latest r1-local checkpoint (2026-10-12 12:27 UTC)

Canonical `games/2048` is implemented; PR #12 remains draft. Typecheck PASS after
numeric ID and local pinned-host spectator opt-in repairs. Game-only command
`pnpm vitest run games/2048 --maxWorkers=1 --pool=threads --reporter=default --reporter=json --outputFile=C:/Users/luisi_xlnbc7h/AppData/Local/Temp/r1-local-2048-tests-20261012.json`
PASS: 91/91 tests, nine files, 20.74 s, exit 0. Includes the unmodified 20 SDK
contracts, 1,003 race seeds, rendered reading floors, feedback and numeric-ID checks.
Initial run failed three old `Best tile` copy expectations; updated to the new
`Best` label and reran the full game green. Two earlier type failures exposed that
the public kit lacks the pinned core spectator field; the phone module uses a local
intersection type, with the real host runtime opt-in retained.

Actual collapsed-strip TV Stage 854.8/inner788.8 px; phone60+27.6 px chrome.
Local Nunito/OFL and pinned global reset replace the historical fake harness.
First actual capture showed TV header overlap26.65px; compact best/score rows
remove it. Current15 captures pass frame bounds, no clipped items, header separation,
32px game body and44px targets; browser27260/113056 closed in finally, zero living
owned children. Four representative frames reviewed by hand; all15/adversarial
long-name/target/paused/receipt review remains required. Font ink overhang metrics
remain explicit and must be reviewed; they are not silently deleted.
Capture file navigation timed out once and closed browser114580; current CDP
setDocumentContent loads exact HTML and local font bytes.

Fresh simulation is PARTIAL: see completedGames/incomplete in simulation.json.
All recorded groups terminate within480000ms; median play180000ms. Counts/strengths
not present remain required. Owned process108044/59484 was stopped for the session
deadline after complete group records were saved. Historical21k/20mutation results
below remain baseline only. Fresh mutation rerun, full simulations, adversarial
captures/manual QA, final CI and three consecutive no-gain rounds are pending.
Shared manifest validator now allows leading digits under docs/DECISIONS.md;
owner core is unchanged and also needs that validator when importing this port.

## Earlier resume checkpoint (historical)

## Current canonical resume (2026-10-12, r1-local)

Canonical `games/2048` replaces the former Merge Sprint name/path; job branch remains
`job/P09-2048-race`. Root's 117-core-manifest overlap scan found no duplicate. The current
claim is `206c2c0`. All new-source gates remain pending; the old 76-test/21,000-game/
20-mutation/15-capture figures below are historical baseline only.

| Gate                     | Current command/evidence                                       | Status                                                                          |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Types                    | `pnpm.cmd typecheck`                                           | Pending canonical/current repairs                                               |
| Format                   | `pnpm.cmd format`                                              | Pending                                                                         |
| Own tests/SDK/properties | `pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads` | Pending; own game only                                                          |
| Simulations/read timing  | Current P09 simulation tool; counts 2–8/all three strengths    | Pending regenerated 21,000 games and current reading-floor/estimate evidence    |
| Mutations/restoration    | Current P09 mutation tool                                      | Pending fresh behavioral kills and restored-source hashes                       |
| Actual-host captures     | Root's pinned chrome renderer/capture                          | Pending; old fake chrome/spectator SSR routing do not prove fit or read-only UI |
| Media/source sums        | Current renderer/hash tools                                    | Pending fresh hashes and decimal 10 MB cap                                      |
| CI/PR                    | P09 workflow / PR #12                                          | Reopened draft; fresh head CI pending; old CI 38180992082 is baseline           |
| KEEP GOING               | Root-owned LOOP.md                                             | Fresh three-consecutive-no-gain loop pending                                    |

The original hosted page and independent pinned raw engine were freshly opened/confirmed,
but there was no live original gameplay/audio session. Historical VM probes are not new browser
play. Prior screenshots used invented host reservations and misrouted spectator SSR; repair
and actual-shell capture must precede any current layout/controls PASS. All execution stays
one own-game thread worker and at most one owned browser closed in finally.

## Historical prior-run evidence (superseded)

PR #12 was previously ready with CI 38180992082. The original commands/results below describe
`games/merge-sprint` and their source snapshot, not the renamed/repaired current implementation.
Keep their benchmark/probe records; do not count them as fresh verification.

### Original prior-run record

In progress on `job/P09-2048-race`. Completed evidence is distinguished from
pending gates below. An earlier passing command is not a claim about later edits.
All commands run from the repository root. Windows uses the existing `pnpm.cmd`
shim because machine policy blocks `pnpm.ps1`; CI uses `pnpm` on Ubuntu.

### Setup, research, and implementation checks

| Check              | Exact command or evidence                                                                               | Result                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install once       | `corepack enable`, then `pnpm.cmd install`                                                              | Passed; 87 packages, no dependency changes.                                                                                                              |
| Original rules     | Original GameManager exercised in an ephemeral Node VM; transcript and seven rule probes in RESEARCH.md | Merge ordering, merge points, no-op spawning, target, and blocked-board behavior verified against the original engine. No copied source/assets retained. |
| Independent source | Original creator and independently authored C++ engine, pinned URLs in SOURCES.md                       | Core rules cross-confirmed. Original visible-browser play unavailable; no visual/audio session claimed.                                                  |
| TypeScript         | `pnpm.cmd typecheck`                                                                                    | Passed after the disconnect, privacy and readable-TV changes (exit 0).                                                                                   |
| Formatting         | `pnpm.cmd format`                                                                                       | Passed: all matched files use Prettier code style (exit 0).                                                                                              |
| Own-game tests     | `pnpm.cmd vitest run games/merge-sprint --maxWorkers=1`                                                 | Passed: 6 files, 76 tests, 24.43 seconds, exit 0.                                                                                                        |
| SDK contract       | Included by `games/merge-sprint/__tests__/contract.test.ts` in the own-game command above               | Actual SDK contract suite passed in the 76-test run; discovery is filtered to this game.                                                                 |

Tests cover deterministic replay, mass and scoring invariants, once-per-input
merges, direction symmetry, identical shared draws independent of event order,
stale/duplicate/rapid/spectator inputs, deadline boundaries, pause/resume,
reconnection, dropped-player completion, all-phase views, private future draws,
phone-only play, spectators, and three visible-board bot strategies. These are
coverage descriptions; all passed in the 76-test run.

### Seeded completion simulation — passed

Exact command:

```text
pnpm.cmd exec tsx jobs/P09-2048-race/tools/simulation.ts
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

### Property seeds — passed

Included in the own-game command. Optional isolated reproduction:

```text
pnpm.cmd vitest run games/merge-sprint/__tests__/property.test.ts --maxWorkers=1
```

The source explicitly runs seeds **1, 2, 3**, plus 1,000 generated board cases
under recorded fast-check seed **204809**. A separate replay property generates
1,000 distinct race seeds and combines them with 1, 2, and 3, requiring exactly
1,003 unique seeds. It checks identical initial state, matching player starts,
deterministic timer transitions, equal public views, and absent future draws.
Latest result: **passed** in the 76-test own-game run.

### Mutation check — passed, 20/20 caught

Exact outer command:

```text
pnpm.cmd exec tsx jobs/P09-2048-race/tools/mutate.ts
```

Each mutation runs this focused command after a passing baseline:

```text
pnpm.cmd vitest run games/merge-sprint/__tests__/board.test.ts games/merge-sprint/__tests__/game.test.ts --maxWorkers=1
```

The script passed its unchanged-source baseline, planted one bug at a time,
and restored each source in `finally`. [mutations.json](mutations.json) was read
back: all **20 entries** have `caught: true`, `exitCode: 1`, `error: null`, and
recorded failing-test labels. This exceeds the required **19/20**. Syntax,
import, or type failures alone do not count as caught rule bugs. No mutant is
retained in the implementation.

The table lists each exact planted-bug name and its first recorded failing
test, omitting only the output marker and elapsed milliseconds. The JSON keeps
up to four original failure labels per mutant.

| #   | Planted bug                       | Result         | First recorded failing test                                                             |
| --- | --------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| 1   | merge unequal tiles               | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 2   | wrong merged tile value           | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 3   | half merge points                 | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 4   | reuse the second tile             | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 5   | reverse right input               | Caught; exit 1 | merges once per tile from the edge being approached in all four directions              |
| 6   | ignore vertical merges            | Caught; exit 1 | recognises blocked full boards, and finds vertical as well as horizontal merges         |
| 7   | no empty-cell mobility            | Caught; exit 1 | recognises blocked full boards, and finds vertical as well as horizontal merges         |
| 8   | wrong spawn normalization         | Caught; exit 1 | selects an empty cell by the shared normalized draw and never overwrites occupied cells |
| 9   | always spawn a four               | Caught; exit 1 | selects an empty cell by the shared normalized draw and never overwrites occupied cells |
| 10  | no-op spends a spawn              | Caught; exit 1 | does not spawn, score, count, or spend a draw on a direction that changes nothing       |
| 11  | duplicate input accepted          | Caught; exit 1 | rejects duplicates, future counters, unknown ids and moves faster than 150ms            |
| 12  | no anti-flood interval            | Caught; exit 1 | rejects duplicates, future counters, unknown ids and moves faster than 150ms            |
| 13  | deadline accepts final move       | Caught; exit 1 | ends at the clock, rejects late moves, and lets identical highest scores share first    |
| 14  | target never ends race            | Caught; exit 1 | the first 2048 ends every board and wins even against a higher merge score              |
| 15  | blocked boards never end race     | Caught; exit 1 | ends early once the final live board blocks after a spawn                               |
| 16  | wrong draw index                  | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 17  | score ignores earlier merges      | Caught; exit 1 | adds exactly the merged tile values and one spawn for an accepted move                  |
| 18  | finished loses to higher score    | Caught; exit 1 | the first 2048 ends every board and wins even against a higher merge score              |
| 19  | reveal timer never exits          | Caught; exit 1 | the first 2048 ends every board and wins even against a higher merge score              |
| 20  | future draws leak to public views | Caught; exit 1 | changing future spawn luck and RNG leaves every public view identical in play           |

### Screens and layout — passed

Exact SSR command:

```text
node --import tsx --import ./jobs/P09-2048-race/tools/css-loader.mjs ./jobs/P09-2048-race/tools/render.tsx
```

Fifteen HTML captures have been generated: `play`, `reveal`, and `done`, each
with a TV and player/spectator phones both with a TV and in phone-only mode.
TV is 1920 by 1080; phone is 390 by 844. The harness reserves shell space, embeds
the tokens and loaded SDK/game CSS modules, namespaces classes to avoid style
collisions, supplies the SDK clock/provider, and starts no browser.

Exact PNG/layout command, passed:

```text
node ./jobs/P09-2048-race/tools/capture.mjs
```

One headless browser and one reused page captured all 15 local HTML files.
The Windows launcher required DevToolsActivePort discovery. Cleanup in finally
closes CDP, terminates only exact-profile processes, and verifies zero living
matches, ignoring exited CIM records. Initial failed attempts and their cleanup
are recorded in ASSUMPTIONS.md; no original-game visual session is claimed.

Manual fit verdict: **passed for all 15 PNGs**. Every document scroll size equals
its viewport (1920×1080 TV or 390×844 phone), with zero outside elements and zero
ancestor clipping. TV text is at least 32px, best tiles 64px, scores 48px, and the
play timer 96px. All eight boards/rankings remain visible. Both active phone
modes fit without scrolling and their four targets are 85.5×68px. Spectators
have no buttons; phone-only players see the leader and all eight standings.
Result player phones retain a clear personal result and all eight rows.

The raw report conservatively flags visible font-EM bounds extending beyond
tight line boxes: TV play 185 scroll-bound/122 text-bound flags, TV results
214/149, active phones 4/2. These are not document scrolling or clipping.
Manual review confirmed complete glyphs without collisions; name truncation
uses intentional ellipsis. All spectator/result phones have zero such flags.
The capture wrapper's original 28px TV footer was corrected to 36px and all
screens recaptured; there are now zero TV text-below-32px flags.

After final HTML formatting and PNG capture, refresh every media checksum:

```text
node --import tsx --import ./jobs/P09-2048-race/tools/css-loader.mjs ./jobs/P09-2048-race/tools/render.tsx --hash-only
```

Final `SHA256SUMS.txt` contains **31 verified hashes**, one for every media file.
Total media is **4,218,520 bytes**, below 10 MB. The hash-only command passed;
an independent PowerShell Get-FileHash comparison verified every entry and the
media count. `git diff --check` also passed. Refresh after any recapture.

### CI, pull request, and KEEP GOING — pending

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
