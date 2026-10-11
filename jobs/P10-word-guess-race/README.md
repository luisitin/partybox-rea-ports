# P10 Word Guess Race

Same hidden five-letter word, six guesses, eight phones and three rounds. Each phone has a private clue board and touch keyboard. The TV tracks every player's colored grid with check/arrow/cross marks and no letters. The shared word and points appear together after each round.

This port uses 260 original curated answers and a local house dictionary of 1204 accepted words. Fewer guesses wins a round; equal counts compare active solve time. Earn one point per opponent beaten and add the three rounds. Unsolved players tie at zero.

## Run

From the repository root, install once with Node 24+:

```sh
corepack enable
pnpm install
```

Load `games/word-guess-race/client/tv-entry.ts` and `phone-entry.ts` with the SDK host. There is no runtime service or remote dictionary. Use fixture media under this job's `media/` to inspect every phase without a room server.

## Check

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/word-guess-race
```

The game suite includes the SDK contract, 1,000 seeded full matches at 2, 4 and 8 players, 1,003 property seeds, private-view comparisons, duplicate-letter cases, reconnect and late-input tests, phone-only screens and content validation. Exact results, simulation medians, 20 mutation trials and media review live in [VERIFY.md](VERIFY.md). CI is `.github/workflows/P10.yml`.

## Read

- [Game specification](../../games/word-guess-race/README.md): phases, inputs, scoring and edge cases.
- [RESEARCH.md](RESEARCH.md) and [SOURCES.md](SOURCES.md): source facts, unavailable live research and asset provenance.
- [ASSUMPTIONS.md](ASSUMPTIONS.md): bounded dictionary, timing and task workflow decisions.
- [NEXT.md](NEXT.md): resume point; [LOOP.md](LOOP.md): measured improvements.
- `SHA256SUMS.txt`: hashes for every retained media file, under the 10 MB job budget.
