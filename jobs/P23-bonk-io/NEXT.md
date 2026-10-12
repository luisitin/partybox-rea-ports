# P23 resume point

Owner r4-local; branch job/P23-bonk-io; draft PR #16 https://github.com/luisitin/partybox-rea-ports/pull/16. P07 is DONE with green ready PR #4. P23 is the only active own claim.

Combined game source is complete/frozen at R8 head 02a9dfe. CI 38206111467 is green: actual 143 tests in 10 files, 7,000 matches (1,000 at every 2-8 seats), 1,003 traces, 199.80 s. Every game-file hash matches the tested head after mutation restoration. Fresh mutations caught 20/20 by assertions with clean baselines 134/134 and exact original bytes restored. Case 6 first timed out before tests started; the guarded infrastructure-only retry caught it and preserves the original result. No own mutation/Vitest/browser process remains.

All 46 captures fit; 100 media files (5,037,728 bytes) match their SHA hashes; controls at least 88 px. Bot tie choice and editable-field keyup release are covered. No original live play, measured original timings/audio or live socket integration is claimed. Research/spec/sources/assumptions and current verification are recorded.

R9 independent client audit found zero material gain; zero-gain streak 1. Push this evidence/R9 and refresh CLAIMS after pull --rebase. Two further completed read-only five-candidate audits (server lifecycle/strategy and party/spec) await their individual LOOP checkpoints and pushes; no material defect found, subject to the current green evidence above. Do not change source for cosmetic gains. Refresh PR body from job README and mark ready after final head CI is green. Require three consecutive zero-gain rounds before DONE, then claim the next eligible job. Only own-game tests, one worker, full batches in scoped CI and at most one finally-closed headless browser.
