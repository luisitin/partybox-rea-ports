# P09 2048

Two to eight players race identical seeded 2048 boards on phones.
First to 2048 wins; at three minutes, highest merge score wins.
The classic280px board, Score/Best HUD, tile motion and terminal overlays
retain the studied original feel. Swipes, arrows and WASD/HJKL control tiles.
The TV shows every live board, score and large best tile; final summaries
show every place. Phone-only rooms and spectators receive the complete stage.

Canonical folder/id/name: `games/2048` / `2048` / **2048**.
Branch: `job/P09-2048-race`; runner: `r1-local`.
[PR #12](https://github.com/luisitin/partybox-rea-ports/pull/12).
A read-only scan found no overlap among126 owner-core game manifests.
The shared manifest pattern permits the official numeric `2048` id; kit CI passes.

Install once: `corepack enable`, then `pnpm install` (Windows: `pnpm.cmd`).
Load server and TV/phone entry points through the published SDK.

```powershell
pnpm.cmd typecheck
pnpm.cmd format
pnpm.cmd vitest run games/2048 --maxWorkers=1 --pool=threads
node --import tsx jobs/P09-2048-race/tools/simulation.ts
node --import tsx jobs/P09-2048-race/tools/mutate.ts
node --import ./jobs/P09-2048-race/tools/css-loader.mjs --import tsx jobs/P09-2048-race/tools/render.tsx
node --import ./jobs/P09-2048-race/tools/css-loader.mjs --import tsx jobs/P09-2048-race/tools/render.tsx --fidelity
node jobs/P09-2048-race/tools/capture.mjs
node jobs/P09-2048-race/tools/fidelity.mjs
node --import tsx jobs/P09-2048-race/tools/interactive-build.mjs
node jobs/P09-2048-race/tools/motion.mjs
node --import tsx jobs/P09-2048-race/tools/evidence.ts
```

Final behavior evidence:119 tests including20 SDK contracts;1,003 bounded
race seeds and1,003 board property cases;21,000 completed bot games across
all seven player counts and three strengths;20/20 behavioral mutation kills.
Maximum completion220,911ms is below the480,000ms manifest limit.
Twenty-nine current static captures cover all phases and stress states.
Five actual accepted-move motion frames verify travel, spawn, merge, score
feedback and the winning-board handoff. Browser ownership closes in finally.

The original classic release was played with ordinary keys in a fresh Chrome
profile. [Matched start/midgame boards, scores and comparison](../../games/2048/fidelity/GAPS.md)
record fidelity and the declared Arial font fallback. Original review PNGs
are evidence only; no upstream game code/fonts/assets ship. Numeric art and
logic are authored here; capture-only host Nunito is SIL OFL licensed.
The3s target/all-blocked payoff survives pause and reload, followed by full
standings reading time. Final TV summaries reduced the fixture hold56.9%.

[VERIFY.md](VERIFY.md) records commands/results and CI; [RESEARCH.md](RESEARCH.md)
and [SOURCES.md](SOURCES.md) record mechanics/provenance; [ASSUMPTIONS.md](ASSUMPTIONS.md)
records limits; [NEXT.md](NEXT.md) is the handoff; [LOOP.md](LOOP.md) records
quality reviews. Current source and all media/fidelity hashes are verified.
