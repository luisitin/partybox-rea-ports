# Resume P24 Haxball

Runner r3-local, branch job/P24-haxball. Draft PR17:
https://github.com/luisitin/partybox-rea-ports/pull/17

- Published readability head e31401a passed CI38205816003. Prior goal-cue head823d36e also passed.
- Current local physics passes58 rule tests: four post drives, four late keeper kicks,
  and16 mirrored swept goal/post/bank/overlap cases now supplement the original34 rules.
- Swept ball/post contacts use existing restitution and remaining fixed-step motion.
  Clean whole-ball crossings lock credit before later walls/contacts/kicks; contact cleanup
  still runs for players. Half clocks, input leases, cooldowns and RNG remain unchanged.
- Required full scoped test/simulation and20-mutation rerun are NEXT. The retained7000-match
  report (22275 goals,188000ms) and98-test full pass describe the earlier physics, not this change.
- Client/readability evidence:46 focused tests,75 static layouts,67 mounted controls,
  64 goal-cue checks and12 retained-credit checks pass. Worst-case name fits704px product area
  within390x844; TV jersey/body/timer minima34.613/36/128px. Browser and endpoint were closed.
- Media167 files/8,642,244 bytes. Run hash-media.mjs after every media change, then independently
  recompute every SHA256 with PowerShell Get-FileHash. Keep total strictly below10MB.
- Round3 physics gains are in progress in LOOP.md. After verification, round4 will clarify
  radial kicking and halftime restart timing. Then complete three actual zero-gain reviews.
- Keep PR draft until the final exact-head P24 CI is green. Update PR body from jobREADME.
- Install already complete. Use pnpm.cmd; test only games/haxball with one worker. Root owns
  at most one headless browser and closes it in finally; never a whole-suite browser run.
- Push milestones, refresh the r3-local claim on main after every push, and pull --rebase
  before every CLAIMS.md commit. No original live or human LAN/eight-stranger playtest claimed.
