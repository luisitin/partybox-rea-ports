# P22 handoff

- Run r1-local; branch job/P22-ricochet-rumble; claim recorded on main.
- Resumed P01 first: PR #2 final head 1c8d264 passed CI run 38181046868; main already marks P01 DONE.
- corepack enable and pnpm install were completed once for this clone during P01; pnpm.cmd 12.4.2 remains installed.
- Team/manual and repository README/RULES/JOBS read. Reference port covered across server, client, fixtures and tests; contract/design prerequisites read.
- Research complete before implementation: public original bundle and independent primary repositories read; live browser unavailable and recorded.
- Implementation underway. Root scaffold and targeted verification harness are prepared; server/client agents own disjoint folders.
- Game name is Ricochet Rumble; original product name appears only in research/source attribution.
- Root owns manifest/spec/content, verification, media tooling, job docs, workflow and git operations.
- Server agent owns games/ricochet-rumble/server; client agent owns games/ricochet-rumble/client.
- Do not run whole-suite tests. Use one thread worker for this game's checks. Root reserves the single headless browser for sequential captures, closed in finally.
- Next: finish five-round maze combat, generate fixtures, run scoped contracts/properties/7000 simulations/20 mutations and all-surface screens. Open draft PR with this job README; require CI before ready and then complete KEEP GOING.
