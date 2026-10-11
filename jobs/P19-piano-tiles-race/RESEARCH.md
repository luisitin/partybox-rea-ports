# P19 — Piano tile race research

## Scope and access

Research completed 2026-10-11 before the game implementation. The target mechanic is the original dark-tile tapping family, especially its short timed Zen challenge. Tile Tempo is an original PartyBox name and uses original visuals.

Read the original publisher's storefront, a contemporary hands-on report, a separate 2014 implementation's developer description, a first-hand guide, an educational reconstruction and a current browser reconstruction. Source URLs and provenance are in [SOURCES.md](SOURCES.md).

Live input was unavailable: the computer-use inventory returned no enabled apps or browsers. No headless browser was launched for research. The native original mobile app was not installed or played. ToolGenie's page and public client bundle were fetched successfully over HTTP; observations below come from static inspection, not a claimed live play-through. GameFAQs direct access was restricted; its indexed guide text was still available. These limitations do not prevent reproducing the independently documented core rules.

## Corroborated mechanics

Every generalized mechanic below has two independent sources. A storefront and another language edition of that same storefront are never counted twice.

| Mechanic                                                                           | Independent evidence                                                                                  | PartyBox consequence                                                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Target dark tiles and avoid light tiles; a wrong light tap ends a run.             | S1 publisher rule + S4 introductory game description; S5 also explicitly describes immediate failure. | Four large columns; a wrong current-row column stops only that player.             |
| Zen is a timed maximum-tile challenge; 30 seconds is an established variant.       | S2 contemporary hands-on + S3 independent developer description; S6 lists 15/30/60-second variants.   | One shared 30-second race, exactly as P19 requests.                                |
| Classic has a fixed tile target, commonly 50; Arcade can be unlimited.             | S2 + S3.                                                                                              | Preserve quick repeatable attempts, while porting only the requested timed mode.   |
| Four columns are the familiar phone layout.                                        | S4 primary documentation + S5 independent browser implementation.                                     | Four equal-width phone columns, with the current row at the bottom.                |
| Correct tapping is paired with piano-style feedback.                               | S1 publisher features + S2 hands-on report.                                                           | Use the platform's generated cues; no original songs or recordings.                |
| Classic/Zen can advance with correct input rather than force an autonomous scroll. | S7 first-hand Classic review + S8 database account of Classic/Zen.                                    | Self-paced row advancement is appropriate; no missed-tile timeout is added to P19. |

The external material does not establish one universal row size, hit window, timing start, duplicate-input rule or rush-speed formula across versions. Those values are not presented as original facts.

## Public-client inspection

ToolGenie's S5a bundle generates a four-cell row with one dark cell, increments its score by one for a correct hit, and caps Zen at 30 seconds. It renders moving rows, chooses the lowest eligible cell near its hit line, ends on a white hit, and plays short generated note/error tones. Its Zen allows untouched rows to pass. These observations describe that reconstruction only; its scrolling and hit window are not claimed to be authentic original behaviour. S4's own exercise likewise awards one point for a dark hit; that corroborates the simple count mechanic in these independent reconstructions.

The important feel is clear from the common loop: read the next target, move a thumb, receive immediate confirmation, then decide how much speed to risk. A single mistake makes the count final. Looking ahead and the tension between a safe rhythm and a faster finish give a small board repeated-play value. This is a design interpretation of the documented loop, not a historical claim.

## PartyBox design

- 2-8 players race simultaneously on the same initial seeded 1,024-row sequence, extended in shared chunks as needed. Each row has one dark note in one of four columns; the sequence is generated once using the SDK's seeded PRNG.
- Ready lasts 3 seconds and names the rule before controls activate. Play lasts at most 30 seconds and ends immediately when every run is out. Score holds the final count for 6 seconds, then done exposes terminal results.
- A phone shows its own next four rows, current count, the shared clock and an unmistakable current-row marker. Only the current row is actionable. No automatic missed-tile loss is imposed.
- The TV makes count the focal point: every player's progress, count, tiles per second and a text status. It never shows upcoming targets. The same public race stage is available on phones in phone-only rooms.
- Every correct current-row tap scores one tile. A wrong current-row column locks that player's count. Highest count wins; equal counts tie. Speed is explanatory feedback and never breaks a tie.
- Each input includes the absolute current row. Duplicate, stale and future-row packets are ignored, so a replay or a delayed tap cannot score twice or crash the next row.
- An eliminated player watches the race until the reveal. A spectator gets the stage and no controls. Disconnects do not pause the clock; rejoining restores the player's count and next row.
- Bots use the visible upcoming target and seeded reactions with three strengths and rare mistakes. They do not read opponents' future rows or bypass the race deadline.

## Deliberate changes

The simultaneous common-seed race, anti-replay row index, living-room TV, phone-only stage, ties and phase timings are PartyBox design decisions. Earned tiles are retained after failure so an early mistake still has a comprehensible result. The title and artwork are original; sound comes from PartyBox rather than downloaded recordings.
