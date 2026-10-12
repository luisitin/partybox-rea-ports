# Hole Swallow

## Overview

A shared city for hungry holes: steer, swallow street furniture, grow into cars and buildings,
then threaten smaller rivals. One 90-second round, no elimination, most accumulated points wins.
The shell handles joining, READY and the opening countdown; this game starts directly in play.
Original schematic SVG city, numbered rims, PartyBox tokens and synthesized SDK sound cues.

## Players

2–8, including bots. Every district has identical resources; the seed varies their positions.
Numbers on the city, score rail and phone identify each player independently of color.
Easy bots choose among six useful props; normal bots maximize reward per travel distance and flee;
sharp bots also hunt vulnerable rivals. Bots act from public information only.

## Phases

| Phase  | TV                                                     | Phone with TV                                                      | Exit                        |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------- |
| play   | Shared live city, 90-second clock, numbered score rail | Your number, points, edible size, drag joystick; respawn countdown | 90 s or VIP skip            |
| reveal | Frozen city and complete ranking                       | Your points and place                                              | 7 s or VIP skip             |
| done   | Winner or tied winners and ranking                     | Your final place and points                                        | Terminal; results available |

### Phone-only rooms

| Phase  | Phone stage                                                             |
| ------ | ----------------------------------------------------------------------- |
| play   | Full shared city above joystick; your number and score, size, countdown |
| reveal | Frozen city, complete ranking, your result                              |
| done   | Winner, final city and ranking                                          |

The controller uses `usePhoneOnly()` and the server's `stage` flag. Players who cannot see the TV
receive the stage too. Spectators receive the stage without controls. A TV-room controller omits
the city to keep updates small. No secrets exist: every active object, hole and score is public.

## Inputs

`{ type: 'move', x, y }`: each axis finite and between -1 and 1. Drag the pad or hold arrow keys;
release, cancel, loss of pointer capture, blur or a hidden document sends zero. Diagonals normalize.
Spectators, unknown ids, disconnected players and past inputs are ignored. Reopening a controller
stops its old direction. The server also stops a seat on disconnect/reconnect and all seats on pause.

## Scoring

| Object | Footprint radius | Points |
| ------ | ---------------- | ------ |
| Bin    | 1                | 2      |
| Tree   | 1.7              | 3      |
| Bench  | 2.6              | 5      |
| Car    | 4.2              | 12     |
| House  | 7                | 28     |
| Tower  | 10               | 60     |

Radius = `min(14, 3.4 + 0.6 × sqrt(growth points))`; speed =
`max(11, 19 - 0.35 × sqrt(growth points))` city units/second. An object's footprint must be smaller
than the rim and its center within `rim radius - 0.5 × footprint radius`.
A rival needs a rim at least 1.25 times the prey's and center distance at most
`big radius - 0.35 × small radius`; reward is `10 + floor(prey's growth points / 2)`.
Points persist through respawns. Growth resets; the highest total wins, exact ties share rank.

## Edge cases

- Being swallowed gives a 3 s respawn, then 2 s protection: neither eats nor is eaten by rivals.
  Respawns choose the district farthest from active opponents; no phone tap is needed.
- Small props recycle after 20 s; cars/buildings are finite. Each district starts with 19 objects.
- Fixed 100 ms steps, 200 ms engine deadlines. Late timers catch up to 90 s; input ordering is
  monotonic. No hidden wall clock, mutable global state or runtime network requests.
- A contested object goes to the closest center; equal distances rotate priority by tick/object.
  Predation resolves largest first; a swallowed hole cannot eat another on that step.
- Pause settles time first, stops all motion, then shifts the round clocks on resume. Respawn and
  recycle clocks remain relative to play time. VIP skip/end credits play up to the event's time.
- Disconnected seats stop and remain in results; nobody is awaited. Refresh restores the same seat.
- State is JSON. RNG, spatial cells and steering histories are omitted from views.

## Settings

None. The binding P08 experience is one 90-second round. English only; Arcade category.

## Content

Eight generated districts with equal object budgets. Seeded jitter gives fresh routes.
No card packs; `content/schema.ts` exports an empty `packs`. All art is original SVG/CSS.

## Sources

The [official developer listing](https://apps.apple.com/us/app/hole-io-original-hole-game/id1389111413)
and independent firsthand [city walkthrough](https://tech.blog.aerie.jp/entry/2018/06/21/091300)
agree on small props → cars → buildings growth. The [PC publisher listing](https://store.steampowered.com/app/2751230/Hole_io/)
and [independent play report](https://grace8snorlax.tistory.com/entry/Holeio-%EA%B3%B5%EB%9E%B5?category=746957)
describe rival consumption. The original classic timer was two minutes; P08 specifies 90 s.
Numeric radii, speed, scoring, containment, recycling and respawn protection are original port tuning,
not claims about canonical source constants. Research and source-access limits are recorded in
`jobs/P08-hole-swallow/{RESEARCH,SOURCES,ASSUMPTIONS}.md`. No original assets or code were copied.
