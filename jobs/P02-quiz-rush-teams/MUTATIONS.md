# P02 canonical mutation campaign

Current canonical `games/kahoot`: 20/20 semantic rule mutations killed, zero
invalid mutants, a green 93-check pre-baseline and a green 93-check restored
post-baseline. Both children exited 0 with no timeout. SHA-256 hashes match
every launch-time source file exactly. This fresh campaign includes the current
HUD, frozen team-accuracy and discussion-budget integration.

An earlier 89-check campaign had a restored-baseline process cleanup timeout
and a genuine passing retry. That historical attempt remains in git history;
the fresh 93-check campaign supersedes it and required no retry.

Run after source edits settle and the focused behavioral baseline is green:

```powershell
node jobs/P02-quiz-rush-teams/mutate.mjs
```

Each sequential child runs `group-server.test.ts`, `group-accuracy.test.ts`,
`classic-server.test.ts`, `scoring.test.ts`, `answer-window.test.ts` and
`vip.test.ts` through
`pnpm vitest run`, with `--pool=threads --maxWorkers=1 --no-file-parallelism`.
The exact child command and temporary JSON-report path are recorded in
`mutation-results.json` and each log. The full property and simulation
campaigns run separately; mutations launch no browser.

| ID  | Actual canonical rule bug                         | Behavioral detection                                     |
| --- | ------------------------------------------------- | -------------------------------------------------------- |
| M01 | Base points rise from 500 to 5,000                | Score boundaries, accepted timing and finished credit    |
| M02 | Maximum speed bonus rises from 500 to 5,000       | Speed boundaries and ordinary final-question points      |
| M03 | Streak cap rises from 300 to 3,000                | Capped canonical personal and shared-room streaks        |
| M04 | Teams sum eligible points instead of averaging    | Correct, wrong and missing members produce a mean        |
| M05 | Offline unanswered members dilute the team mean   | Offline/permanently departed denominator exclusion       |
| M06 | Accepted departing answers leave the mean         | Locked leaver answers remain in the team calculation     |
| M07 | Elected room shape is shifted to another index    | Majority verdict and equal shared room credit            |
| M08 | Room chooses the lowest submitted shape           | Plurality, seeded tie candidates and mean-time verdict   |
| M09 | Room elapsed time sums votes instead of averaging | Collective speed uses the mean of every accepted vote    |
| M10 | Correct shared streak remains at one              | Consecutive room correctness earns a capped streak bonus |
| M11 | Discussion never advances to the question         | Discussion exit and bounded traversal to final results   |
| M12 | Discussion sends input to the answer reducer      | No picks, stamped answers or bot answers during talk     |
| M13 | Duplicate answer replaces the first               | First accepted packet and receipt stay immutable         |
| M14 | Stale question ID is accepted                     | Wrong-question stamped packets are ignored               |
| M15 | Stale opening timestamp is accepted               | Wrong-opening stamped packets are ignored                |
| M16 | A disconnected participant may submit             | Offline rejection and eligible reconnect window          |
| M17 | Pause duration erodes speed points                | Frozen pause extends the answer deadline fairly          |
| M18 | Last reveal publishes final team totals           | Final score withholding in both public view envelopes    |
| M19 | First podium beat exposes future team tiers       | Only the current and earlier unveiled tiers are public   |
| M20 | VIP end credits an unfinished question            | End retains only already banked question credit          |

Every replacement has a unique semantic anchor; preflight requires exactly
one occurrence before any edit. Matching ignores formatting whitespace while
preserving untouched source bytes. Per-mutant and outer `finally` restore
launch-time Buffer bytes and verify SHA-256 hashes, without Git operations.
Do not edit game source during the campaign.

The script uses a 30-second child limit and stops on an invalid mutant.
Load/transform errors, missing reports, process failures and timeouts never
count as kills. Threshold: at least 19/20 killed, no invalid mutants, green
pre/post baselines and exact restoration. The current campaign has both green
93-check baselines without a timeout or recovery command. Frozen team accuracy,
presence changes and reveal-only accuracy privacy are included in the focused
behavioral coverage.

`mutation-logs/*.log` retain bounded stdout/stderr for all campaign children.
`mutation-results.json` retains behavioral failure names/messages, durations,
exit codes, source hashes, statuses and the green pre/post baselines.
Historical standalone mutation results are recorded in HISTORICAL_VERIFY.md
and git; their different test names and mutant mapping do not release this
canonical integration.
