# shared — local rules

- Pure. zod is the only dependency. No `Date.now`, no `Math.random` (the PRNG takes explicit state).
- Every socket payload and every manifest/content shape has a zod schema here; TS types derive from schemas.
- Changing `contract.ts` changes every game: write an ADR in `docs/DECISIONS.md` first.
- Add to `src/index.ts` when you add a public symbol; games reach these through `@partybox/game-sdk`.
- Test: `pnpm vitest --project shared`.
