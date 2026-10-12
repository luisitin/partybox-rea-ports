# P01 Kahoot!

This upgrade extends PartyBox's existing Lightning Round under the canonical Kahoot! name.
It replaces the former standalone Quiz Rush implementation rather than adding a duplicate.
Round-4 `1333563` [CI 38241666750](https://github.com/luisitin/partybox-rea-ports/actions/runs/38241666750) is green; round-5 stakes repair is now applied.
Normal sixteen-seat stakes names improve four ellipses → zero; all scores/marks remain visible.
Current capture PASS 95/95 plus one labelled Finale before baseline; browser 52968 closed.
Full PASS 242/242, 26 files, 484.58 s; types/SSR pass. Two early CSS/helper edits are disclosed;
final SSR ran after fixes, runtime JS/server stayed frozen, and current capture/restoration hashes match.
Media checkpoint 8,710,478 B before loop-5 JSON; final format/hash/push/head CI remain pending.
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
