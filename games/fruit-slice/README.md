# Fruit Slice

## Overview

Swipe through flying fruit on your own phone while the TV shows the shared
fountain and everyone's scores. Everyone gets identical seeded opportunities;
another player's slice cannot steal yours. One 60-second round, then a short
leaderboard and the final results. Original art, English only, Arcade category.

## Players

2–8 players, including bots. Bots search safe lines through the same current
targets as a phone: easy prefers single fruit and sometimes hesitates, normal
finds safe combos, sharp hesitates less. A disconnected player stops scoring;
the match continues. Spectators watch the stage without slice controls.

## Phases

| Phase | TV                                                                 | Phone with TV                                                | Exit             |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------- |
| play  | Shared fruit fountain, 60 s clock, eight named score/streak meters | Own fruit surface, score, streak and accepted-swipe feedback | 60 s or VIP skip |
| score | Ranked scores and best combos                                      | Own score and complete standings                             | 7 s or VIP skip  |
| done  | Winner or tie and final standings                                  | Place, score, best combo and standings                       | Terminal results |

### Phone only

| Phase | Phone as stage                                                                               |
| ----- | -------------------------------------------------------------------------------------------- |
| play  | Same personal fountain and controls, clock, compact leader line; spectators see the fountain |
| score | Complete standings, own score and best combo                                                 |
| done  | Winner/tie, own place and complete standings                                                 |

`ctx.presence.phoneOnly`, remote seats with `canSeeTv: false`, and SDK
`usePhoneOnly` are supported. No phase sends players to a TV. The game starts
playing immediately after the shell's rules/ready/countdown.

## Inputs

`{ type: 'slice', wave, frame, seq, points: [{x,y}, ...] }`: 2–32 points in a
100×100 board. A pointer stroke sends one complete polyline; keyboard-accessible
fruit controls send a short stroke. Server segment/circle intersection decides
hits. A zero-length stroke does nothing. The client freezes a gesture's targets;
its frame may be at most 1.2 s old and must belong to the current wave.
Unknown/disconnected players, replayed sequences, future frames, stale waves,
out-of-bounds points and more than 20 strokes per wave are ignored.

## Scoring

Each fresh fruit is 10 points. Three or more in one stroke doubles the fruit
points. Add 2 points per preceding successful safe wave, capped at +10 per
successful stroke. A wave with no fruit resets the streak. Any bomb hit gives
zero for that entire stroke, resets the streak and locks slicing until the next
wave (at most 2 s). Previous points remain; nobody is eliminated. Best combo is
the largest number of fruit in an accepted safe stroke. Most points wins;
equal scores share a rank. There is no random critical or hidden tie-break.

## Edge cases

- Waves last 2 s with 3–5 fruit, a parabolic flight and a separated X-marked bomb
  every other wave. The first wave is safe. Tick deadlines re-arm every 200 ms;
  the visible deadline is the round's end, not the next beat.
- Each fruit scores only once per player per wave. Bomb-first settlement also
  cancels a mixed fruit/bomb stroke. Views omit raw seat state, cuts and RNG.
- Pause freezes inputs, flight and clock. Resume shifts the round's origin and
  end together. VIP skip ends play at the current score; VIP end retains scores.
- Refresh reconstructs cuts, score, sequence and bomb lock from the state.
  Stale timers cannot skip phases. The terminal phase ignores game inputs.
- The state keeps only one wave and bounded cuts; no unbounded stroke histories.

## Settings

No game-specific settings. Bot strength and room presence come from the host.

## Content

No external packs. Seed-generated fruit; `content/schema.ts` exports empty packs.
SVG fruit shapes and bomb X symbols are original and use PartyBox colour tokens.
The shell's sound cues provide feedback; no reference sound or music is shipped.

## Sources

Mechanics were studied from [Halfbrick's beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja),
[Halfbrick's Arcade announcement](https://www.halfbrick.com/blog/fruit-ninja-arcade-mode-announced),
[independent Arcade coverage](https://www.intomobile.com/2010/11/09/fruit-ninja-receives-arcade-mode-update-for-both-iphone-and-ipad/)
and the [FX2 cabinet manual](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/fruit-ninja-fx-2-redemption-service-manual-adrenaline-amusements.pdf).
Source-reported facts, client inspection limits and adaptation constants are
recorded in `jobs/P20-fruit-slice/RESEARCH.md` and SOURCES.md. No original game
code, assets, name, music or network service is used.
