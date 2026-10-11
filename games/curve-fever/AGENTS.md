# curve-fever — local rules

- Spec lives in README.md (required headings); keep it true when rules change.
- One file per phase under server/phases/; every phase in `phases` has fixtures/<phase>.json.
- Imports: only @partybox/game-sdk (+ react in client/). server/ is pure (no Date.now, Math.random, timers, I/O).
- Regenerate fixtures after changing state shape: pnpm sim --game curve-fever --dump-fixtures --players 4
- Test: pnpm vitest --project games · pnpm vitest --project 'contract*' -t 'contract: games/curve-fever' · pnpm sim --game curve-fever --players 6 --runs 200
