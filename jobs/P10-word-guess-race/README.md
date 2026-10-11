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

The game suite covers the SDK contract, private-view comparisons, duplicate letters, reconnects, late inputs, phone-only screens and content validation. Properties run 1,000 cases under each generator seed 1, 2 and 3. `pnpm exec tsx jobs/P10-word-guess-race/simulation.ts 1000` separately runs 21,000 seeded matches across all counts 2–8 and all three bot strengths. Exact results, medians, 20 mutation trials and media review live in [VERIFY.md](VERIFY.md). CI is `.github/workflows/P10.yml`.

## Read

- [Game specification](../../games/word-guess-race/README.md): phases, inputs, scoring and edge cases.
- [RESEARCH.md](RESEARCH.md) and [SOURCES.md](SOURCES.md): source facts, unavailable live research and asset provenance.
- [ASSUMPTIONS.md](ASSUMPTIONS.md): bounded dictionary, timing and task workflow decisions.
- [NEXT.md](NEXT.md): resume point; [LOOP.md](LOOP.md): measured improvements.
- `SHA256SUMS.txt`: hashes for every retained media file, under the 10 MB job budget.
