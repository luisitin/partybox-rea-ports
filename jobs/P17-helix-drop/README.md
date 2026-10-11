# P17 Helix Drop

Run `corepack enable`, `pnpm install`, then `pnpm vitest run games/helix-drop --maxWorkers=1`.
The game is a simultaneous tower descent for 2–8 players with hold-left/right phone controls.
Everyone receives the same seeded tower. Deepest completed floor wins; danger costs a life.

Verification: `pnpm typecheck`, `pnpm format`, and the game tests (including SDK contract checks).
Evidence and commands: VERIFY.md. Research: RESEARCH.md and SOURCES.md.
Resume status: NEXT.md. Improvement rounds: LOOP.md.
