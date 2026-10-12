# P02 continuation

Runner r2-local; branch job/P02-quiz-rush-teams; draft PR https://github.com/luisitin/partybox-rea-ports/pull/18 (base job/P01-quiz-rush).

Resumed 2026-10-12 after P06 completed. The previous prerequisite blocker is resolved: P01 public head 4043226 has the canonical classic engine/schema, stamped answers, partial podium and green CI. P01 remains unmerged. P02's expired claim was refreshed on main after pull --rebase.

The canonical P01 module replaces the retired standalone implementation. Old P02 source is preserved in git at b254dd4 and in the local snapshot C:/Users/luisi_xlnbc7h/AppData/Local/Temp/p02-group-resume-e7b326feda9c47388516f671e73426fa/games/kahoot. No second game or injected retired engine is being installed.

Current integration adds quizMode=teams/tv-vote directly to the canonical engine. Wager and Classic remain unchanged, with the legacy 1–16 roster, EN/ES library, 300-point streak cap and wager minigame. New groups use 2–8 players, seeded balanced teams, a reading-safe discussion phase and the English classic packs. Sports/music/custom extend the compatible pack schema.

Parallel file ownership while active:

- Server agent: games/kahoot/server/** and group-server.test.ts; types/views/team scoring/discussion.
- Client agent: games/kahoot/client/** and group-screens.test.tsx; team/vote stages and controls.
- Content agent: games/kahoot/content/**, validator/format docs and group content/CLI tests.
- Root: manifest, remaining tests/fixtures/evidence, all executions, browser, docs/git/CI.

Root must not run checks until all source edits settle. Then typecheck/format, focused group checks and full pnpm vitest run games/kahoot --maxWorkers=1 --pool=threads. Only this game's tests. Baseline P01 tests exercise 32,000 games; retain their assertions and add 1,000 group matches at every supported count/strength, seeds 1/2/3 plus 1,000 sampled property seeds, actual SDK group variants and 20 semantic mutations. The old 21,000-match/92-layout evidence is historical and cannot release this new integration.

Regenerate group phase/role fixtures and TV/phone/phone-only/spectator media from the actual canonical components. Keep media under 10 MB; hash every file. Root owns at most one headless browser, closed in finally. Update capture/live/mutation tools for canonical fields before executing them.

Refresh PR18's body from README.md, obtain green P02 CI, then run the KEEP GOING loop until three consecutive rounds have no noticeable gain. Push milestones at least every 30 minutes and refresh CLAIMS on each push, pulling --rebase before each claim commit.

Read UPGRADE.md: the owner's current Lightning Round already has partial teams from T-1146; no owner deployment or private checkout edit is performed here. The missing discussion/room-vote/packs are the upgrade scope.
