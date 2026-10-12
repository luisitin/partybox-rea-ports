# P03 — Sources and provenance

Inspected 2026-10-11. Mechanics are summarized; no vendor code, screenshots, logos, sounds,
question text, fonts or other assets are redistributed.

| ID  | Source                                                                                                                                                                                | Provenance / supported observations                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | [Wayground: Live Session Modes](https://help.wayground.com/support/solutions/articles/158000404918-live-session-modes-on-wayground)                                                   | Vendor primary documentation, updated 2025-11-08: student-paced progression and a live Classic leaderboard.                                                                                                            |
| W2  | [Wayground: Power-Ups & Their Types](https://help.wayground.com/support/solutions/articles/158000404941-power-ups-their-types)                                                        | Vendor primary documentation, updated 2025-12-08: selectable abilities affect competitive scores; Time Freeze affects the answering timer.                                                                             |
| W3  | [Wayground: Navigate Session Settings](https://help.wayground.com/support/solutions/articles/158000404930-navigate-session-settings)                                                  | Vendor primary documentation, updated 2026-02-03: timer variants, instant-feedback options, shuffling, music and leaderboard settings.                                                                                 |
| Q1  | [Mohamad, Wahi & Ramachandran: Quizizz as an Alternative Assessment Tool](https://rsisinternational.org/journals/ijriss/articles/quizizz-as-an-alternative-assessment-tool-a-survey/) | Independent primary intervention report, published 2025-04-30: own-device questions and an instructor screen showing answers/progress/completion. No efficacy claims are used by this port.                            |
| Q2  | [Leona: Quizizz Multimedia App Individual Evaluation](https://leonaslearningjourney.opened.ca/2020/06/16/quizizz-multimedia-app-individual-evaluation/)                               | Independent firsthand teacher/student-perspective evaluation and screencast, 2020-06-16: own-device choices, independent pace, personal feedback, score and abilities. Historical corroboration.                       |
| B1  | [Blooket: Game Mode Previews](https://help.blooket.com/hc/en-us/articles/31616660563479-Blooket-Game-Mode-Previews)                                                                   | Vendor primary current documentation: Gold Quest uses self-paced frequent prompts, chests, gold and taking gold from others.                                                                                           |
| B2  | [Tadashi Sakuma: Introduction & Gold Quest](https://note.com/oshinobisan/n/n6012dd2edbe4?hl=en)                                                                                       | Independent teacher's own classroom account and embedded recordings, 2023-08-14: correct answer → three-chest selection; wrong-answer delay; common session start/end. Historical, not a present-day timing guarantee. |
| B3  | [Charlie's Lessons: Gold Quest Teacher Tutorial](https://charlieslessons.com/blooket-gold-quest/)                                                                                     | Independent teacher's own tutorial, 2023-08-19 / updated 2024-01-22: three-chest choice, gold rewards/stealing, time or money goal, and watching the host screen. Historical corroboration.                            |
| L1  | [Wayground public join](https://wayground.com/join) / [Quizizz public join](https://quizizz.com/join)                                                                                 | Live public HTTP responses both 200; same module URL. Join client read transiently as research only.                                                                                                                   |
| L2  | [Blooket public join](https://play.blooket.com/play) / [Gold Quest entry](https://gold.blooket.com/)                                                                                  | Public entry inspected; Game ID required. Direct HTTP fetch returned 403; web inspection of the Gold Quest entry yielded a game-not-found surface.                                                                     |

Public client inspected, not retained:
`https://cf.quizizz.com/app-bundle/join/upload/js/index.bYHBXto_.js`
(HTTP 200, 802,527 bytes at inspection). Its join/question/leaderboard/power-up routing corroborates
the public product's surface; vendor artifacts are not counted as independent authors.

Independent-source pairs are W1 + Q1/Q2 for the Quizizz phone/host loop, W2/W3 + Q2 for personal
feedback/abilities, and B1 + B2/B3 for Gold Quest's self-paced rewards and social standings.
B2 + B3 independently establish historical three-chest selection. Exact current chest odds,
timing constants and music were not established and are not asserted.

## Port assets and content

The port's question wording, styles and inline art are authored for PartyBox. SDK primitives,
tokens and synthesized sound cues use the repository's existing licence. There are no third-party
asset downloads, external fonts, audio files, tracking or runtime product requests.
The official Quizizz name follows the owner's 10-11 JOBS.md instruction; no logo or vendor art is used.
