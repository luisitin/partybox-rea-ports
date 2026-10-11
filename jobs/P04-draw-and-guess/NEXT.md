# P04 continuation

Branch: job/P04-draw-and-guess. Runner: r2-local.

PR #1 is ready after green CI. R1 fixes long drawing gestures, complete Undo,
delayed edit acknowledgements, artist progress and immediate solver points.
27 HTML/PNG screens fit; eight actual browser interaction checks pass;
20/20 mutations remain caught. R2 public geometry recognition passes86tests
and green CI. R3 skips an empty reveal after a choosing artist departs.
R4-R9 protect Clear, identify final winners, announce the next artist,
cue public solves/final ticks, meet all-theme ink contrast, and show full names.
32 HTML/PNG screens fit, all8long names visible; 13live checks pass. R10 restricts
bot guesses to the public selected deck; all7,000matches terminate and easy
bots solve faster. Finish R11 geometry-aware dense-ink simplification, repeat
the scoped checks, then review until three consecutive rounds find no
player-visible gain. No-gain count is zero after the latest substantive fix.
Original interactive play was unavailable (CUA exposes no browser); see research.
