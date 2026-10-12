# P01 Kahoot! upgrade base - preparation only

Core HEAD: 6ce46e613d3705624a56647592979613c4d6e468. Game last commit: d0b89e3a89f40250349e2233fffe056960febb94. Source game clean at preparation.
SOURCE.json records source file hashes; INVENTORY.json records each resulting hash. All adaptations are enumerated below.

## Applied adaptations

1. games/kahoot/AGENTS.md: Canonical local header and public-kit test command; retain game-local constraints.
2. games/kahoot/README.md: Canonical spec heading and accurate excluded-media/unwired-pack description; gameplay spec retained.
3. games/kahoot/**tests**/final-topic.test.ts: Canonical game-id arguments in copied tests; assertions otherwise unchanged.
4. games/kahoot/**tests**/next-button.test.ts: Canonical game-id arguments in copied tests; assertions otherwise unchanged.
5. games/kahoot/**tests**/phone-timer.test.ts: Canonical game-id arguments in copied tests; assertions otherwise unchanged.
6. games/kahoot/**tests**/race-order.test.ts: Canonical game-id arguments in copied tests; assertions otherwise unchanged.
7. games/kahoot/client/Controller.module.css: Replace undefined --pb-font-small with existing --pb-font-caption.
8. games/kahoot/client/Controller.tsx: Change visible intro title to Kahoot! only.
9. games/kahoot/client/Tv.tsx: Change visible TV intro title to Kahoot! only. Existing inline SVG bolt and CSS form the visual fallback.
10. games/kahoot/client/shared.ts: Set shared id kahoot; exclude licensed host file-music plan. Keep SDK reveal/wager sounds and do not substitute a new bed.
11. games/kahoot/content/schema.ts: Exclude unrelated unwired Name Your Baby schema/registration along with its data/test. Wired EN/ES schemas unchanged.
12. games/kahoot/manifest.json: Set canonical id kahoot and name Kahoot!; remove art references. All other manifest gameplay fields retain source values.
13. games/kahoot/server/index.ts: Carry ctx.presence.phoneOnly into standalone state. Draw/scoring/phase/timer code otherwise unchanged.
14. games/kahoot/server/recap.ts: Change recap title to Kahoot! only.
15. games/kahoot/server/types.ts: Add optional phoneOnly state metadata; legacy fixtures without the field remain accepted.
16. games/kahoot/server/views.ts: Emit room/per-player phoneOnly plus public contentLang normally injected by the core host. No hidden or gameplay fields added.
17. reports/content/lightning-round-sources.md: Repair local provenance destination link only; historical evidence and attribution retained.

## Preserved baseline

No classic mode, shape-only controller, P01 authored packs, answer stamp, score phase or podium implementation was added. Existing 1-16 wager/library flow, defaults/settings, 300-point streak cap, custom/preset wagers, awards, recap, reading floors, minigame settings and persistent final-board registration remain copied behavior.
Source phone-entry.ts already omits ownSpectatorScreen. It is unchanged; no unsupported property was introduced or reported as removed.
EN/ES library JSON, content-pack-origins.json, content/SOURCES.md, manifest.es.json and five fixtures remain byte-identical to source. The 200-row provenance report has only its local destination link repaired.
All art/audio/media files are excluded. Existing inline SVG bolt and token CSS are the visual fallback. P01 classic art/components were not imported. The licensed core track is recorded for host-only integration; this draft does not claim equivalent background music.

## Remaining work and limits

This temp tree has no package.json, node_modules or host. Import into an authorized public worktree before any verification. No test, build, install or browser was run.
Copied core spectator behavior remains WaitingScreen. A real phone-only spectator stage and later host spectator-screen opt-in are pending upgrade work. Standalone phoneOnly metadata does not claim complete spectator UI.
Core category classics, EN/ES inheritance and version 1.1.0 remain baseline metadata. Reconcile generic P-job arcade/English-only wording and release version before final PR compliance.
Future classic mode must separately adapt the P01 pack schema, avoid drawing 21 wager items from a 20-question pack, make final predicates/round totals/contract helpers mode-aware and retain the existing wager finale.
Future required simulations: 1,000 seeds for every supported count 1-16 per quiz mode (minimum 32,000 games), strengths recorded, plus preserved minigame coverage. The original P01 7,000-game/8-seat evidence does not verify this draft.
No P01 screenshots/checksums, private host films, art/audio, Name Your Baby data/test/schema registration or unrelated pack assets were copied.
The first documentation step stopped on a PowerShell stdin encoding mismatch. It was resumed in this same owned temp directory using ASCII script literals; copied UTF-8 source bytes were preserved. No repository was changed.
SHA256SUMS.txt covers every draft file except itself. INVENTORY.json enumerates payload/document files, excluding the inventory/checksum audit files.
