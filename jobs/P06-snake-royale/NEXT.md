# P06 handoff

Claim: r6-local, branch job/P06-snake-royale.
Research and full server/client implemented. 39 semantic rules pass, 3,000 property runs pass, and 20/20 planted semantic faults were caught. Phase fixtures and 16 SSR screen variants are generated; all fit at 1920×1080 and 390×844 after fixing the eight-row TV roster. Client review also fixed displayed size to match banked points.

The complete game run passed 118 tests (simulation smoke reduced to one seed because the separate exhaustive run covers 1,000). The actual SDK suite also passed all 20 checks. A stronger mixed lifecycle property run passed 3,000 seeds. Nearest-food lookup now uses a single pass; all four deterministic fixture hashes stayed identical and 60 focused checks passed.

Remaining: exhaustive counts 5–8 are running with `SNAKE_SIM_COUNTS=5,6,7,8`; counts 2–4 each completed 1,000. Finish VERIFY and hashes, open the draft PR after local checks, obtain green CI, then KEEP GOING. Ignored proposals in reports/r6-respawn/ and reports/r6-client-iterations/ are ready to review. Material candidates: snapshot cadence, occupied respawns, compass geometry, fractional rich-food display, nonsequential-ID snake identity, boost/body length, crash-point refill exploit. No production server was started.
