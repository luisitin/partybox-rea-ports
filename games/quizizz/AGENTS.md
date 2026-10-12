# quizizz

- README.md is the spec. Keep the finite, self-paced race and public track distinct from a TV-paced quiz.
- Server code is pure. Use only event.now and state.rng; phases compose through the SDK.
- Never send answer keys, the deck, other players' questions or feedback in views.
- Bots use their own visible question and separately authored factual knowledge.
- Run only `pnpm vitest run games/quizizz`; job evidence lives in jobs/P03-trivia-lightning.
- Regenerate fixtures/screens with the job's evidence test after changing state or views.
