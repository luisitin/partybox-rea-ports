# P15 Doodle Climb

Automatic bouncing, hold-left/right steering and a shared seeded platform course for 2–8 players. Three climbing rounds with independent cameras, wrapping edges, spring platforms, maximum-height scoring and bot opponents at three strengths. Includes the TV stage, phone controllers, phone-only spectator stage, fixtures and original SVG art.

## Run

Node 24+, `corepack enable`, `pnpm install`. The plugin exports `game` from `games/doodle-climb/server/index.ts`, `tv` and `phone` from its client entry files for the PartyBox host. This workshop publishes plugins and has no standalone host server.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/doodle-climb --maxWorkers=1`
- `pnpm tsx jobs/P15-doodle-climb/tools/fixtures.ts`
- Mutation/simulation/screen commands and results are recorded in VERIFY.md.

The game spec is `games/doodle-climb/README.md`. Research/provenance, assumptions, verification evidence, screenshots and resumable state live in this job folder. No copied assets or new runtime dependencies.
