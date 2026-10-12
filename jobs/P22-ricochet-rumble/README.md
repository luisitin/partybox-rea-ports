# P22 Tank Trouble

Tank Trouble is a five-round maze-tank game for 2-8 players. Hold phone controls to
drive, reverse and turn; hold Fire for bouncing shells. Your own ricochets can hit you.
The TV shows the shared maze. Phone-only and remote phones carry that same public stage.

The last tank standing earns a round win. Each new round uses a fresh seeded connected
maze. Three bot strengths fill empty seats. All art is original SVG and CSS.

Install once with Node 24 or newer:

```powershell
corepack enable
pnpm install
```

Run only this game's tests:

```powershell
pnpm.cmd typecheck
pnpm.cmd format
pnpm.cmd vitest run games/tank-trouble --maxWorkers=1 --pool=threads
```

The [game spec](../../games/tank-trouble/README.md) describes the mechanics and screens.
[RESEARCH.md](RESEARCH.md) and [SOURCES.md](SOURCES.md) record the original flow.
[VERIFY.md](VERIFY.md) records checks; [NEXT.md](NEXT.md) is the resume point.
[LOOP.md](LOOP.md) records the required player-focused improvement loop.

No original code or assets are copied, no new dependencies are added, and no runtime
network calls are made. Remaining research limitations belong in [ASSUMPTIONS.md](ASSUMPTIONS.md).
