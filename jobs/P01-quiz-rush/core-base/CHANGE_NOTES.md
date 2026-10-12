# P01 Kahoot! upgrade changes

## Current public implementation

The canonical `games/kahoot` upgrade is implemented; wager remains the default and legacy absent-mode
states continue that flow. It preserves the EN/ES libraries, 1–16 seats, 300-point streak cap,
custom/preset bets, final scoring, awards/recap and minigame. No dependency or runtime API was added.
Classic adds three original English twenty-question packs, exact requested counts, shape-only
TV-side phone pads, question/start-stamped answers and descending occupied podium tiers.

Both modes use reading floors with a default 15-second requested answer minimum. Ordinary wager
reveals keep the question/chart/race separate from all-seat ranked standings. TV-side phones change
to a compact receipt at standings; phone-only/remote/spectator stages show chart then public board.
The final keeps its bet/answer/verdict/totals choreography and shows totals for all sixteen seats.
Reveal/podium stages own names and boards; shell strips hide in intro/reveal/podium without
reclaiming their reserved height. Classic uses a board when any rank has 3+ tied entries; paired
wide names wrap within the podium. Unrevealed classic final rivals' totals remain withheld.

Capture evidence now loads the pinned Nunito Variable font from a licensed local WOFF2 asset,
retaining `NUNITO-LICENSE.txt` (OFL 1.1). It uses the core global h2 rule and colour inheritance.
The 1920×1080 TV frame reserves a 133.2 px header, 152.8 px player strip, 22 px bar and 80 px footer,
leaving a 692 px Stage/626 px inner area. The 390×844 phone uses a 60 px VIP header, 27.6 px
counter strut and 4 px bar; there is no invented host footer or extra main-area timer.

The latest 91 captures pass fit checks and hand review; evidence is 8,957,011 B, browser PID 96636
is closed. A CSS rank separator added after hand review awaits focused recapture. Full game run
21307 is active; fresh typecheck/format/full-test/CI results and remaining KEEP GOING gates are
not claimed complete. Round-1 CI at `4cf1a53` (226/226) is historical baseline evidence.

## Historical preparation snapshot

The following records the original input preparation, not the current implementation or status.
SOURCE/INVENTORY hashes describe that snapshot; they are not hashes of the modified public game.

Core HEAD: 6ce46e613d3705624a56647592979613c4d6e468. Game last commit: d0b89e3a89f40250349e2233fffe056960febb94. Source game clean at preparation.
SOURCE.json records source file hashes; INVENTORY.json records each resulting hash. All adaptations are enumerated below.

## Historical preparation adaptations

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

## Historical copied baseline

No classic mode, shape-only controller, P01 authored packs, answer stamp, score phase or podium implementation was added. Existing 1-16 wager/library flow, defaults/settings, 300-point streak cap, custom/preset wagers, awards, recap, reading floors, minigame settings and persistent final-board registration remain copied behavior.
Source phone-entry.ts already omits ownSpectatorScreen. It is unchanged; no unsupported property was introduced or reported as removed.
EN/ES library JSON, content-pack-origins.json, content/SOURCES.md, manifest.es.json and five fixtures remain byte-identical to source. The 200-row provenance report has only its local destination link repaired.
All art/audio/media files are excluded. Existing inline SVG bolt and token CSS are the visual fallback. P01 classic art/components were not imported. The licensed core track is recorded for host-only integration; this draft does not claim equivalent background music.

## Historical preparation status (superseded)

At preparation the temp tree had no package.json, node_modules or host; no install, test, build or browser was run. Public-worktree verification followed after import.
The copied spectator WaitingScreen and phoneOnly metadata were preparation-only limits. The current public implementation supplies read-only stages for spectators and departed seats; later core spectator-screen opt-in remains a host migration handoff.
Copied classics/category/version metadata was subsequently reconciled to canonical arcade metadata and the classic-pack English-only scope while preserving EN/ES wager content.
Classic was subsequently implemented with its own schema, exact question count, mode-aware final predicates/round totals/contract helpers, stamped inputs and podium; the wager finale remains intact.
Current simulation evidence includes 1,000 seeds at each supported count 1-16 in each mode (32,000 games), recorded bot strengths and preserved minigame coverage. The old 7,000-game/8-seat result remains historical.
No P01 screenshots/checksums, private host films, art/audio, Name Your Baby data/test/schema registration or unrelated pack assets were copied.
The first documentation step stopped on a PowerShell stdin encoding mismatch. It was resumed in this same owned temp directory using ASCII script literals; copied UTF-8 source bytes were preserved. No repository was changed.
SHA256SUMS.txt covers every draft file except itself. INVENTORY.json enumerates payload/document files, excluding the inventory/checksum audit files.
