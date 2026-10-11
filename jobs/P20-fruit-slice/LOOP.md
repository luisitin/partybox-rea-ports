# KEEP GOING

Initial PR #5 checks were green on 81eac7e (P20 verify run 38180289220,
SDK kit run 38180289262). The following are code/capture reviews of eight
strangers playing; they are not claims of a human usability study.

Five remaining weaknesses, ordered: silent late-swipe rejection; no TV payoff
for accepted combos; stepped TV flight; tied bot fixtures can obscure one clear
winner; long phone names need truncation. The first three can improve play;
ties are fair and intentional, and name truncation already keeps controls clear.

- Round 1: late input now receives an explicit retry hint within 1,000 ms if no
  sequence acknowledgement arrives. Before: zero rejection feedback; after:
  one actionable hint. Accepted input clears it. Uses the existing SDK clock.
