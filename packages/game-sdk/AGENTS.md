# game-sdk — local rules

- This is the whole API surface for games. Adding an export here is a product decision: document it in its module's `docs/sdk/<module>.md` (a new module: a new doc + a line in the README).
- Helpers on state are pure and return `[value, nextState]`; never mutate arguments.
- Primitives are dumb React components with explicit props; no sockets, no global state, tokens only.
- Contract tests must stay game-agnostic: read each game's `contract.config.ts` for hidden fields, never special-case ids.
- Only import from `@partybox/shared` and `react`. Keep `src/index.ts` free of React/CSS (ADR-023); UI goes through `src/ui.ts`.
- `src/match.ts` + `src/match/` import only each other: no zod, React, Node or locale APIs (phones download it; ADR-048).
- `src/speech/` is server-only and pure like a game's `server/` (lint): it runs inside `speech(state)`.
- Test: `pnpm vitest --project game-sdk`, `pnpm vitest --project contract` (the kit's own tests) and `pnpm vitest --project 'contract*'` (every game).
