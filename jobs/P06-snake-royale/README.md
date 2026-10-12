# P06 Slither.io

A complete PartyBox snake growth-and-cutoff arena for 2–8 guests, with bots, a TV stage and phone-only play. Eat sparks, spend size to boost, cut off rivals, collect the edible wreckage and return after a short crash. Current mass scores at the end of each 90-second round.

The public browser client was inspected read-only, with two independent primary studies and the original developer description. All implementation and SVG/CSS art are original. Exact original boost constants and head-head arbitration are not claimed.

## Run

`corepack enable`, `pnpm install`; load `games/slither-io/server/index.ts` and the phone/TV entries through a PartyBox host. This workshop exposes the real SDK and fixtures but does not ship the shell.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/slither-io --maxWorkers=1`
- The game-local contract wrapper executes the actual SDK contract suite for only this game.
- Seeded simulations, property tests, mutation results and screen artifacts are detailed in VERIFY.md.

Specification: `games/slither-io/README.md`. Research/source limits: RESEARCH.md and SOURCES.md. Resume status: NEXT.md. Quality iterations: LOOP.md. Media hashes: SHA256SUMS.txt.
