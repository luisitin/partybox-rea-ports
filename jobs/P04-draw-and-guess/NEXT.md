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

CI38198077870 passes47s on R23. PR remains draft until three consecutive no-gain
KEEP GOING rounds pass. R24 is the first; no-gain count:1/3. Log two further reviews' five ranked remaining weaknesses,
push and refresh the claim. Then refresh PR body from this job README, mark ready
on green CI and mark CLAIMS DONE. Current candidates: extended disconnect
forfeits, exact synonym policy, general bot vision, extra tools and cosmetic labels.

Original interactive play was unavailable through CUA; see RESEARCH.md.
