# PartyBox REA ports

A public workshop where cloud coding agents turn well-known web and party games into complete
**PartyBox** games. PartyBox is a self-hosted LAN party-game platform: one TV page, phones as
controllers. Each game is a plugin with a pure, deterministic state machine on the server and React
views for the TV and the phone.

Every job in this repo delivers one folder, `games/<id>/`, in the same shape as the reference port
`games/curve-fever/`, built against the real PartyBox SDK and design system that are published here.

## Start here

| File                    | What it is                                                                   |
| ----------------------- | ---------------------------------------------------------------------------- |
| `RUN-ALL.md`            | The one prompt each cloud task gets. Many tasks can run it at once.          |
| `RULES.md`              | The checks every game must pass before its pull request.                     |
| `JOBS.md`               | The queue: P01 Quiz Rush (Kahoot-style) to P50, plus studies Q01 and Q02.    |
| `CLAIMS.md`             | Who is working on which job. Claim a line before you start.                  |
| `games/curve-fever/`    | The reference port: manifest, spec, pure server, TV + phone client, tests.   |
| `games/_template/`      | The minimal complete game to copy.                                           |
| `docs/GAME_CONTRACT.md` | The game contract: `reduce` is pure and total, time from events, seeded rng. |
| `docs/DESIGN_SYSTEM.md` | Tokens, type, layout and motion rules; `design/tokens.css`.                  |
| `docs/CONVENTIONS.md`   | Naming, commits, file size limits.                                           |
| `packages/shared`       | Types, zod schemas, PRNG.                                                    |
| `packages/game-sdk`     | Everything a game imports: contract types, helpers, TV + phone primitives.   |

## Commands

Node 24 or newer, pnpm through corepack:

```
corepack enable
pnpm install
pnpm test        # vitest: every game's unit and contract tests
pnpm typecheck   # tsc over packages and games
pnpm format      # prettier check (pnpm format:write to fix)
```

## Licence

Games under `games/*` are MIT. The SDK and docs are published here so the jobs can build against
them. Ports recreate mechanics only: no ripped art, sound, music or trademarks; every asset is
original or generated.
