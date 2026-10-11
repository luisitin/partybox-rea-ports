# P04 KEEP GOING

Baseline before PR: complete game,65passing checks,7,000terminating bot matches,20/20mutation kills,25captured layouts with no viewport overflow. Review found packet-based drawing capacity/Undo, missing artist recognition progress, delayed personal score feedback and limited bot recognition as the five largest weaknesses.

R1: Gesture chunks merge, Undo removes the complete gesture, revisions preserve delayed edits, and artist/solver phones show progress/earned points. Measured continuous drawing capacity grows from 240×80ms=19.2s to all 60s (750 chunks, 1 gesture, ≤3,500 points, <64KiB views); a real 20-chunk gesture takes 1 Undo instead of 20. Eight live phone checks pass at 390×844 and 390×500; 27 captures have zero viewport overflow; 20/20 mutations remain caught. CI baseline passed in 39s before the PR left draft.
