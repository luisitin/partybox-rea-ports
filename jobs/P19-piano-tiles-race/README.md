# P19 — Tile Tempo

A simultaneous four-lane note race for 2–8 players. Everyone taps the same seeded sequence
on their own phone. Wrong lane ends the run; most correct tiles in thirty seconds wins.
Original name, art and implementation; no original assets or runtime network calls.

## Run

The server exports `game` from `games/tile-tempo/server/index.ts`; client loaders export
`tv` and `phone` from the matching entries. The host supplies players, events and time.
Install once with `corepack enable` and `pnpm install` (Windows: `pnpm.cmd`).

## Check

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/tile-tempo --maxWorkers=1
pnpm tsx jobs/P19-piano-tiles-race/tools/simulate.ts
node jobs/P19-piano-tiles-race/tools/mutate.mjs
pnpm tsx jobs/P19-piano-tiles-race/tools/fixtures.ts
node jobs/P19-piano-tiles-race/tools/capture.mjs
```

The targeted tests include the full SDK contract suite for this game, rules, property checks
and server-rendered phase screens. The capture tool uses one local Chrome process and closes
it in `finally`. PNGs and HTML live in `media/`, below 10 MB; hashes are in SHA256SUMS.txt.
Research, exact verification results, assumptions and improvement rounds live beside this file.
