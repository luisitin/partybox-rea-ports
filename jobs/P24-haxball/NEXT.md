# Resume P24 Haxball

Runner r3-local on job/P24-haxball. Research and implementation complete; verification in progress.

- Server: fixed50ms circle physics,100ms host beat, edge-armed kicks,650ms leases,
  two90s wall-clock halves,8s halftime, team goals, odd-seat helper, deterministic bots.
- Phone: independent eight-way D-pad and Kick holds,300ms heartbeats, blur/hidden/phase
  cancellation; phone-only public pitch and spectator stage. TV has numbered team discs.
- Passed: typecheck;31 focused server tests;23 client tests;11 actual-component SSR cases.
- First capture:55 static screens pass geometry/TV typography. Mounted harness setup fails
  with Unexpected identifier object; capture browser and exact endpoint verified closed.
- Full game shard (contract/property/7000 bot games) rerunning in root session2934 after
  paused VIP End fix. The interrupted earlier full run has no pass claim.
- Pending: mounted QA fix, final full shard,20 mutations, format, media hashes/budget,
  PR/green P24 CI and three successive KEEP GOING audits with no player-visible gain.
- Root alone executes checks/browser. pnpm.cmd in PowerShell. Install already complete.
- Push every milestone/at least30min and refresh main CLAIMS.md each push; pull --rebase
  before every CLAIMS commit. No PR yet; no live original or human LAN playtest claimed.
