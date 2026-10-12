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
The 1920×1080 playing TV frame reserves a 133.2 px header, 152.8 px player strip, 22 px bar and 80 px footer,
leaving a 692 px Stage/626 px inner area. The 390×844 phone uses a 60 px VIP header, 27.6 px
counter strut and 4 px bar; there is no invented host footer or extra main-area timer.

Round-2 baseline passes 238/238 tests (26 files, 416.59 s), 32,000 bots, 2,006 property seeds
and fresh 20/20 behavioral mutations. CI 38235645918 passed at `e189d22`. The 91 actual-host
captures include the rank separator; browser PID 39756 closed. Final baseline hashes pass:
226 media files/9,843,669 B and all 76 source, six restoration, font and token hashes match.
Session 94152 passed typecheck; formatting failed only for VERIFY.md during an active edit.

Round 3 removes the stale disjoint choices/roster minimum while keeping 2 s settling and max
actual TV/phone/staged reading floors. EN/ES eight-seat holds improve 58,063 → 53,734 /
63,257 → 56,331 ms. Local checks pass 240/240, 26 files, 881.47 s, exit 0; all 32,000 bots and
2,006 property seeds regenerated. Fresh mutation session 84630 passes 20/20 against 72 baseline
tests, exit 0, source restored. Typical wager medians improve eight-player 84,906 → 84,473 ms
(433 ms saved) and sixteen-player 115,642 → 113,910 ms (1,732 ms); longest remains 1,425,695 ms.

The `8cb7355` milestone omitted a regenerated fixture and failed CI 38238453616; root corrected
it at `df5322a`, then CI 38238947209 failed formatting 21 fixtures. Root formatted/pushed
`bd91828`; CI 38239089152 is green, with main claim refresh `646f3a0`. Failed runs are not PASS.

Round 4 fixes Finale host fit and unconditional wager start copy. The real Results Stage is
866.8 px/758.8 px inner with winner hero/recap; all sixteen bets/deltas/totals remain at 32 px.
EN/ES step 3 distinguishes Classic podium from Wager final bet. Current runtime differs from
round-3 pacing; its full/head CI checks remain pending.

Current capture passes 94/94 with zero overflow/clipping/unstyled content/scrolling; a deliberate
same-state before-repair baseline has 85 clipped items, giving 95 records total. Ninety earlier
PNGs remain byte-identical to e189d22; the remaining old frame changes the rank separator.
Shared evidence CSS bundles the actual module selectors plus capture shell, keeping local tokens/
font and reducing the checkpoint to 235 files/8,279,094 B. Browser PID 87684 verified closed in
finally; EPERM profile cleanup is deferred. Typecheck 41896 PASS, SSR 42/42 and nine renderer
checks PASS. Full 60859 is active without evidence fixture generation; expected 241 tests in 26 files is not
PASS. Root will format, produce stable fresh hashes, push sources/artifacts and require final-head
CI. Three no-gain rounds remain; no completed upgrade loop or DONE. Historical hashes stay below.

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
