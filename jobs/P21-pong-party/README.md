# P21 Pong Party — Octo Rally

An original PartyBox paddle survival game for 2–8 players. Everyone guards one edge of an octagon with a phone slider. Miss a ball and lose a life; more balls enter as the match runs. The last paddle standing, or the best survivor after 60 seconds, wins.

## Run

- Install once: `corepack enable`, then `pnpm install` (Windows: `pnpm.cmd install`).
- Import `game` from `games/pong-party/server/index.ts` in a PartyBox host.
- TV: `games/pong-party/client/tv-entry.ts`; phone: `phone-entry.ts`.
- The public workshop contains the SDK and fixtures rather than a room server.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/pong-party --maxWorkers=1`
- See `VERIFY.md` for simulation, property, mutation, and screen evidence.

## Deliverables

The game, phase fixtures, original SVG art, seeded bot strategy, scoped CI, and reproducible verification tools are on `job/P21-pong-party`. Research and assumptions are recorded beside this file. No original game's code or assets ship in the port.
