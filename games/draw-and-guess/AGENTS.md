# Draw and Guess

- README.md is the spec. Keep its scores and phase tables current.
- Imports only from @partybox/game-sdk; client may also import React.
- Server is pure. Time comes from events; random choices use the state PRNG.
- Never send word choices or the answer to guessers before reveal.
- One file per phase; regenerate fixtures with the job's evidence test.
- Check with pnpm vitest run games/draw-and-guess, typecheck and format.
