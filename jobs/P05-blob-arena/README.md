# P05 Agar.io

Upgrade of the existing `games/agar-io` port for 2–8 players: three shared 90-second rounds,
current mass at each horn becomes points, and equal final totals share the win.
Swallowed players watch the live contest for three seconds before returning to the same round.
Live leaders can lose or transfer mass; a large banked deficit may still be out of reach.
Phones steer and split, the TV shows the shared arena, and phone-only play follows your cells.
Horn departures bank once; pause and reconnect preserve clocks while stopping stale steering.
Score summaries use the SDK reading floor and retain every original seat in the standings.

## Run

Node 24+ is required. Installation is already complete in this clone.
For a fresh clone, run `corepack enable`, then `pnpm install` once.
Use `pnpm.cmd` instead of `pnpm` in Windows PowerShell.
The game exports its server definition and TV/phone entries; this workshop has no room host.
`node jobs/P05-blob-arena/preview.mjs` starts an owned, ephemeral loopback preview.
The preview mounts shipped components and sends inputs, timers, pause and connection events
through the actual `game.reduce`; authored stress preconditions are labelled in its history.
Ctrl+C closes the preview. It is a local harness, with no networked room or engine sockets.

## Check

Run serially against frozen source; mutation work must restore original bytes before other checks.
The full game tests include SDK contracts, seeded properties and 7,000 matches at 2–8 players.

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/agar-io --maxWorkers=1 --pool=threads`
- `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/generate.mjs`
- `node jobs/P05-blob-arena/mutations.mjs`
- `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/screens.mjs`
- `node jobs/P05-blob-arena/capture-owned.mjs`
- `node jobs/P05-blob-arena/fidelity-r1.mjs`

Each capture command owns one Chrome, closes it in `finally`, and runs separately.
Native capture mounts all 63 phase/role/stress screens in the pinned owner framing and checks
real steering, split, pause, disconnect, scoring, final results, motion and cleanup.
Fidelity capture requires `gh` and Chrome. It fetches the pinned May 1, 2015 archived client
to OS-temp and replays binary packets through its unchanged parser and canvas renderer.
Deterministic reference frames expose observed camera matrices and named body polygons;
the shipped Arena renders the same authored scenes. These are arena-only pairs, with HUD
and native controls checked separately. They do not establish a live original match.

## Evidence status

Five reference scenes and five motion samples pass; camera error is below0.001pixel,
painted growth error below0.3pixel, and name sizing matches. Browsers leave zero owned processes.
Final verification is pending SDK merge alignment, fresh mutations/native captures and CI.
Fresh full tests, source-bound captures, CI and the required post-green reviews must agree.
`VERIFY.md` records commands/results; `NEXT.md` is the handoff; `RESEARCH.md` and `SOURCES.md`
identify the original evidence and party adaptations. Inspect every final PNG and ranked
`games/agar-io/fidelity/GAPS.md`; `SHA256SUMS.txt` binds the media, kept below 10 MB.
