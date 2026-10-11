# P20 Fruit Slice research

Researched 2026-10-11 by r19-local. The job is a 60-second phone swipe game with
individual combo meters and one TV fruit fountain. This makes the original's
**Arcade score attack** the closest reference; Classic's elimination rules are a
different mode. The name, art and sound of the reference are not reused.

## Evidence and confidence

These are source-reported facts, not a claim of hands-on original-game testing.
Halfbrick pages are one source family; multiple pages from it are not counted as
independent confirmation. The licensed cabinet manual is a separate product and
its details are only used to corroborate the shared interaction.

| Mechanic          | Finding                                                                                                               | Two independent sources                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input             | Dragging across the screen cuts fruit along a swipe.                                                                  | [Halfbrick beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja), [Adrenaline Amusements FX2 manual, p. 7](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/fruit-ninja-fx-2-redemption-service-manual-adrenaline-amusements.pdf)                       |
| Combo             | At least three fruit cut in one swipe earns a combo bonus.                                                            | [Halfbrick beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja), [FX2 manual, p. 7](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/fruit-ninja-fx-2-redemption-service-manual-adrenaline-amusements.pdf)                                             |
| Clock             | Arcade is a highest-score race lasting 60 seconds.                                                                    | [Halfbrick announcement](https://www.halfbrick.com/blog/fruit-ninja-arcade-mode-announced), [IntoMobile's 2010 coverage](https://www.intomobile.com/2010/11/09/fruit-ninja-receives-arcade-mode-update-for-both-iphone-and-ipad/)                                                                                                   |
| Bomb              | The timed mode continues after a bomb; the bomb is a setback. The cabinet manual specifically describes a score loss. | [IntoMobile's Arcade/Classic distinction](https://www.intomobile.com/2010/11/09/fruit-ninja-receives-arcade-mode-update-for-both-iphone-and-ipad/), [FX2 manual, p. 7](https://www.betson.com/wp-content/uploads/wpallimport/files/redemption-service-manuals/fruit-ninja-fx-2-redemption-service-manual-adrenaline-amusements.pdf) |
| Deliberate timing | Waiting for the top of a fruit's arc makes a controlled slice easier.                                                 | [Halfbrick beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja), [SuperCheats' independently written tips](https://www.supercheats.com/guides/fruit-ninja/other-tips)                                                                                                                        |
| Power bursts      | Arcade bananas temporarily double points, increase fruit density, or slow the action; their effects can overlap.      | [Halfbrick announcement](https://www.halfbrick.com/blog/fruit-ninja-arcade-mode-announced), [IntoMobile coverage](https://www.intomobile.com/2010/11/09/fruit-ninja-receives-arcade-mode-update-for-both-iphone-and-ipad/)                                                                                                          |
| Sustained success | Repeated combos build a stronger Blitz reward.                                                                        | [Halfbrick beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja), [SuperCheats basics](https://www.supercheats.com/guides/fruit-ninja/in-a-butshell)                                                                                                                                          |
| Ending flourish   | Arcade ends with a fruit that can be sliced repeatedly for extra points.                                              | [Halfbrick beginner guide](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja), [SuperCheats modes](https://www.supercheats.com/guides/fruit-ninja/game-modes)                                                                                                                                              |

The SuperCheats basics page was fetched by following the site's own link. Its
actual URL uses the misspelled slug `in-a-butshell`. It corroborates escalating
Blitz rewards but not the exact inactivity timeout.

## Details reported by only one source

Halfbrick's beginner guide says a combo doubles its fruit score, random criticals
add 10, and a long gap without a combo resets the Blitz meter. Exact gap duration
is not supplied. These are useful design references, not independently measured
constants. [Source](https://www.halfbrick.com/blog/the-ultimate-beginners-guide-to-fruit-ninja).

SuperCheats describes the timed purple bomb as a 10-point loss that clears fruit
and removes banana effects. Its guide mixes releases and modes; the penalty is
version-specific evidence, not a requirement for this port.
[Source](https://www.supercheats.com/guides/fruit-ninja/bombs).

## Public-client inspection and play limits

The official announcement's embedded YouTube trailer could not be fetched with
the web tool. No reference audio was heard or measured. The official web pages
provide guidance and native-store context, not a playable original client in
this research subtask. No native original was installed or played.

`https://playfruitninja.com/` was reachable. Its page links a minified Construct 2
runtime (`c2runtime.js`, 471,817 characters) and project data (`data.js`, 30,044
characters). Text inspection found score, timer and bomb resources, but also a
share string naming **Sushi Ninja**. No Halfbrick provenance was established, so
this is not evidence of original timings or scoring. None of its code, images,
audio, analytics or advertisements is copied or loaded by the port.

A public [Bada 1.6.1 fan port](https://github.com/mariotaku/FruitNinja) documents
reverse-engineering limitations and requires owned game data. Read-only
inspection of comments in `ComboModifier.cpp`, `BombHit.cpp` and `Fruit.cpp`
supported a separate combo settlement step, bomb aftermath and fruit trajectories.
Its own TODO/DIFFERS notes make it unsuitable as sole proof of exact constants.
No implementation, original data or assets were imported. Exact read URLs are in
SOURCES.md. Fandom's Arcade and Combo pages could not be fetched; alternate
official, cabinet and guide sources were used.

## PartyBox adaptation decisions to preserve the feel

- Keep everyone active for the full 60 seconds. A bomb ends that player's streak,
  as JOBS.md requires; it never eliminates a player or delays the room.
- Give all seats the same seeded fountain opportunities with independent claims.
  A fast phone must not steal fruit from a slower phone. The TV fountain is the
  shared spectacle; each player slices their own copy on the phone.
- Validate actual swipe geometry on the server. A single stationary tap must not
  count as a full-screen slice, and repeating an already cut fruit never scores.
- Preserve a visible choice between a safe single fruit and a risky multi-fruit
  line near a bomb. Three or more in one stroke should be recognizably better.
- Settle each stroke as one action, then show its accepted fruit count, score and
  streak result. A brief trail and a split-fruit result communicate the action.
- Show the clock and eight named meters at TV reading size. Phones keep their
  playfield, score, combo and bomb warning together, including phone-only rooms.
- Use explicit bomb shape/symbol and text, not red alone. Reduced motion keeps
  current fruit positions and score feedback without the flight/trail effects.
- Escalate density and late-round pressure in authored, seeded waves. Optional
  burst fruit and a final dense wave are adaptations; the job does not require
  copying the reference's banana upgrades, random criticals or meta progression.

The delight is the controlled swipe that catches a cluster, the streak everyone
can see rising, a recoverable mistake, and a last-second chance to overtake.
These are design inferences from the reported mechanics. Fruit speed, gravity,
wave duration, collision radius, score scale and streak threshold must be tuned
and verified in the implementation; they were not measured from the original.
