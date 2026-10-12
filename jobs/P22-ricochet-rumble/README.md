# P22 Tank Trouble

Tank Trouble is a five-round maze-tank game for 2-8 players. Drag a steering thumb to
drive and turn together; hold Fire with the other thumb. Your own ricochets can hit you.
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

The [game spec](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/games/tank-trouble/README.md) describes the mechanics and screens.
[RESEARCH.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/RESEARCH.md) and [SOURCES.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/SOURCES.md) record the original flow.
[VERIFY.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/VERIFY.md) records checks; [NEXT.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/NEXT.md) is the resume point.
[LOOP.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/LOOP.md) records the required player-focused improvement loop.

No original code or assets are copied, no new dependencies are added, and no runtime
network calls are made. Remaining research limitations belong in [ASSUMPTIONS.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P22-ricochet-rumble/jobs/P22-ricochet-rumble/ASSUMPTIONS.md).
