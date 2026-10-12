# P23 resume point

Owner r4-local; branch job/P23-bonk-io; draft PR #16 https://github.com/luisitin/partybox-rea-ports/pull/16. P07 is DONE with green ready PR #4. P23 is the only active own claim.

Research/spec/sources/assumptions are recorded; original live browser play was unavailable. No copied art, dependencies or runtime requests. Five finite rounds use pure 40 ms physics/10 ms contacts, 80 ms stage wakes and 200 ms bot decision buckets. Clients include paired pose easing, above-arena numbered markers, lifecycle-safe local holds and live Out standings.

R5 head 33922278 / CI 38204011353 is green: actual 137 tests, 7,000 matches (1,000 at every 2-8 seats), 1,003 traces. Current-source mutations caught 20/20 with clean before/after 128/128 and restored byte hashes. All 46 captures fit; controls at least 88 px. The browser is closed. R6 visual review found no further material issue (zero-gain streak 1).

R7 fixed stable-ID priority for equally near bot targets using supplied seeded RNG within 0.001 arena units. Two regressions cover exact/rounding-sized ties, both storage orders and all strengths; target diversity is two directions across 64 seeds, with exact replay and unchanged RNG for unique/ineligible decisions. Focused game/SDK/seven-match pilot passed 58/58, 7.43 s. Source agents are read-only/frozen; root owns execution, docs and git. R7 is a material gain, so zero-gain streak is 0.

Next: push R7 and refresh CLAIMS after pull --rebase; run twenty serial mutations against this frozen source and require new full scoped CI with matching source hashes. Record actual counts, then mark PR ready once every check passes. Independent client/spec audits are running read-only for the following rounds. Continue five-candidate KEEP GOING rounds until three consecutive zero player-visible gains; final CI green before DONE. Only own-game tests, one worker and at most one finally-closed headless browser; full batches in CI.
