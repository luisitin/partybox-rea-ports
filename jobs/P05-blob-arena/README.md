# P05 Blob Arena

Three 90-second rounds of snack collecting and risky split attacks for 2–8 players.
One TV arena, each phone a joystick and SPLIT; phone-only rooms show the stage above the controls.
Original SVG art, pure deterministic server, three bot strengths, three-second respawns.

## Run

`corepack enable` then `pnpm install` (Windows PowerShell: `pnpm.cmd`).
The port exports `game` from `games/blob-arena/server/index.ts` and TV/phone entry modules.
This workshop has no room host; integrate these entries in the PartyBox shell.
For a local mounted-controller preview: `node jobs/P05-blob-arena/preview.mjs`.
It reports an ephemeral loopback URL; inputs are captured, not reduced into a live match.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/blob-arena --maxWorkers=1`
- `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/generate.mjs`
- `node jobs/P05-blob-arena/mutations.mjs`
- `node --import ./jobs/P05-blob-arena/loader.mjs ./jobs/P05-blob-arena/screens.mjs`

RESEARCH.md and SOURCES.md document the original and the living-room adaptations.
VERIFY.md records exact commands and measured results; NEXT.md is the current handoff.
Media is original rendered HTML/PNG only, with SHA256SUMS.txt.
