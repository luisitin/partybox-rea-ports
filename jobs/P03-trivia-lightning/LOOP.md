# P03 improvement passes

Pre-PR verification found and fixed missing mutation assertions, a bot targeting permanent leavers,
and stale timer clock regression. Visual QA also fixed TV lane overlap and horizontal overflow.
PR #3 became green on ad3add8 in run 38177187835; these are the binding post-green passes.

1. Live phone standings: five candidates were missing active-phone rank, empty podium ranks, blind freeze selection, progress/score ambiguity and missing power-request feedback. Fixed the worst with a score-derived Place/Tied label in the existing score column. Six screen regressions pass (19 screen tests, 20 with SSR); the maximum 100/40/150 question now shows `360 pts · Tied 2/8`, even with a high streak, disabled powers or freeze, without another header row. Both active-player 390×844 ranking surfaces have zero geometry findings. Capture exposed eight clipped TV names and eight on each spectator phone, now the next priority; cleanup proof is being recovered after a Windows process-query timeout. This is DOM/geometry evidence, not a measured human comprehension speed.
