# P02 mutation campaign

Executed against the current public `games/kahoot` implementation: 20/20 rule bugs detected, both 47-check baselines green, exact source restoration verified.

Run only after the source and focused baseline checks are green and other agents have stopped editing the game:

```powershell
node jobs/P02-quiz-rush-teams/mutate.mjs
```

Each child runs `game.test.ts` and `teams.test.ts` through `pnpm vitest run`, using `--pool=threads --maxWorkers=1 --no-file-parallelism`. The full 1,000-seed property traces run separately. No browser or whole-game simulation suite runs during mutations. There is one child at a time, with a 30-second bound; timeout kills only that child's process tree. A green unmodified pre-baseline and a green restored post-baseline are mandatory for a completed campaign.

| ID  | Actual rule bug                                | Expected behavioral detection                         |
| --- | ---------------------------------------------- | ----------------------------------------------------- |
| M01 | Speed points inflated tenfold                  | Solo speed boundaries; team/room credit               |
| M02 | Wrong answer retains previous streak           | Wrong/timeout reset; no-vote room reset               |
| M03 | Team gain sums rather than averages            | Rounded mean; unequal balanced teams                  |
| M04 | Offline unanswered members dilute team         | Offline mean exclusion                                |
| M05 | Answered departed member excluded              | Accepted departed answer remains in mean/results      |
| M06 | Room selects least popular answer              | Plurality and maximum-tie candidates                  |
| M07 | Ties always choose the lowest index            | Seeded campaign reaches both tied choices             |
| M08 | Room speed sums elapsed instead of mean        | Collective mean elapsed gives 925 points              |
| M09 | Collective streak always starts at zero        | Next correct room verdict adds streak bonus           |
| M10 | Discussion timer never opens question          | Discussion exit and bounded trace termination         |
| M11 | Discussion routes taps to answer reducer       | Out-of-phase input rejection                          |
| M12 | Pause duration counts against speed            | Solo and group pause elapsed accounting               |
| M13 | Duplicate vote overwrites first vote           | Immutable first accepted answer                       |
| M14 | Stale round votes accepted                     | Round-stamped receipt rejection                       |
| M15 | Public question spreads answer key/fact        | Hidden key/explanation view diffs                     |
| M16 | First submitted vote becomes early TV decision | Decision stays null and opponent choices stay private |
| M17 | Phone selection exposes first opponent vote    | Other-player choice changes cannot change a phone     |
| M18 | Opponent final totals shown before podium      | Final team total and rank withholding                 |
| M19 | First podium beat shows all placements         | Server-controlled solo/group podium tiers             |
| M20 | VIP end credits an unfinished round            | End results retain only finished-question credit      |

Every replacement uses a unique semantic string anchor and asserts exactly one occurrence before any mutation. Formatting whitespace is ignored when locating that site; all untouched source text remains exact. Launch-time dirty source is supported and backed up as bytes. Per-mutant and outer `finally` restore those bytes and compare SHA-256 hashes; no Git operation is used. Never edit game source during this campaign.

`mutation-results.json` records both baselines, exact child command, source/restored hashes, exit codes, durations, failed behavioral test names/messages and each status. `mutation-logs/*.log` keeps bounded stdout/stderr for every run. Failed suite loads, compile/transform errors, missing reports, test/child timeouts and process errors are invalid mutants, never counted as kills. The script stops on an invalid mutant and reports an incomplete campaign. A canceled campaign restores source and cannot count as complete without its post-baseline. Threshold: at least 19/20 kills, no invalid mutants, both baselines green, exact restoration; aim 20/20.
