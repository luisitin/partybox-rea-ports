# P04 continuation

Runner: r2-local. Branch: job/P04-draw-and-guess.
Game: games/skribbl (Skribbl.io). PR: https://github.com/luisitin/partybox-rea-ports/pull/1

The complete public game and injected Broken Pencil live-mode upgrade are built.
UPGRADE.md records the core installation handoff; no private deployment is claimed.
Telephone remains the injected default under the existing card.

Latest source milestone270eb72 passes CI38200206897 in31s:318checks in31files,
including all7,000seeded matches, SDK contracts and properties. Local typecheck
and107client checks pass. Server sources remain identical to the fresh20/20
R23mutation campaign.44native checks pass and the single browser closes in
finally.33SSR captures plus two native pause PNGs total68media files,
2,110,941bytes, all hashed. Manual pause screenshot review passes.

R25 preserves known-unsent ink/tails through pause and prevents a queued Undo
from erasing an older gesture when its target lost the server pause cutoff.
R26 retains private scoped drafts/receipt correlations across refresh without
resending, stale turn revival or overwriting newer typing. Native checks measure
two paused dot packets195.3ms apart, complete resumed-tail Undo, zero cancelled
Undo sends, zero automatic guess retries and zero normal/Safari/keyboard overflow.

The PR remains draft until three consecutive no-gain KEEP GOING rounds pass.
R27 is the first after final green verification; streak1/3. Perform two more
fresh reviews, rank/log five residuals each, push and refresh CLAIMS per round.
Refresh the PR body from the job README, mark ready only after latest CI green,
then mark the P04 claim DONE before taking the next lowest eligible job.

Original interactive play was unavailable through CUA; see RESEARCH.md.
