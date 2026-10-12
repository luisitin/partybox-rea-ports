# P02 Kahoot! team mode

BLOCKED: P01 was reopened and replaced the old engine with its canonical
Lightning Round base. Its updated classic engine/pack schema is still under
construction. Read BLOCKED.md; PR18 remains draft and requires integration
against the completed replacement before these checks can release it.

Runner r2-local; branch job/P02-quiz-rush-teams. This extends the public P01
engine in games/kahoot, renamed per the owner's official name table.
P01 PR2 is the unmerged prerequisite; the P02 PR is stacked on that branch.

Teams discuss before answering, then average personal points without a
larger-team sum advantage. Room vote elects one collective TV answer from
phone votes. Both work with a TV or entirely on phones. Sports and music add
20 original questions each. Default individual workshop play remains available.

Core integration upgrades the existing Lightning Round card: its injected
classic mode remains default; only teams and room vote are added. Read
UPGRADE.md for host/module/content selection and later installed verification.
This public clone does not claim a private deployment.

Install once with corepack enable and pnpm install. Windows uses pnpm.cmd.

```sh
pnpm typecheck
pnpm format
pnpm vitest run games/kahoot --maxWorkers=1
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt --out games/kahoot/content/custom.json
```

The text format and example are in PACK_FORMAT.md and example-pack.txt.
Select Custom local pack after rebuilding/restarting the host.
No runtime file/network calls or new dependencies.

RESEARCH.md/SOURCES.md distinguish original mechanics from adaptations;
ASSUMPTIONS.md records decisions and access limits. VERIFY.md records executed
checks. NEXT.md is the continuation; LOOP.md records convergence reviews;
media/ and SHA256SUMS.txt contain final visual evidence.
