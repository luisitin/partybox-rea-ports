# P04 Draw and Guess

Run: `r2-local`. Game: `games/draw-and-guess`. Branch:
`job/P04-draw-and-guess`.

This port turns a private word choice, phone drawing and speed-weighted guesses
into a two-to-eight-player PartyBox game. The TV is the live drawing stage;
phone-only rooms receive the stage on every phone. It ships 300 original words
in three difficulties and seeded bots with three strengths.

Node 24+ and the repository's pinned pnpm are required. Install once:

```sh
corepack enable
pnpm install
```

Check only this game's tests, plus repository static checks:

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/draw-and-guess
```

On Windows PowerShell with script execution disabled, use `corepack.cmd` and
`pnpm.cmd`. The module entries are `client/tv-entry.ts` and
`client/phone-entry.ts`; the server exports `game` from `server/index.ts`.
The public workshop exposes plugins rather than a full PartyBox hosting app.

Read the game README for phases, phone-only behavior, inputs, scoring and
settings. `RESEARCH.md` records original mechanics and adaptations;
`SOURCES.md` gives independent references; `ASSUMPTIONS.md` records access
limits. `VERIFY.md` contains exact checks, simulations, property/mutation
results and screen review. `media/` contains review artifacts with hashes in
`SHA256SUMS.txt`. `NEXT.md` is the current handoff and `LOOP.md` records the
KEEP GOING improvements.

No original source code, content packs, assets or audio is shipped. No new
dependencies or network calls at runtime. The job-specific CI workflow runs
install, typecheck, formatting and the game's tests on its pull-request paths.
