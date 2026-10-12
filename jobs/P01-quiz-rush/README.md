# P01 Kahoot!

This upgrade extends PartyBox's existing Lightning Round under the canonical Kahoot! name.
It replaces the former standalone Quiz Rush implementation rather than adding a duplicate.
Round 1 passed 226 tests, typecheck and formatting in
[CI](https://github.com/luisitin/partybox-rea-ports/actions/runs/38229318876) at `4cf1a53`; PR #2 is open.
Evidence includes 32,000 bot matches and 20 mutation kills. Round 2 corrected the capture shell:
pinned TV geometry leaves a 692 px stage/626 px inner area, with the actual Nunito font and h2 rules.
All 91 captures pass fit checks; evidence totals 8,957,011 B and browser PID 96636 is closed.
A later rank separator awaits focused recapture; the full game run (21307) is active.
Fresh checks and the KEEP GOING loop remain pending; round 2 is not complete.

The upgrade preserves 1–16 players, EN/ES libraries, category/topic draws, speed points,
a 300-point streak cap, custom/preset final wagers and the existing minigame. Classic adds three
original twenty-question packs, stamped answers, shape-only TV-side pads and occupied podium tiers.
Ordinary wager reveals separate chart/race and ranked standings; visible-TV phones switch to a
compact receipt, while staged phones show the public board. Final bets include all sixteen totals.
Classic uses a board for 3+ tied players at a rank; pairs retain readable wrapping podium names.
The game owns reveal rosters; duplicate shell strips hide while retaining their height.
Phone-only, remote and spectator phones receive the stage; spectators cannot answer.
Both modes use reading-safe holds and a default 15-second requested answer minimum. Classic draws
exactly the requested count; wager retains its extra final. The manifest estimate is 26 minutes,
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
[VERIFY.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/VERIFY.md) separates current checks from historical standalone results.
[NEXT.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/NEXT.md) is the resume point; [LOOP.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/LOOP.md) records measured improvement rounds.
The job's CI workflow runs install, typecheck, format and this game's tests.
The [core host migration handoff](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/core-base/HOST_MIGRATION.md) remains unapplied to the owner's separate core checkout.

Research: [RESEARCH.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/RESEARCH.md), [SOURCES.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/SOURCES.md), [ASSUMPTIONS.md](https://github.com/luisitin/partybox-rea-ports/blob/job/P01-quiz-rush/jobs/P01-quiz-rush/ASSUMPTIONS.md).
Original live play was unavailable; research pairs official guides with independent firsthand
screenshots and empirical studies. Owner-authorized code and attributed content are reused;
publisher code/art/audio are excluded. Nunito capture assets retain their OFL licence.
No new dependencies or runtime network calls are added.
