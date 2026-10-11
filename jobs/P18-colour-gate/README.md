# P18 Colour Gate

Original PartyBox port of the one-tap colour-match obstacle mechanic. 2-8 simultaneous
players race identical seeded courses in TV lanes, with automatic colour changes,
checkpoint retries, three 45-second rounds, phone-only stage and three bot strengths.

## Run

1. `corepack enable`
2. `pnpm install` (`pnpm.cmd` in restricted Windows PowerShell)
3. Import `game` from `games/colour-gate/server/index.ts` in a PartyBox host.
4. Load `client/tv-entry.ts` and `client/phone-entry.ts` for the corresponding surfaces.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/colour-gate --maxWorkers=1`
- Tools under this folder generate fixtures, run targeted simulations, plant isolated
  mutations and render every phase to static HTML for captures.
- `VERIFY.md` records exact commands and observed results. `LOOP.md` records repeated
  player-facing reviews. `NEXT.md` is the resumable handoff.

Spec: `games/colour-gate/README.md`. Research and asset provenance: `RESEARCH.md` and
`SOURCES.md`. All graphics are original SVG/CSS geometry using PartyBox tokens.
