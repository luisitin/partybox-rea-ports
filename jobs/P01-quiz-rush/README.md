# P01 Quiz Rush

Quiz Rush is PartyBox's live house quiz for 2-8 players. It ships three original packs of twenty
questions: general knowledge, movies and science. Phones beside the TV show four large shape
buttons; phone-only and remote players also see the question and choices.
The movie pack covers sixteen films across animation, comedy, adventure, sci-fi and fantasy.

The TV carries the prompt and answer clock, then a correct-answer/count-chart reveal and a
short standings beat. The final question goes straight to a top-three podium reveal. Questions
advance automatically, and disconnected players never hold the room.

Correct answers earn 500-1,000 base points according to response time. A visible correct-answer
streak bonus rises by 100 after the first consecutive correct answer, capped at 500. Wrong or
missing answers earn zero and break the streak. The bonus is an explicit PartyBox adaptation;
current Kahoot scoring no longer awards streak points.

Choose a pack, 5-20 questions (default 10) and a 10-30 second answer window (default 20).
Every timed screen reserves SDK reading time. Minimum beats are 4.5 seconds for reveals,
3.5 for standings and 2.5 per occupied podium tier, extended for text and animation settling.
Bots have three strengths.

Install once with Node 24 or newer:

```powershell
corepack enable
pnpm install
```

Checks, limited to this game's tests:

```powershell
pnpm typecheck
pnpm format
pnpm vitest run games/quiz-rush
```

The game spec is [games/quiz-rush/README.md](../../games/quiz-rush/README.md).
[VERIFY.md](VERIFY.md) records exact simulation, property, mutation and screen commands/results.
[NEXT.md](NEXT.md) is the resume point; [LOOP.md](LOOP.md) records measured improvement rounds.
The job's CI workflow runs install, typecheck, format and this game's tests.

Research: [RESEARCH.md](RESEARCH.md), [SOURCES.md](SOURCES.md), [ASSUMPTIONS.md](ASSUMPTIONS.md).
Original live play was unavailable in this session; research combines official documentation
with independent firsthand screenshots and empirical studies. No original code, questions,
art, audio or trademarks are shipped, and the game makes no network calls at runtime.
