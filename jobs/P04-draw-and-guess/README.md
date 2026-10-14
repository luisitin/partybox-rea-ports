# P04 Skribbl.io

Run: `r2-local`. Upgrade payload: `games/skribbl`. Branch:
`job/P04-draw-and-guess`.

This payload adds live guessing to the existing Broken Pencil drawing game.
Its standalone workshop manifest is Skribbl.io / skribbl per the owner's name
table; core integration keeps the existing card and telephone mode (UPGRADE.md).
The TV is the live drawing stage;
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
pnpm vitest run games/skribbl
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
