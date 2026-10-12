# kahoot - local rules

- Spec lives in README.md (required headings); keep it true when rules change — the stress session
  checks "scores never decrease" against it, and the final wager is the one allowed decrease.
- One file per phase under server/phases/ exporting `enterX` + `reduceX(state, event, next)`; the
  successor is injected from server/index.ts (`advance`) so phase files never import each other.
- Hidden info is omitted by KEY (`correctIndex`, `pickIndex`, `wagerAmount`), never set to null —
  `__tests__/contract.config.ts` asserts those key names are absent before the reveal.
- Questions are referenced by id; content/questions.json is the truth (6 153 items, 10 categories × 59
  topics, balanced `answerIndex`). Add questions with a `source` note and a `subcategory` from
  content/schema.ts; never time-sensitive facts. The topics checklist is a `multiselect` setting (ADR-034).
  Every existing wager-library English id also needs its Spanish twin in content/questions.es.json (or a `dropped` entry): content-es.test.ts. Separate authored classic packs are English-only under the P01 brief.
- Group flows extend this canonical reducer; never restore the retired standalone engine or another picker card. Fixed teams, discussion and room voting use stamped answers and canonical300-point streak cap.
- Hidden group decisions stay absent until reveal; final team scores/rows/envelope chips and personal team totals remain withheld until their podium tier. Custom pack IDs use the custom- namespace.
- Imports: only @partybox/game-sdk (+ react in client/). server/ is pure (no Date.now, Math.random,
  timers, I/O).
- Fixtures are full states with real question ids; regenerate by hand with the reducer after a
  state-shape change (`pnpm sim --dump-fixtures` does not exist yet).
- Verify only this game with pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads. Root owns all executions and at most one browser closed in finally; agents coordinate before changing tested source.
