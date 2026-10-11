# KEEP GOING

Initial PR #5 checks were green on 81eac7e (P20 verify run 38180289220,
SDK kit run 38180289262). The following are code/capture reviews of eight
strangers playing; they are not claims of a human usability study.

Five remaining weaknesses, ordered: silent late-swipe rejection; no TV payoff
for accepted combos; stepped TV flight; tied bot fixtures can obscure one clear
winner; long phone names need truncation. The first three can improve play;
ties are fair and intentional, and name truncation already keeps controls clear.

- Round 1: late input now receives an explicit retry hint after 1,000 ms plus one
  100 ms SDK clock beat if no
  sequence acknowledgement arrives. Before: zero rejection feedback; after:
  one actionable hint. Accepted input clears it. Uses the existing SDK clock.
- Round 2: the public stage shows each accepted swipe's +points beside the
  player's name until the next wave. Before: zero visible gain labels; after:
  one bounded label per scoring player, at least 32 px on TV. Personal cuts
  remain private; totals and accepted gains are public. Compact phones keep the
  same space, with the player's own feedback already above the board.
- Round 3: TV targets now interpolate each 200 ms update for the 150 ms motion
  token. Before: ten discrete positions per two-second flight; after: browser
  transform interpolation between those positions, with zero new JS tickers.
  Pause and both motion-off settings disable it. Phone targets remain exact
  judged positions so the visible gesture and server collision geometry agree.
