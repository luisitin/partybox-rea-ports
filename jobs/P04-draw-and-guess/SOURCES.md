# P04 sources and asset provenance

All sources accessed 2026-10-11. Product names appear here solely to identify the
research subject; the delivered game is **Draw and Guess**.

| Source                                                                                                                               | Ownership / independence                                                  | Used for                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [Official skribbl home/how-to](https://skribbl.io/)                                                                                  | Original developer, primary                                               | Rotating drawing/guessing, secret prompt choice, scoring objective, no spelling, configurable choices/hints, mobile toolbar support.   |
| [Public skribbl browser client](https://skribbl.io/js/game.js)                                                                       | Same publisher as the home page; not independent corroboration            | Read-only inspection of phase presentation, masks, reveal messages and audio-event names. No code or assets copied.                    |
| [ADRA-UK fundraising handbook, 2022, p.23](https://adra.org.uk/wp-content/uploads/2023/07/ADRA-Appeal-Fundraising-Handbook-2022.pdf) | Independent firsthand group-activity instructions                         | Private room, duration/round settings, three offered words, live shared sketch and text guesses. Historic player caps are not adopted. |
| [Official Gartic landing page](https://gartic.io/)                                                                                   | Original developer, primary                                               | Language, nickname, room entry, custom themes and product scope.                                                                       |
| [Gartic developer's Google Play description](https://play.google.com/store/apps/details?id=io.gartic.Gartic&hl=en_CA)                | Original developer, primary; same publisher as Gartic home page           | One drawer per turn, word choice, themes/private room and point-goal victory.                                                          |
| [Snokido Gartic play instructions](https://www.snokido.com/game/garticio)                                                            | Independent playable-game host/instructions                               | Text guessing, no letters, touchscreen drawing, points-goal winner; reported two choices and 60-second draw window.                    |
| [uCrazyGames Gartic instructions](https://www.ucrazygames.com/game/garticio)                                                         | Independent playable-game host/instructions                               | Prompt choice and letter-hint button; reported two choices.                                                                            |
| [Skribbl community timer page](https://skribbl-io.fandom.com/wiki/Timer)                                                             | Independent community documentation; secondary and potentially historical | Letter hints and reported 80-second drawing / 15-second choice defaults. Exact schedules are not adopted as verified current facts.    |

The research table uses independent publishers. Two pages from one developer
count as one source, not two. Where sources disagree or only one describes an
exact number, RESEARCH.md labels the detail as uncertain and the port specifies
its own tuning.

## Delivered content and assets

- The 300-word JSON deck and its alias selection were authored for this job from
  ordinary English vocabulary, not extracted from any original game.
- Runtime strokes, symbols and interface composition are original code and use
  PartyBox's existing design tokens. No third-party visual assets are required.
- Sounds are the existing PartyBox SDK/shell cues. No original-game audio files,
  music, fonts, logos, screenshots or branded art are delivered.
- Public-client inspection was read-only and in memory. No client file is in the
  repo. The inspected UTF-8 client hash is recorded in RESEARCH.md.
- No new runtime dependency, external request, analytics or tracking is needed.
