# P05 Blob Arena research

Research date: 2026-10-11. Runner: `r5-local`. Original studied: Agar.io. This is a mechanics study; no original code, visual assets, branding, audio, or fonts are included in the port.

## Access and attempts to play

1. Opened the original URL with the web research tool; it returned HTTP 403.
2. Tried the installed browser surface: `cua.createBrowserTab("iab", "https://agar.io/", { visible: false })` reported that `iab` was unavailable. `cua.getState()` returned `apps: []` and `browsers: []`. Interactive play and listening were therefore unavailable through that tool.
3. A direct PowerShell `Invoke-WebRequest https://agar.io/ -UseBasicParsing -TimeoutSec 20` succeeded: HTTP 200, 8,573 characters of HTML. Read the public script list and fetched the live start bundle and core wrapper into memory. Nothing from the original was written into the repository.
4. The 788,527-character start bundle contains control/mode text and a sound library. The 65,213-character core wrapper exposes movement target, split, eject, mass-display, and a sound callback. Its physics are not readable server rules: this is not a measurement of current movement or collision constants.
5. A short follow-up request for `mc/agario.js` returned an HTML error page, while the longer pending request eventually returned 4,591,927 characters of readable JavaScript. It includes arena/menu sound toggles and defaults. The original Miniclip blog URL and a Wayback fallback were unavailable. Read the archived Miniclip article through RSSing, official support, independent guides, historical measurements, and a public server reimplementation instead, as RULES.md directs.

No successful interactive session is claimed. Original timing and audio that could not be measured are explicitly uncertain. Research access failure does not block implementing the independently documented mechanics.

## Independently corroborated mechanics

The two links in each row are separate authored sources. The RSSing page preserves Miniclip's historical article; it is one publisher source, not an independent second witness to another Miniclip page.

| Finding | Evidence 1 | Independent evidence 2 | Port implication |
| --- | --- | --- | --- |
| Pellets and smaller opponents are food; size is both progress and risk. | [Miniclip support](https://support.miniclip.com/hc/en-us/articles/4404685562641-How-to-start-playing-Agar-io) | [Komarek's gameplay guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | Food must stay available, and every player's size must read immediately. |
| Larger cells move more slowly. | [Miniclip tips archive](https://miniclip783.rssing.com/chan-25840256/latest.php) | [Komarek's guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | Growth buys reach rather than universal speed superiority. |
| Desktop movement follows a target; SPACE splits. | [Miniclip support](https://support.miniclip.com/hc/en-us/articles/4404685562641-How-to-start-playing-Agar-io) | [Komarek's guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | Steering direction also aims the lunge. |
| Mobile has a joystick and separate split button. | [Miniclip support](https://support.miniclip.com/hc/en-us/articles/4404685562641-How-to-start-playing-Agar-io) | [Pocket Gamer's first-hand review](https://www.pocketgamer.com/agar-io/review/) | One thumb steers; the other taps a large split button. |
| Splitting divides mass and projects a piece forward; attack and escape both carry risk. | [Miniclip tips archive](https://miniclip783.rssing.com/chan-25840256/latest.php) | [Agar.io Wiki: Splitting](https://agario.fandom.com/wiki/Splitting) | The lunge must be useful, but splitting must not create mass. |
| Split pieces cannot immediately reunite; keeping pieces close matters. | [Miniclip tips archive](https://miniclip783.rssing.com/chan-25840256/latest.php) | [Komarek's guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | Show a merge lock and make regrouping understandable. |
| The arena has boundaries that can trap a smaller cell. | [Miniclip tips archive](https://miniclip783.rssing.com/chan-25840256/latest.php) | [Komarek's guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | Walls clamp movement and remain clearly visible on the shared stage. |
| Classic FFA is a mass/survival leaderboard, with a small restart after all cells are lost. | [Komarek's guide](https://jirikomarek.net/web/how-to-play-agar-io-skins-controls-description/) | [Wikipedia gameplay summary](https://en.wikipedia.org/wiki/Agar.io#Gameplay) | A living-room adaptation needs its own bounded match and short recovery. |

## Quantitative evidence and its limits

- A [historical first-hand reverse-engineering notebook](https://windfis.ch/git/agario-bot/tree/reversing_game_mechanics/game_mechanics.txt?h=pathfinding) reports a fit of `speed = 86.05 / radius^0.45`. The [independent Ogar implementation](https://github.com/OgarProject/Ogar/blob/master/src/entity/PlayerCell.js) uses a different radius exponent, `0.32`. Both support decreasing speed, but neither establishes today's official formula. Its [plain-text endpoint](https://windfis.ch/git/agario-bot/plain/reversing_game_mechanics/game_mechanics.txt?h=pathfinding) was successfully read after the rendered endpoint timed out. Blob Arena uses its own mass exponent `-0.23`, not copied implementation code.
- [The wiki](https://agario.fandom.com/wiki/Splitting) gives a merge delay of roughly `30 s + 0.0233 × mass`. [Arqade](https://gaming.stackexchange.com/questions/220440/what-are-the-criteria-for-re-combining) gives `30 s + 0.02 × mass`, but attributes that value to Ogar. They agree on delayed reunion, not a reliable exact contemporary original constant. Blob Arena's 8-second lock is deliberate compression for 90-second rounds.
- The notebook is dated 2015-09-01 and reports reunion becoming possible after 745–790 frames while its session ran at 27–28 FPS. Dividing those observations gives roughly 27–29 seconds; this is an inference from historical measurements, not a present-day timer. Actual reunion still depended on steering the pieces into one another.
- The notebook describes an approximate `1.25` eating threshold while expressing uncertainty about radius versus mass. [Ogar's collision rules](https://github.com/OgarProject/Ogar/blob/master/src/CollisionHandler.js) use `1.3` and an overlap check; community accounts vary further. Blob Arena explicitly defines a `1.25` **mass** ratio and deep overlap. This is a house rule, not an assertion about the live original.

## Round structure, scoring, and feel

The source game rewards opportunistic movement: collect safely while small, judge whether a lunge leaves enough mass to win, and protect split pieces until reunion. Its familiar tension comes from seeing a large neighbour approach and choosing between a turn, a split escape, and a risky attack. These are design inferences from the corroborated mechanics above, not first-hand play observations from this session.

Miniclip also describes a timed mass-gathering Rush mode, but an exact original timer is not required or asserted here. P05 itself binds this port to three rounds of 90 seconds, scored by remaining mass.

The PartyBox loop is therefore: steer and snack → threaten or split → lose pieces or swallow a rival → return after three seconds if fully swallowed → race the final clock → reveal this round's mass and cumulative points → next round. There is no lobby economy, ad continuation, persistent progression, virus, mass ejector, or large-map zoom. Those additions would distract eight first-time players from the one thumb-and-split interaction.

## Sound study

The live wrapper has a sound callback and the start bundle includes a sound library. The readable `mc/agario.js` defaults arena sounds off and menu sounds on; it invokes named menu effects. These are single-source client observations, not independently corroborated audio behavior. No browser surface was available to listen, and two independent sources were not found for exact original cue timing or a music bed. Do not describe the original as silent or reproduce an unverified audio sequence.

Blob Arena uses PartyBox's own muted-by-shell synthesized phase/countdown/reveal cues. Steady food consumption should not produce eight overlapping sound streams. The sound plan, reduced-motion behavior, and final countdown belong to the existing design system.

## PartyBox adaptation

| Choice | Purpose |
| --- | --- |
| One fixed 160 × 100 arena for 2–8 players | Everyone can locate the same interaction without a personal scrolling camera. |
| 24 starting mass; 96 replenishing pellets worth 3 mass | Fast, understandable growth and continued recovery routes. |
| `radius = min(24, 0.55 × sqrt(mass))`; speed `max(6, 20 × (mass / 24)^-0.23)` units/s | Area reflects mass while large cells retain enough movement for a short round. |
| Four cells maximum; 48 mass needed to split; one-second input cooldown | Keeps the stage readable and prevents repeated taps from creating uncontrolled fragmentation. |
| Split halves mass, directional launch, 8-second merge lock; eligible siblings then gather at 8 units/s | Preserves the attack/escape tradeoff on a much shorter timescale without requiring a new gather button. |
| 1.25 mass ratio plus deep overlap | Equal peers cannot eat one another on a glancing touch. |
| Automatic 3-second respawn, 2-second protection | Being swallowed creates a comeback beat, not 80 seconds watching others. |
| Round-end total mass becomes points; sum over three rounds | The final moments matter; split mass scores once regardless of piece count. |
| Phone-only live arena with the same controls | A phone can be the stage; spectators watch without buttons. |
| Three bot strengths | Empty seats make credible opponents without private information. |

All numerical choices in this table are our own tuning. The implementation and game's README are the final authority for exact collision, control, and phase behavior; verification measurements go in VERIFY.md, not this research log.
