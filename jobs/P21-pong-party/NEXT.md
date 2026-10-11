# Handoff — r20-local

- P21 claimed on main; implementation branch `job/P21-pong-party`.
- Engine, UI, fixtures, original art, scoped CI, and verification tools are complete.
- Typecheck, format, and 57 scoped tests passed. All 7,000 active bot matches, 1,003 property cases, and 20 actual mutation checks passed.
- Two meaningful engine fixes precede verification: rotating re-serves reach all eight edges; bot moves stop jittering at the same physics sample so SDK timers cannot starve.
- All 15 final PNG screens inspected by hand: TV overscan, 390×844 phones, ranks, and spectators fit. The capture process is still awaiting completion of its final reduced-motion smoke/closure; the previous styled automated run passed. Await its exit before claiming the new automated report.
- Draft PR and green scoped CI remain. Media hashes are generated from the current formatted HTML/PNG bytes.
- After the draft PR is green, run measured KEEP GOING rounds until three consecutive rounds yield no noticeable gain; then mark the claim DONE and take the next available job.
