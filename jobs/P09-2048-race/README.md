# P09 2048

Two to eight players race identical seeded 2048 boards on phones.
First to 2048 wins; at three minutes, highest merge score wins.
Swipes, arrow buttons and keyboard arrows control the board. The TV shows every
board, best tile, score and rank. Phone-only rooms and spectators have a full stage.

Canonical folder/id/name: `games/2048` / `2048` / **2048**.
Branch: `job/P09-2048-race`; runner: `r1-local`.
[PR #12](https://github.com/luisitin/partybox-rea-ports/pull/12).
A fresh read-only scan found no overlap among 126 owner-core game manifests.

Install once: `corepack enable`, then `pnpm install` (Windows: `pnpm.cmd`).
Load the server and TV/phone entry points through the published SDK.

```powershell
pnpm.cmd typecheck
pnpm.cmd format
pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads
node --import tsx jobs/P09-2048-race/tools/simulation.ts
node --import tsx jobs/P09-2048-race/tools/mutate.ts
node --import ./jobs/P09-2048-race/tools/css-loader.mjs --import tsx jobs/P09-2048-race/tools/render.tsx
node jobs/P09-2048-race/tools/capture.mjs
node --import tsx jobs/P09-2048-race/tools/evidence.ts
```

Pre-pacing baseline: 102 tests including 20 SDK contracts; 1,003 bounded race
seeds and 1,003 board property cases; 21,000 completed bot games across all counts
and strengths; 20/20 behavioral mutation kills; 27 manually reviewed static
captures. Long-name TV overflow, reconnect dead air, pause cooldown, board-caption
overlap, spectator ordering and Bot/Away labels are repaired.

Research pairs the original creator's engine with an independent implementation.
Original-engine VM play/probes are documented; live visual/audio research was
retried but no browser provider was available. Code and numeric art are original.
Capture-only Nunito is licensed under SIL OFL; no new runtime dependency is added.

[VERIFY.md](VERIFY.md) records commands/results and CI; [RESEARCH.md](RESEARCH.md)
and [SOURCES.md](SOURCES.md) record mechanics/provenance; [ASSUMPTIONS.md](ASSUMPTIONS.md)
records limits; [NEXT.md](NEXT.md) is the handoff; [LOOP.md](LOOP.md) records quality
reviews. Source and media hashes are regenerated and independently checked.
