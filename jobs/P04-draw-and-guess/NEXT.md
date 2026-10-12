# P04 continuation

Runner: r2-local. Branch: job/P04-draw-and-guess.
Game: games/skribbl (Skribbl.io). PR: https://github.com/luisitin/partybox-rea-ports/pull/1

The complete public game and injected Broken Pencil live-mode upgrade are built.
UPGRADE.md records the core installation handoff; no private deployment is claimed.
The original telephone mode remains the injected default under the existing card.

CI38196617993 passed276tests in27files, including7,000seeded matches,
SDK contracts and properties. Local typecheck and format pass.24native browser
checks,33captures and66media hashes (2,076,820bytes) are current; no browsers
remain running. The old dense geometry benchmark deadline was fixed; its3
functional checks pass locally without removing any geometric assertion.

R23 is the latest gameplay improvement: mixed timeout chooses the offered easy
word. Human medium/hard automatic choices340/338 become0/0 across1,000seeds;
bots331/345 become0/0. Explicit choices, other decks, hint RNG and8s timing stay
intact.35focused choice/game checks and typecheck pass; refreshed20/20mutants
are caught and restored baseline passes. No fixture or screen change is needed.

CI38198077870 passes47s on R23; the R24 documentation CI is also green.
R25 found two real pause defects, so the no-gain count resets to0/3. Unsent ink
and an active dirty tail now survive pause for resume; a guess caught before its
receipt returns for manual retry.32focused client checks and typecheck pass
locally, exit0; Vitest records a Vite shutdown warning. Browser verification is
pending. Its first retry failed an old endpoint check because it sampled before
queued packets drained; the bounded observation now waits for that endpoint.
The failed browser reached finally and exited1; no active profile remains.

Independent ink review also found that a queued Undo could erase an older
authoritative stroke after its intended new gesture was rejected at pause.
Target-aware Undo and its six regressions are complete;23focused ink checks
pass, exit0. R26 also preserves private drafts through the SDK scoped store;
24focused guess/refresh checks pass, exit0. Final local typecheck passes.
The enhanced44-check native harness and full client checks are running.
Regenerate format/hash evidence after browser completion and run scoped CI.
Server sources are unchanged since the fresh20/20R23mutation campaign.
Keep the PR draft until all checks and three genuine no-gain rounds
pass; refresh PR body from this job README before ready/DONE.

Original interactive play was unavailable through CUA; see RESEARCH.md.
