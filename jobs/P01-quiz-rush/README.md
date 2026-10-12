# P01 Kahoot!

This upgrade extends PartyBox's existing Lightning Round under the canonical Kahoot! name.
It replaces the former standalone Quiz Rush implementation rather than adding a duplicate.
The additive wager/classic implementation passes 224 tests, typecheck and formatting.
Evidence includes 32,000 bot matches, 20 mutation kills and 78 clean captures.
CI and the required KEEP GOING completion gate remain pending.

The preserved baseline supports 1–16 players, English/Spanish question libraries, category/topic
draws, speed points, a 300-point streak cap, custom/preset final wagers and the existing minigame.
Classic mode adds three original twenty-question packs, shape-only phone pads beside a TV,
stamped answers and an occupied-tier podium revealed third through first.
Phone-only, remote and spectator phones receive the question stage; spectators cannot answer.
Both modes use reading-safe phase holds with a 15-second requested answer minimum. Classic draws
the exact requested count; wager retains its extra final. The manifest estimate is 26 minutes,
with an adjustable prediction based on question and player counts.

Install once with Node 24 or newer:

```powershell
corepack enable
pnpm install
```

Checks, limited to this game's tests:

```powershell
pnpm.cmd typecheck
pnpm.cmd format
pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads
```

The [game spec](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/games/kahoot/README.md) describes both modes.
[VERIFY.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/VERIFY.md) separates the new checks from historical standalone results.
[NEXT.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/NEXT.md) is the resume point; [LOOP.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/LOOP.md) records measured improvement rounds.
The job's CI workflow runs install, typecheck, format and this game's tests.
The [core host migration handoff](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/core-base/HOST_MIGRATION.md) remains unapplied to the owner's separate core checkout.

Research: [RESEARCH.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/RESEARCH.md), [SOURCES.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/SOURCES.md), [ASSUMPTIONS.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/ASSUMPTIONS.md).
Original live play was unavailable in this session; research combines official documentation
with independent firsthand screenshots and empirical studies. Owner-authorized PartyBox code
and attributed legacy content are reused; publisher code, art and audio are excluded.
No new dependencies or runtime network calls are added.
