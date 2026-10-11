# P12 KEEP GOING

Baseline verification in progress. Post-CI improvement rounds will be recorded here.

Pre-PR check: normal/sharp bot smoke initially tied at every cap. Added distinct reaction
cadences and aiming precision; normal 2-player median fell from 45 s to 21.68 s and its
median gate count fell from 19 to 8, while sharp still sustains the whole course.

Pre-PR check: rejected early current-instance timers and removed sender-order bias when
several gliders already overlap an edge between physics samples. Regressions cover both.
