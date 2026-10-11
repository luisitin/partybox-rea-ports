# RUN-ALL: the one message that works the whole queue

Paste this into a new Codex cloud task on this repo. Many tasks can run it at once; CLAIMS.md keeps them apart.

```
You are working through the job queue in the public repo https://github.com/luisitin/partybox-rea-ports. Read README.md, RULES.md and JOBS.md there first, then every file of games/curve-fever (the reference port) and docs/GAME_CONTRACT.md and docs/DESIGN_SYSTEM.md. Every job in JOBS.md is binding, including its research, checks, CI and KEEP GOING loop.

Loop until you are out of time or tools:
1. Claim a job. Read CLAIMS.md on main. Take the lowest-numbered job that has no line there, or whose line is older than 6 hours with no commit on its branch in the last 6 hours. Claim it: add or replace the line "<ID> <your run id> <UTC time> job/<ID>-<slug>" in CLAIMS.md on main (one small commit), then work on branch job/<ID>-<slug>.
2. Do the job exactly as written: research, then build games/<id>/ in the shape of games/curve-fever/, then verify. Push after every milestone (at least every 30 minutes of work). Keep jobs/<ID>-<slug>/NEXT.md current so another task can resume.
3. When every check in RULES.md passes, open the pull request (title "<ID> <game name>", body = the job's README), then run the KEEP GOING loop until the gains are only cosmetic. Refresh your CLAIMS.md line each time you push.
4. Go to step 1.

Never stop to ask anything; log assumptions in ASSUMPTIONS.md. Never end a reply with a question, a plan or an offer. If a job is blocked (source unavailable, tool missing), write BLOCKED.md in its folder with the reason and what you tried, mark the claim "BLOCKED", and take the next job.
```
