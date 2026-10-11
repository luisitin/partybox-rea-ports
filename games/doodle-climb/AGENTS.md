# doodle-climb

- Read README.md before changing rules. The server owns every landing and fall.
- Pure deterministic server; time only from events, course generation only from state.rng.
- Same platforms and spawn for every seat; independent cameras and no player collisions.
- Keep all four phase fixtures and the score-last → done continuation current.
- Views expose the visible public stage, never the full future course or PRNG state.
- Hold controls must release on pointer cancellation, blur and phase changes.
- Verify only this game: pnpm vitest run games/doodle-climb --maxWorkers=1.
