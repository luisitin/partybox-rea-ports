# P02 verification

Implementation in progress. Only this game's tests run, with one worker.
Browser verification will use at most
one isolated headless browser closed in finally.

P01's prior results remain historical in its own job folder. P02 must execute
current typecheck/format, all modes' scoped contracts/properties/simulations,
20mutants, validator checks and fresh phase/role screen evidence.

- `pnpm.cmd vitest run games/kahoot/content/text-pack.test.ts --maxWorkers=1 --pool=threads`:13checks pass, exit0,449ms. Strict authoring, Unicode/BOM/CRLF, duplicate/missing fields, bounded content and200/201questions are covered.
- `pnpm.cmd exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts jobs/P02-quiz-rush-teams/example-pack.txt`:pass, exit0; custom sample validates5questions.
- First `pnpm.cmd typecheck` exits2 with one adapter-test union-narrowing error. That owned fixture now narrows playMode before reading reveal; rerun is pending. No successful typecheck is claimed yet.
