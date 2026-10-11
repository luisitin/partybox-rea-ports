# contract-tests

Runs the game contract (docs/GAME_CONTRACT.md) against **every** folder in `games/` automatically.
Wired in Phase 3. `pnpm vitest --project 'contract*'` runs this suite in six shards (T-0565); the `contract` project alone holds the kit's own tests.
