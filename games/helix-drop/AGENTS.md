# helix-drop — local rules

- README.md is the spec. Keep its controls, timings and scoring true.
- Server code is pure; time comes from events and tower generation from state.rng.
- Every phase has one reducer file and a JSON fixture.
- Only SDK imports in game code, plus React in client code.
- Verify only this game: pnpm vitest run games/helix-drop --maxWorkers=1.
- Job evidence and tools live in jobs/P17-helix-drop/.
