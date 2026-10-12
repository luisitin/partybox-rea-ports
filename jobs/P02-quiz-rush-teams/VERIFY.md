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
- Next typecheck finds a missing GamePresence.mode in the property fixture; it is corrected to together/phoneOnly. Final `pnpm.cmd typecheck` then passes, exit0.
- `$env:WRITE_P02_EVIDENCE='1'; pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads --disableConsoleIntercept`:184pass/21fail/1skip in16files,142.67s; this is NOT a green full run. All21,000matches pass:7,000solo plus14,000teams/vote across every2–8count and three strengths. Worst new-mode match1,440,435ms (<1,800,000ms estimate×2); eight-seat median rounds teams64,147ms/room54,859ms, median answer2,171ms. Group property traces at seeds1/2/3 plus1,000generated seeds pass. `simulation-results.json` records the14,000new matches separately.
- Failures are17adapter cases caused by the toy minigame's one-item howTo (SDK requires two), three manually miscounted reading assertions (question content10words, not11), and the pending talk.json fixture. The toy and assertions are corrected; fresh screen generation supplies talk.json.
- `pnpm.cmd vitest run games/kahoot/server/upgrade.test.ts games/kahoot/server/upgrade-flow.test.ts games/kahoot/client/upgrade.test.tsx games/kahoot/__tests__/team-reading.test.tsx --maxWorkers=1 --pool=threads --disableConsoleIntercept`:25checks pass, exit0,2.43s.18paired wrapped/direct matches complete at2/4/8seats×seeds1/2/3×bothmodes. Actual maximum-word-name TV reading128/130words at2/4teams is covered by59,093/60,824ms holds; phones79/53words fit. Before roster budgeting,15,803ms was insufficient. Room vote reserves no invisible roster. No game source changed after the full simulation run.
