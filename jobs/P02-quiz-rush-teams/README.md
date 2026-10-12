# P02 Kahoot! team mode

An upgrade of P01's canonical Kahoot!/Lightning Round module: fixed teams discuss before individual answers and average eligible points; Room vote elects one shared answer from phone votes. Sports and music add twenty authored questions each. A strict text compiler bundles custom packs for offline use.

Wager and Classic keep their existing behavior. Groups support 2–8 players, TV and phone-only rooms, spectators, bots and reconnects. No second picker card, retired quiz engine, runtime network calls or new dependencies.

This PR is stacked on the public P01 branch until that prerequisite merges. P01's replacement is now published and green; the former blocker is resolved. New integration verification and the post-green quality loop are in progress. Earlier standalone evidence is historical.

## Run

`corepack enable`, `pnpm install`; load games/kahoot through a PartyBox host. This public workshop does not include the host or perform the owner-core deployment. UPGRADE.md records the existing-core overlap and integration scope.

## Check

- `pnpm typecheck`
- `pnpm format`
- `pnpm vitest run games/kahoot --maxWorkers=1 --pool=threads`
- `pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt`
- `pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt --out games/kahoot/content/classic-custom.json`

Select quizMode=teams or tv-vote, then classicPack. The text format/example are in PACK_FORMAT.md and example-pack.txt. Rebuild/restart after compiling a custom pack.

Specification: games/kahoot/README.md. RESEARCH.md/SOURCES.md distinguish original mechanics from PartyBox adaptations; ASSUMPTIONS.md records decisions and access limits. VERIFY.md contains executed results; NEXT.md is the handoff; LOOP.md records convergence; media and SHA256SUMS.txt contain screen evidence.
