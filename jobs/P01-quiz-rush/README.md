# P01 Kahoot!

This upgrade extends PartyBox's existing Lightning Round under the canonical Kahoot! name.
It replaces the former standalone Quiz Rush implementation rather than adding a duplicate.
Round-3 pacing is complete: 240 tests, 32,000 bots, 2,006 property seeds, 20 mutation kills and
[CI 38239089152](https://github.com/luisitin/partybox-rea-ports/actions/runs/38239089152) green at `bd91828`; later Finale/start-copy source changes belong to round 4.
Real Results fit now retains all sixteen bet/delta/totals at 32 px; EN/ES start copy describes both modes.
Current 94/94 captures are clean; one explicit before-repair baseline has 85 clipped items.
Media: 235 files/8,279,094 B. Browser 87684 closed; temporary-profile EPERM cleanup is deferred.
Typecheck, 42/42 SSR and nine renderer checks pass; full session 60859 and final format/hash/push/head CI remain pending.
No no-gain rounds or DONE are claimed; three consecutive no-gain rounds remain required.

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
