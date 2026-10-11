# P14 Crossy Streets

Complete PartyBox Arcade port of endless crossing mechanics: one public seeded map, four-direction phone hops, roads, moving river logs, progress-pressure eagle, checkpoints, respawns, a 60-second distance race, and tied final results. Original inline SVG art; 2–8 players; phone-only/remote stages; spectators; three honest bot strengths.

## Run

Node 24+, dependencies installed with `corepack enable` then `pnpm install`.
The host loads `games/crossy-streets/server/index.ts`, `client/tv-entry.ts` and `client/phone-entry.ts` through the normal SDK contract. This workshop has no full shell server or registry generator.

## Check

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/crossy-streets --maxWorkers=1
pnpm tsx jobs/P14-crossy-streets/fixtures.ts
pnpm tsx jobs/P14-crossy-streets/simulate.ts
```

VERIFY.md records real commands and results, simulations, property seeds, mutations and per-phase screen evidence. Media SHA256SUMS.txt records every rendered artifact. LOOP.md records the KEEP GOING passes after scoped PR CI is green.

## Evidence

RESEARCH.md separates two independent original-game play reports, developer evidence, public remake client inspection and PartyBox adaptations. SOURCES.md records provenance. ASSUMPTIONS.md records the unavailable original-play browser and chosen timings. No original assets/code or additional dependency is shipped.

NEXT.md is the current resume point. The branch is `job/P14-crossy-streets`, runner `r10-local`.
