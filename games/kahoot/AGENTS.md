# kahoot — local rules

- README.md is the spec; update it with any rule change.
- Each phase has its own server/phases file and fixtures JSON.
- Server imports only @partybox/game-sdk; pure, seeded and JSON only.
- Never spread a Question into a view: correct and explanation are secret until reveal.
- Bot knowledge is authored separately; never read the shuffled answer key in bot.ts.
- Test only this game: pnpm vitest run games/kahoot.
- P01's historical evidence: jobs/P01-quiz-rush/.
- Current teams/vote evidence and resumable handoff: jobs/P02-quiz-rush-teams/.
