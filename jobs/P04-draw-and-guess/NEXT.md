# P04 salvage — claim race

P04 is owned by r2-local on main. This runner pulled before its claim but did not re-check the selected ID afterward, producing a duplicate claim. Another runner removed the duplicate. Our first branch push rejected non-fast-forward; no other runner's branch was changed.

The independent implementation is preserved on r4-local/P04-draw-and-guess-salvage for reference, not submitted as the P04 queue job. Do not overwrite job/P04-draw-and-guess. r4-local moved to P07.

Completed: researched flow, original 300-word deck and 100 original sketches, deterministic server, TV/phone clients, fixtures, 24 styled captures, full baseline 66 tests/1003 property seeds/3000 bot games,20 of20 serial mutants caught. Afterward client corrections and a reveal deadline guard were applied; those final edits are not fully verified. The sketch library is not yet integrated. No ready PR or passing CI is claimed.

Resume only as an explicitly coordinated supplement to the owning runner. Rebuild captures after client edits, integrate/test sketches and StrokeStream, record final metrics, run scoped checks, and audit the finished flow.
