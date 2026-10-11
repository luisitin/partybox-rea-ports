# P11 Block Clash

Original PartyBox falling-block versus game for 2–8 players.

Run: `corepack enable`, `pnpm install`.
Check: `pnpm typecheck`, `pnpm format`, `pnpm vitest run games/block-clash`.
Game: `games/block-clash`; CI: `.github/workflows/P11.yml`.

Every player has a seeded 10×20 board. Clear lines to send garbage to a chosen rival.
The last survivor wins; at the two-minute limit survivors rank ahead of eliminated players.
Phones carry their own board, thumb controls and a rival selector. The TV shows all boards.
Phone-only rooms show the standings on each phone; spectators have no controls.

Research, source licences, verification evidence, assumptions and improvement rounds live
beside this file. Generated phase captures are in `media/` with `SHA256SUMS.txt`.

Runner: `r11-local`. Branch: `job/P11-tetris-clash`.
