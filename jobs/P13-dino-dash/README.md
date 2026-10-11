# P13 Dino Dash

A complete PartyBox arcade runner for 2–8 players, with phones as jump/duck controls,
three strengths of bots, a shared seeded course and phone-only play.

## Run

Install once with `corepack enable` and `pnpm install`. Import `game` from
`games/dino-dash/server/index.ts` and the separate TV/phone entries into the PartyBox shell.
This workshop supplies the SDK, not a full room server.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/dino-dash --maxWorkers=1`
- `pnpm tsx jobs/P13-dino-dash/fixtures.ts`
- `pnpm tsx jobs/P13-dino-dash/simulate.ts`
- `node jobs/P13-dino-dash/mutate.mjs`

`VERIFY.md` records measured results. `RESEARCH.md` distinguishes observed source rules
from the living-room adaptation. `media/` holds each rendered phase; `SHA256SUMS.txt`
identifies every media artifact. `NEXT.md` is the resumable handoff.
