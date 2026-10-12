# P24 Haxball

Two teams of numbered discs pass, bump and kick a puck into opposite goals. Players steer
with a held D-pad and arm a kick with their other thumb. The public TV pitch shows the score,
attacking direction and two 90-second halves; phone-only players see the same pitch locally.

Original pitch/disc art, balanced teams, one named helper for odd rosters, three bot strengths,
spectator watching and lease-based recovery are included. Numerical tuning and match structure
are explicit PartyBox choices; research preserves the original's radial, edge-armed kick feel.

## Run and check

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm format
pnpm vitest run games/haxball
```

Install is performed once per clone. Import `game` from `games/haxball/server/index.ts` in a
PartyBox registry, with `client/tv-entry.ts` and `client/phone-entry.ts` on their matching surfaces.
This public snapshot supplies SDK primitives rather than a complete LAN room host.

The real SDK contract and scoped tests verify rules, held inputs, pause/reconnect, public pitch
views, property sequences, seeded bots and SSR phone-only/spectator screens. VERIFY.md records
actual results, planted faults, fit review and evidence hashes; unfinished checks are identified.

- Game spec: `games/haxball/README.md`
- Research/provenance: `RESEARCH.md`, `SOURCES.md`, `ASSUMPTIONS.md`
- Verification: `VERIFY.md`, `SHA256SUMS.txt`, `media/`
- Resume/improvement record: `NEXT.md`, `LOOP.md`

The official name follows the owner's JOBS.md table. Art and code are original; no vendor
assets, external fonts, tracking or runtime network calls are used. Live-play limits are disclosed.
