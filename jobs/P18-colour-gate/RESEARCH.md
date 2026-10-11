# P18 Colour Gate research

Researched 2026-10-11 by r17-local. This is a mechanics study; no source code, art,
audio, fonts, logos or screenshots from the original are included in the port.

## Established original loop

| Finding                                                                                       | Independent corroboration                                                                                                                                                                                                          | Port implication                                                                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| One finger makes a ball bounce upward through moving geometry.                                | [Common Sense Media](https://www.commonsensemedia.org/app-reviews/color-switch), [Code Rewind](https://www.coderewind.com/2016/04/game-color-switch/)                                                                              | One large tap surface; release is not another action.                                                      |
| Only a segment matching the ball's current colour is safe; a mismatch ends the run.           | [Official Google Play listing](https://play.google.com/store/apps/details?id=com.colorswitch.switch2), [Level Winner](https://www.levelwinner.com/color-switch-tips-tricks-strategy-guide-a-look-at-endless-and-challenge-modes/)  | Resolve contact on the server and explain the failed match immediately.                                    |
| Power-ups change the ball colour between obstacles, requiring another read of the next shape. | [Level Winner](https://www.levelwinner.com/color-switch-tips-tricks-strategy-guide-a-look-at-endless-and-challenge-modes/), [Cody's contemporary review](https://codygreviews.blogspot.com/2016/08/)                               | The gate sequence changes colour automatically; tapping controls height.                                   |
| Stars communicate progress and can also buy cosmetic ball shapes.                             | [The Koalition](https://thekoalition.com/2016/the-possibly-perfect-color-switch), [Code Rewind](https://www.coderewind.com/2016/04/game-color-switch/)                                                                             | Give each cleared gate an immediate count increase; cosmetic purchases are unnecessary for this party run. |
| Geometry varies, including spinning circles and other moving shapes.                          | [Common Sense Media](https://www.commonsensemedia.org/app-reviews/color-switch), [The Koalition](https://thekoalition.com/2016/the-possibly-perfect-color-switch)                                                                  | Vary rotation direction and tempo while keeping the safe rule legible.                                     |
| Roughly two taps per second is a useful hover rhythm; faster tapping advances.                | [Pocket Gamer](https://www.pocketgamer.com/color-switch/pocket-gamers-ultimate-guide-to-color-switch/), [Level Winner](https://www.levelwinner.com/color-switch-tips-tricks-strategy-guide-a-look-at-endless-and-challenge-modes/) | Tune a forgiving waiting pocket so reading the gate is a skill alongside climbing.                         |
| Music supports the simple action loop.                                                        | [Official Google Play listing](https://play.google.com/store/apps/details?id=com.colorswitch.switch2), [Common Sense Media](https://www.commonsensemedia.org/app-reviews/color-switch)                                             | Visible pass, switch and crash cues carry the rule even with muted audio.                                  |

The tension is the choice to wait for a safe segment or commit to another bounce.
Clearing a gate produces a small, readable success. A changed ball colour interrupts
the established rhythm, making the player check again. A visible wrong-colour touch
gives the failure a clear cause. These are design inferences from the corroborated
mechanics, rather than measured original telemetry.

The 2016 articles describe the original release. Current official store listings
describe the rebuilt mobile game and verify the continuing colour-match premise;
they do not establish identical physics, levels or sound effects. The exact original
impulse, gravity, collision radius, rotation periods and scoring cap are unverified.
The two-taps figure is player advice, not an engine constant.

## Public client inspection and play limitations

Read the public HTML of [the official site](https://colorswitch.co/). It exposes
Squarespace presentation scripts and a mobile download link, with no original game
client. The [Poki link](https://poki.com/en/g/color-switch) from the contemporary
Koalition article returns 404. Read the HTML and iframe chain of
[GamesEverytime](https://www.gameseverytime.com/color-switch/): its game frame needs
the public page as referrer and then loads a GameDistribution page whose metadata
identifies **Crazy Switch Color**, made by Inlogic Software. That is a different
game, so its runtime and assets are not evidence for the original implementation.

No interactive original play session was completed by the research agent. The
owner's one-browser budget is reserved for the port's verification. This study
therefore records sourced mechanics and explicitly leaves exact original timings
unmeasured. No claim is made that a browser clone is the original game.

## PartyBox adaptation

These are original design choices for P18, to be kept consistent with the final spec.

- Give 2-8 players independent vertical lanes on the TV. Everyone gets the same
  seeded sequence and gate clock, so differences in distance come from decisions.
- Keep the current ball, the next gate and the match symbol visible in each lane.
  Each hue also has a persistent shape/letter cue; colour never carries the rule alone.
- A phone with a TV shows current symbol, personal progress and one thumb-sized
  bounce surface. Copy says to tap to rise and match the symbol at the gate.
- In phone-only rooms, the phone includes its own lane and the control; spectators
  receive the stage without the control. Nobody is asked to look at an absent TV.
- Use bounded simultaneous runs and short score reveals. Farthest progress wins;
  ties remain ties. No speed bonus should overturn a longer climb.
- The shared run deadline bounds slow waiting and disconnected seats. Early crashes
  remain visible with their reached distance, so spectators can follow the race.
- A server-owned fixed step, bounded tap cadence and seeded layout make contact
  reproducible. The local feel must be tuned and checked independently; it is not
  claimed to reproduce unpublished original constants.
- A bot must anticipate the gate's matching interval and choose when to bounce.
  Difficulty changes observation and timing skill, not the scoring rule.

The biggest adaptation risks are eight lanes becoming too small, colour switching
being mistaken for a tap action, and spectators waiting after an early crash. The
verification and KEEP GOING passes should measure these through phase captures,
progress distributions and run duration rather than decorative changes alone.
