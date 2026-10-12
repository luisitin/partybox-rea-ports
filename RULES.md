# RULES (binding for every job)

Be extremely aggressive about quality and verification: research the original deeply, build the full PartyBox game, then try hard to break it. Finished means a party of 8 strangers can play it on a TV with their phones with no explanation, and the owner cannot tell it was not built by the core team.

## Public repo hygiene

- Public repo. Never commit ripped assets (sprites, sounds, music, fonts, logos) from the original game or any trademarked art. Owner 10-11 (personal use): the game uses the ORIGINAL's official name (manifest name and id, e.g. "Kahoot!" / `kahoot`, "Agar.io" / `agar-io`); see the name table at the top of JOBS.md. Art is yours (inline SVG, canvas drawing, CSS) or CC0 with the licence recorded in SOURCES.md.
- Zero secrets, zero tracking, zero network calls at runtime. No new dependencies unless the job names one.

## What a job delivers (games/<id>/)

Exactly the shape of `games/curve-fever/` (read all of it before you start): `manifest.json`, `README.md` (the game's spec: overview, players, phases table for TV and phone, phone-only table, inputs, scoring, edge cases, settings, content, sources), `AGENTS.md`, `server/` (index.ts, phases/, bot.ts, scoring.ts, types.ts, content.ts), `client/` (Tv.tsx + Tv.module.css, Controller.tsx + Controller.module.css, tv-entry.ts, phone-entry.ts, strings.ts, shared.ts), `content/schema.ts`, `fixtures/` (one JSON state per phase), tests next to the code (`*.test.ts`, `*.test.tsx`).

## Game contract (docs/GAME_CONTRACT.md, enforced by packages/game-sdk/src/contract-tests)

- `reduce()` pure and total; time only from `event.now`; randomness only from `state.rng`; no Math.random, Date.now, timers or I/O in game code.
- Views never leak hidden information: test it by diffing views across players.
- Phone screens fit an iPhone 15 viewport (390x844) with no scrolling in play; the TV is designed at 1920x1080 and read from 3 m (body >= 32 px, timers >= 96 px, one focal point).
- Phone-only rooms (`ctx.presence.phoneOnly`): the phone is the stage; nothing points at a TV. Use `usePhoneOnly` / `PhoneOnlyProvider` from the SDK the way curve-fever does. Spectators see the stage without the buttons.
- Bots (`supportsBots`): a real strategy, three strengths; 1,000 seeded bot games at every player count must terminate.
- Reconnect: a player who refreshes mid-game is back where they were; the game never waits on a disconnected player.
- Design system: only `--pb-*` tokens from `design/tokens.css` for colour, size and motion; `prefers-reduced-motion` honoured; never colour alone for a state; the TV reveals, the phone never spoils.

## Research first (the REA part)

Study the original: play it, read what you can of its client (public bundles are fine to read; never copy code or assets), write down round structure, timings, scoring, feel, sounds and the moments that make it fun. Put that in `games/<id>/README.md` under Sources and in `RESEARCH.md` in the job folder. Then design the PartyBox version: what is on the TV, what is on the phone, what changes for 8 players in a living room. Facts need 2 independent sources.

## Verification (VERIFY.md in the job folder: every check, the exact command, the result)

- `pnpm typecheck`, `pnpm format`, `pnpm vitest run games/<id>` green; the SDK contract tests pass for your game (see how curve-fever is wired).
- Sim: 1,000 seeded bot games at 2, 4 and 8 players terminate within the manifest's `estimatedMinutes` x 2; median round length recorded.
- Mutation check: plant 20 bugs one at a time (scoring, phase exit, hidden info); the tests must catch at least 19; list them.
- Screens: render every phase for TV (1920x1080) and phone (390x844, with a TV and phone-only) through `react-dom/server` or a static capture if a browser is available; keep the HTML or PNG in `media/` (under 10 MB per job) and check the fit by hand.
- Property tests with seeds 1, 2, 3 plus 1,000 random seeds.

## Every job folder (jobs/<ID>-<slug>/) also contains

README.md (what, how to run, how to check, under 60 lines), RESEARCH.md, VERIFY.md, SOURCES.md, ASSUMPTIONS.md, NEXT.md, LOOP.md (one line per KEEP GOING round: what changed, the measured gain), SHA256SUMS.txt for every media file.

## CI

One workflow per job: `.github/workflows/<ID>.yml`, on pull_request with a paths filter for `games/<id>/**` and the job folder, ubuntu-latest, timeout-minutes 30, permissions read-only, actions/\* only; it runs install, typecheck, format and the game's tests, and must be green before the PR leaves draft.

## KEEP GOING

After the PR is green: play the game in your head as 8 strangers in a living room; list the 5 biggest weaknesses (unclear phone screen, dead air, unfair scoring, slow round, boring bot); fix the worst, measure, log it in LOOP.md, push. Repeat until three rounds in a row gain nothing a player would notice. Then go back to RUN-ALL step 1.

## When the web is blocked (cloud egress allowlist)

Never stop a job only because a site returns 403. Try GitHub (repos that document or reimplement the game), package registries, archived copies, and your own knowledge of the game; log what you could not reach in ASSUMPTIONS.md and keep building.
