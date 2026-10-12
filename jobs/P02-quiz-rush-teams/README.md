# P02 Kahoot! team mode

Upgrade P01's canonical Kahoot!/Lightning Round module with group play under the existing card. Teams discuss before individual stamped answers and average eligible personal points. Room vote elects one shared answer by plurality, seeded ties, mean vote speed and a shared streak.

Groups support 2–8 players, TV and phone-only rooms, spectators, bots and reconnects. Teams remain fixed; accepted departing answers count, unanswered absent seats leave the mean, and discussion separates from answer speed. Final team totals stay hidden until their occupied podium tier.

Sports and music add twenty authored questions each. Strict UTF-8 custom packs compile before bundling (5–20 questions with reserved IDs). Exact public prompts can reuse independent standard answer-text facts; narrow count word/digit equivalence is allowed. Unknown/edited/conflicting prompts and ambiguous choices remain seeded guesses; custom keys never teach bots.

Quality-loop changes add native-like shared phone receipts, actual EN/ES reading budgets, a live final VIP window, the public quiet TV countdown cue, a translated room-tie explanation and own-team discovery with factual Away/Left presence labels. Staged teammate disclosure swaps roster/question panes; it accepts no game answer during discussion.

Wager and individual Classic retain their canonical behavior. This stacked public PR performs no owner-core deployment; [UPGRADE.md](UPGRADE.md) documents the existing wager-team overlap and migration scope. No runtime network/file reads, new dependency or second picker card.

## Run

Install once with `corepack enable` then `pnpm install`; load `games/kahoot` through a PartyBox host. Select `quizMode=teams` or `tv-vote`, then `classicPack`; configure 2–4 teams and a 5–20-second discussion minimum with the SDK reading floor.

Compile custom text using `pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt --out games/kahoot/content/classic-custom.json`; rebuild/restart and select Custom. [PACK_FORMAT.md](PACK_FORMAT.md) and example-pack.txt document the format.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/kahoot --maxWorkers=1 --pool=threads`
- `pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt`

Initial integrated CI passed 345 tests and required simulation/property campaigns. Rounds 1–6 have focused checks; latest roster/presence/pacing checks passed 71/71 in 10.24 s and typecheck passed. Final current-head CI, the expanded mutation campaign, fresh maximum-legal-text/native-disclosure browser evidence and three zero-gain rounds remain pending; the PR stays draft.

Specification: [games/kahoot/README.md](../../games/kahoot/README.md). RESEARCH.md/SOURCES.md distinguish original mechanics and allowed PartyBox adaptations; ASSUMPTIONS.md records access limits. VERIFY.md contains executed results; NEXT.md is the handoff; LOOP.md records measured rounds. Saved reports/images/hashes remain labeled baseline until final refresh.
