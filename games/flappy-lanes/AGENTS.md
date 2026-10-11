# flappy-lanes — local rules

- README.md is the spec. Keep the identical-course fairness and simultaneous-death ties.
- Server code is pure; time comes from events and courses from state.rng.
- Judge collisions before applying a flap; dead gliders never return until the next round.
- The shell owns the initial countdown. The game begins in play.
- Future gates stay out of every view; bots use only the visible next gate.
- Every phase has a fixture. Regenerate them with the job's tools/fixtures.ts.
- Tests: pnpm vitest run games/flappy-lanes --maxWorkers=1.
