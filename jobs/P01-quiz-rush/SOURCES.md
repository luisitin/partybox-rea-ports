# P01 sources and asset provenance

The 2026-10-12 owner-required upgrade reuses owner-authorized PartyBox Lightning Round code and attributed legacy libraries. See core-base/SOURCE.json, core-base/CHANGE_NOTES.md, core-base/HOST_MIGRATION.md, games/kahoot/content/SOURCES.md and reports/content/lightning-round-sources.md for pinned provenance/licences. All 12 inherited art files and the licensed file-music track are excluded; existing authored inline SVG/CSS and P01 shapes form the public visuals. The following research/asset notes describe the original standalone P01, whose 60 newly authored questions are retained for classic mode. No Kahoot publisher code or assets are copied.

All sources accessed 2026-10-11. Links are research inputs only; the shipped game makes no
network requests. No publisher questions, screenshots, logos, music, code or assets were copied from these research sources.

## Publisher primary sources

- **K1** [How to host a live kahoot](https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot), updated 2026-09-22. Host lobby/PIN, start, optional device questions and resume-with-score behavior.
- **K2** [How to join a Kahoot game](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game), updated 2026-10-07. PIN/link/QR and nickname flow; optional security requirements are outside this port.
- **K3** [Kahoot Academy guide, March 2016](https://files.getkahoot.com/academy/Kahoot_Academy_Guide_1st_Ed_-_March_2016.pdf). Historical classic shape-pad screenshots.
- **K4** [Kahoot Q1 2021 company presentation](https://kahoot.com/files/2021/04/Q1-2021-Kahoot-Trading-Update.pdf). Historical host answer-count bars and explicit correct-choice mark.
- **K5** [Live-event playbook](https://support.kahoot.com/hc/en-us/articles/42383149107091--Playbook-Use-Kahoot-for-events-that-combine-testing-the-knowledge-of-your-audience-and-allowing-your-audience-to-provide-feedback-and-share-their-opinions-during-the-event), updated 2026-09-17. Classic per-question scoreboard/final top three, autoplay and contrast/device-question options.
- **K6** [How points work](https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work), updated 2026-09-30. Standard speed formula, rounding, 1,000-point maximum, sub-0.5-second exception and no present-day streak points.
- **K7** [Answer streak bonus removal announcement](https://support.kahoot.com/hc/en-us/community/posts/360033686653-Disable-Answer-Streak-Bonus), official comment dated 2020-07-31. Distinguishes streak feedback from removed bonus points and explains the catch-up problem.
- **K8** [Silver course study guide, November 2019](https://kahoot.com/files/2019/11/Kahoot-Certified-for-schools-Silver-course-studyguide.pdf). Historical capped consecutive-answer bonus, automatic advancement and medal podium.
- **K9** [Hybrid learning guide, June 2021](https://kahoot.com/files/2021/06/HybridLearningGuide_0621.pdf), p. 3. Countdown music and remote-session sound handling.
- **K10** [Question types](https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types), updated 2026-10-07. Quiz time range and configurable question/answer limits.
- **K11** [Correct answers at the end of answering time](https://support.kahoot.com/hc/en-us/community/posts/26708301497491-showing-the-correct-answer-at-the-end-of-the-answering-time), help response dated 2024-02-28. Graph and correct-answer reveal after all submissions or timer expiry.

## Independent direct observations and original research

- **I1** [Portland Community College: How does Kahoot work?](https://www.pcc.edu/instructional-support/tools/kahoot/how-does-kahoot-work/). Institution's own instructor/player instructions, confirming PIN-based live play with participant devices.
- **I2** [AAPT chapter: Guide to Kahoot, Spring 2021](https://csaapt.org/uploads/Spring2021/Guide%20to%20Kahoot.pdf), pp. 1, 14-17. Independent first-hand screenshots of shared question, phone pad/verdict, host count chart, scoreboard and podium; collection closes on all answers or timeout.
- **I3** [InfoEducacion illustrated walkthrough, archived by Universidad de Montemorelos](https://e42.um.edu.mx/sec/showfile.aspx?idCont=323935), pp. 9-12. Independent author screenshots of names in lobby, the count chart, ranking and final podium; the university is the archive host, not the original author.
- **I4** [Evaluating classroom response systems in engineering education: Which metrics better reflect student performance?](https://link.springer.com/article/10.1007/s10639-024-13048-5), Education and Information Technologies, 2024, §2.2.1 and §3.1. Original empirical study corroborating the 500-1,000 speed range and reporting observed classroom response-score data.
- **I5** [kahoot.js: live question points data](https://kahoot.js.org/enum/LiveEventQuestionPointsData). Independent archival protocol documentation. The search index records the note that bonuses were disabled; direct reading now returns a JavaScript documentation shell, and its [repository](https://github.com/theusaf/kahoot-api-docs) was archived in 2021. Corroborates the historical removal, not current live behavior; no client code copied.
- **I6** [Wang and Lieberoth, 2016: effect of points and audio](https://folk.idi.ntnu.no/alfw/publications/ECGBL2016-Effect_of_points_and_audio_in_Kahoot.pdf). Original 593-participant experiment; informs treating sound as a shared social beat, not decorative audio. The first author is associated with Kahoot's origin, so this is separate academic evidence, not a wholly unaffiliated assessment.

The paired evidence matrix and limits are in [RESEARCH.md](RESEARCH.md). Historical sources
explain the classic experience; current official help takes priority when the product has changed.
Original interactive play was unavailable; source screenshots do not constitute live-play timing measurements.

## Port materials

- Quiz prompts, distractors and explanations: newly written for this port; no source question bank imported.
- Each of the sixty question IDs has paired fact references in [CONTENT_SOURCES.md](CONTENT_SOURCES.md), including ambiguity decisions and original-content validation notes.
- Shapes and chart/podium styling: original HTML/CSS/SVG using PartyBox design tokens and primitives.
- Sounds: existing PartyBox SDK cues/music plan; no original game's audio is included.
- Captured HTML/PNG: only this port's generated screens; their hashes belong in `SHA256SUMS.txt`.
- No new runtime art/font/music dependency is added. Port code and original content follow the repository MIT licence.
- Capture-only font: the pinned PartyBox host uses Fontsource Nunito Variable 5.3.0. Its existing `nunito-latin-wght-normal.woff2` (39,128 bytes) is included beside the standalone HTML under the SIL Open Font License 1.1; the full licence is `media/NUNITO-LICENSE.txt`. This is the host's open font, independent of Kahoot! materials. Capture loads those same local bytes and records the SHA256; no network request is needed.
- Shared capture CSS: `media/evidence.css` is generated by `games/kahoot/__tests__/upgrade-evidence.ts` from the game/public-SDK CSS modules with their actual emitted selectors, plus the authored host reset/playing/results shell. `media/tokens.css` copies `design/tokens.css`. These are repository/owner-authorized styles, independent of Kahoot! assets. One local compact bundle replaces repeated HTML styles; `media/evidence-source.json` and SHA256 sums record provenance/bytes.
- Caption/reset fidelity: the current capture shell includes the exact `packages/client/src/styles/global.css:99–105` `.pb-muted`/`.pb-caption` rules from the pinned owner core. Those rules join the authored playing/results shell in `media/evidence.css`; they add no publisher asset or dependency. Round-4 old-PNG byte identity predates this correction and does not establish identity of the round-5 recapture. Current source and media hashes record the corrected bytes.
- Final asset audit: source `1659b6e` has 239 hashed media files, 8,712,209 B, below decimal 10 MB. The 95 current captures pass; one labelled Finale before baseline is retained separately. `SHA256SUMS.txt` and verification/source records cover the CSS/font/token bytes. PR #2 is ready for owner review; the separately documented owner-core migration is an unapplied handoff.
