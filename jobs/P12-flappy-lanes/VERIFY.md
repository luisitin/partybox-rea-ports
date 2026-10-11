# P12 verification

Run: `r13-local`; game: `games/flappy-lanes`; branch: `job/P12-flappy-lanes`.

This record uses the actual SDK and game source. Commands stay scoped to this game;
no whole-suite browser run was used. No dependencies or runtime network calls were added.

| Check         | Exact command / method                                                                                              | Result                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install       | `corepack enable`; `pnpm.cmd install`                                                                               | Passed. Windows PowerShell blocks the pnpm.ps1 shim, so the .cmd shim is used locally.                                                                                                                                                                                                                                             |
| Types         | `pnpm.cmd typecheck`                                                                                                | Passed, including the final server/client source repeat.                                                                                                                                                                                                                                                                           |
| Formatting    | `pnpm.cmd format`                                                                                                   | Passed: all matched files use Prettier code style.                                                                                                                                                                                                                                                                                 |
| Game + SDK    | `pnpm.cmd vitest run games/flappy-lanes --maxWorkers=1 --pool=threads`                                              | Passed: 76/76 assertions in 4 files, including shuffled-roster lane identity and off-grid collision regressions. Actual SDK contract suite is loaded with discovery restricted to Flappy Lanes.                                                                                                                                    |
| Properties    | Same scoped test command                                                                                            | Seeds 1, 2, 3 and 1,000 generated cases for each property; deterministic course/physics, JSON round trips, collision bounds, SDK event fuzzing and replay at 2–8 players.                                                                                                                                                          |
| Simulation    | `node --import tsx jobs/P12-flappy-lanes/tools/simulate.ts 1000`                                                    | Passed: all 21,000 matches terminated; maximum 159,000 ms against a 360,000 ms budget. See the median table below. Runs every count 2–8 at easy, normal and sharp strengths, 1,000 seeds each (21,000 matches).                                                                                                                    |
| Mutations     | `node jobs/P12-flappy-lanes/tools/mutate.mjs`                                                                       | Passed: 20/20 caught by failed assertions; every original restored and SHA-256 checked. Twenty source changes, independently tested and restored; assertion failures count as detection, compilation failures do not.                                                                                                              |
| Fixtures      | `node --import tsx jobs/P12-flappy-lanes/tools/fixtures.ts`                                                         | Passed. All three phases and last-round score fixture come from real reducer play.                                                                                                                                                                                                                                                 |
| HTML screens  | `node --import ./jobs/P12-flappy-lanes/tools/register-css.mjs --import tsx jobs/P12-flappy-lanes/tools/screens.tsx` | Passed: actual React components rendered through react-dom/server, 12 TV/paired-phone/phone-only/spectator views.                                                                                                                                                                                                                  |
| PNG + fit     | `node jobs/P12-flappy-lanes/tools/capture.mjs`                                                                      | All 12 PNGs and fit metrics generated with one reused headless browser, closed in finally. Every view has zero overflowing elements and exact viewport scroll dimensions; TV play clock is 96 px. Windows retained the initial capture profile after closure; the debugger endpoint is unreachable and no capture browser remains. |
| Visual review | Open PNGs in `media/` by hand                                                                                       | Play, score and done are readable; all eight seats remain visible on the phone-only stage, controls fit 390×844, TV fits 1920×1080. Media total 2.1 MB, below 10 MB.                                                                                                                                                               |
| Media hashes  | `node jobs/P12-flappy-lanes/tools/hash-media.mjs`                                                                   | Passed: SHA256SUMS.txt covers all 26 media files; regenerated after any HTML or capture changes.                                                                                                                                                                                                                                   |
| CI            | `.github/workflows/P12.yml`                                                                                         | PR workflow pending. Ubuntu, 30-minute timeout, read-only permissions, actions/* only; frozen install, types, formatting and this game's tests.                                                                                                                                                                                    |

## Fairness and lifecycle regressions

Identical seeded courses for every lane; hidden future gates differ without changing views;
simultaneous collisions tie even when flap messages arrive in reverse order; earlier deaths
award one point to each later survivor; finish is counted once. Invalid/stale/early timers,
duplicate/invalid flaps, pause/resume, disconnect/reconnect and round-count settings are covered.

Simulation output belongs in `simulation.json`; individual mutation outcomes in `mutations.json`.
The KEEP GOING observations and measurements are recorded in `LOOP.md` after green PR CI.

## Full simulation medians

| Strength | 2 players | 4 players | 8 players |
| -------- | --------- | --------- | --------- |
| easy     | 3.62 s    | 4.12 s    | 5.88 s    |
| normal   | 17.54 s   | 44.44 s   | 45 s      |
| sharp    | 45 s      | 45 s      | 45 s      |

## Source mutations

| #   | Planted bug                                 | Detected |
| --- | ------------------------------------------- | -------- |
| 1   | ties earn points                            | Yes      |
| 2   | survivors rank as first dead                | Yes      |
| 3   | scores replace previous rounds              | Yes      |
| 4   | one extra round                             | Yes      |
| 5   | one survivor does not finish                | Yes      |
| 6   | flap cooldown removed                       | Yes      |
| 7   | flap has no upward impulse                  | Yes      |
| 8   | gravity displacement doubled                | Yes      |
| 9   | falling velocity is unbounded               | Yes      |
| 10  | top ignores bird radius                     | Yes      |
| 11  | floor ignores bird radius                   | Yes      |
| 12  | gap edge ignores bird radius                | Yes      |
| 13  | horizontal collision ignores radius         | Yes      |
| 14  | gate counts before its trailing edge clears | Yes      |
| 15  | world cap removed                           | Yes      |
| 16  | judges a sample in the future               | Yes      |
| 17  | future gates leak                           | Yes      |
| 18  | stale play timer accepted                   | Yes      |
| 19  | resume leaves start clock behind            | Yes      |
| 20  | flap rescues an already overlapping bird    | Yes      |
