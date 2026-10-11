# Conventions

Most of these are enforced by `pnpm verify` (ESLint, dependency-cruiser, Prettier, drift checks).
When a rule here and the linter disagree, the linter wins — then fix this page.

## Code

- TypeScript `strict`, ESM, Node ≥ 24. Named exports only (config files excepted). One exported concept per file.
- Files ≤ ~300 lines (tests/tools 400). Folder = feature. No barrel files except each package's `src/index.ts`.
- Explicit return types on exported functions. `import type` for types.
- Comments explain _why_, not what. File headers say what the file is for in one or two lines.
- No `Math.random()`, `Date.now()` or timers in engine or game code — the host injects `now`, `state.rng` gives randomness.
- Every game phase lives in `games/<id>/server/phases/<phaseId>.ts`; `reduce` in `server/index.ts` composes them.
- `TODO(BL-nnn)` only, with a matching `BL-nnn` line in `docs/BACKLOG.md`.
- Prettier formats everything (`pnpm format`); `singleQuote`, width 100, trailing commas.
- Versions shared across packages go in the `catalog:` of `pnpm-workspace.yaml`.
- Fixed-target JS motion (a glide to a known end) uses `ui/curves` (`spring`); `stepSpring` stays for moving goals.

## Naming

- Packages `@partybox/<folder>`. Game ids kebab-case = folder name = `manifest.id`.
- Phase ids kebab-case; fixture file = `<phaseId>.json`. Content packs `content/<pack>.json`.
- Socket events lower-case (`join`, `input`, `view`); dev API paths `/api/dev/<verb>`.
- Sound cues and design tokens: see `docs/DESIGN_SYSTEM.md`.

## Commits

Conventional commits: `type(scope): summary`.
Types: `feat fix docs test chore refactor perf build ci design`.
Scopes: `core engine server client sdk sim e2e scripts <game-id> ideas` (omit when repo-wide).
Examples: `feat(wisecrack): add vote phase`, `fix(engine): F-012 VIP handover ignored spectators`,
`design(core): R-004 raise TV body text to 34px`, `docs(ideas): add 003-word-storm`.
`pnpm verify:fast` must be green before `pb submit`; the merge queue runs the full `pnpm verify` (TEAM.md §8). Each commit updates the docs it affects.
`CHANGELOG.md` keeps an `Unreleased` section; releases are tagged `vX.Y.Z`.

## Docs

- `AGENTS.md` (root) ≤ 120 lines; folder `README.md` ≤ 60 lines (a game's `README.md` ≤ 120: it is the spec); package/game `AGENTS.md` ≤ 30 lines.
- One rulebook (ADR-055): a folder's rules live in its `AGENTS.md`, which Codex and other agents read by
  name. The `CLAUDE.md` beside it holds only the pointer below, which Claude Code expands, so the two can't
  drift. A folder that still has only a `CLAUDE.md` (a branch cut before the switch) converts with
  `git mv CLAUDE.md AGENTS.md`, then the pointer as the new `CLAUDE.md`:

  ```
  @AGENTS.md

  This folder's rules live in AGENTS.md next to this file: one rulebook for every agent (ADR-055). Edit AGENTS.md, not this file.
  ```

- Decisions → `docs/DECISIONS.md` (ADR: Context → Decision → Consequences, numbered).
- New dependency → one line in `docs/DEPENDENCIES.md` (drift check fails otherwise).
- Game `README.md` headings, in order: Overview, Players, Phases, Inputs, Scoring, Edge cases, Settings, Content.

## Git worktrees (parallel sessions)

Every agent works in its own worktree and branch: `git -C C:/dev/partybox worktree add C:/dev/partybox-<name>
-b <branch> main` (early sessions used `claude --worktree <name>`, giving `.claude/worktrees/<name>`, gitignored).
Branches reach `main` only through review and the merge queue (`C:/dev/team/TEAM.md` §6–§7); never merge
`main` in just to stay fresh. Ports: 42069 is the owner's server; team ports are in
`C:/dev/team/board/agents.json`. See `reports/README.md`.
