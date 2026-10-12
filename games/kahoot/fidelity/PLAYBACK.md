# Original playback research

Checked 2026-10-12, r2-local. Research used primary publisher pages, public
HTTP metadata and locally decoded video frames. No browser, headless browser,
live room or participant session was opened. The full personal-device team
question → response chart → scoreboard → podium sequence was not accessible
as playable media in this pass. The accessible clips below supply limited
observations, not a fabricated full playthrough.

## Access attempts

| Primary route                                                                                                                                                        | Actual result                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Official team guide](https://support.kahoot.com/hc/en-us/articles/4408679135891-Team-experience-How-to-play-kahoot-in-groups)                                       | Readable; embeds Vimeo 939495092.                                                                                                                                         |
| [Official team tutorial on Vimeo](https://vimeo.com/939495092)                                                                                                       | Public metadata page readable.                                                                                                                                            |
| [Public Vimeo oEmbed](https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F939495092)                                                                     | Desktop HTTP 200: KahootContentPro, title “How to host kahoot with team experience”, metadata duration 209 seconds. This is video duration, not a game-phase measurement. |
| Vimeo player, bare and normal `app_id=122963` / `dnt=1` embeds                                                                                                       | Desktop HTTP 401. Web extraction of the official dnt embed supplied no playable frames.                                                                                   |
| Vimeo public player config endpoint                                                                                                                                  | HTTP 403. No playback or soundtrack was inspected there.                                                                                                                  |
| [Official 2017 team tutorial article](https://kahoot.com/blog/2017/02/15/launch-game-kahoot-team-mode/)                                                              | Readable; its YouTube embed is PwsJ_sRGudU. Watch-page HTTP 200 explicitly reports private video / LOGIN_REQUIRED.                                                        |
| [Official 2019 play guide](https://kahoot.com/blog/2019/03/04/how-to-get-started-with-kahoot/) and [schools tutorial page](https://kahoot.com/schools/how-it-works/) | Readable; both identify rZUew1wIQts as the play tutorial. Its watch page reports private video / LOGIN_REQUIRED; public oEmbed returns 403.                               |
| Schools remote-hosting tutorial yCakppkF_kA                                                                                                                          | Watch-page HTTP 200 reports private video / LOGIN_REQUIRED.                                                                                                               |
| Official YouTube channel / guide playlist and privacy-enhanced embeds                                                                                                | Text-only extraction supplied no playable stream or transition frames.                                                                                                    |
| Wayback page / CDX lookup for the official Vimeo and YouTube tutorials                                                                                               | Web route unavailable; desktop CDX request timed out.                                                                                                                     |
| [Internet Archive public identifier search](https://archive.org/advancedsearch.php?q=6QsjJPENK78&output=json) for the legacy official play tutorial                  | HTTP 200, zero matching archive records.                                                                                                                                  |
| Official public WordPress media index                                                                                                                                | Accessible. Searches for team/play/quiz located the direct publisher assets inspected below. Host/podium searches returned no matching video entries.                     |

The failures did not stop implementation. No authentication restriction was
circumvented, no private tutorial was represented as viewed, and no third-party
reimplementation was substituted for original playback.

## Accessible publisher clips

[Schools page](https://kahoot.com/schools/how-it-works/) directly embeds
[the school testimonial MP4](https://kahoot.com/files/2020/03/30SEC-video-schools-2-mp4.mp4).
Its decoded stream is 524×294, 30.069144 seconds, with no audio stream.
Thirty one-second samples across the clip were inspected. Around the 12-second
seek point, a participant phone shows a green “Heads up!” notice; later shots
show people looking toward a shared classroom display. This edited testimonial
contains no readable response chart, scoreboard or podium. Scene cuts and
title graphics cannot measure the game's countdown or transition durations.

The [official team-video media record](https://kahoot.com/wp-json/wp/v2/media/128522)
provides [a September 2026 board demonstration](https://kahoot.com/files/2026/09/Frame-1171275830.webm).
Its stream is 562×354, 22.033 seconds, with no audio stream. Inspected samples
show a numbered question-selection board, an image question with four colored
shape answers, then a green correct-result card and confetti. Exact seeks at
8 seconds and 9.5 seconds preserve the question and result below. This is a
board-selection experience, not proof of the personal-device team tutorial's
flow. It has no inspected response-count chart or podium. Its demonstration
loop does not establish native answer, scoring or animation durations.

Another official quiz-hero media record was found, but its download stalled
before any complete file was obtained; the research child was interrupted.
No observations from that file are claimed. Full publisher videos stay in an
isolated OS temporary folder; only the three documentation reference frames
below are retained in this job. None is a runtime asset.

## Retained reference frames

Frames retain the source dimensions without cropping or rescaling. Seek times
identify positions in the publisher clip; the decoder selects the next source
frame. They are not game-event timestamps or inferred native phase lengths.

| File                                                             | Clip seek | Dimensions | Scope                                                             |
| ---------------------------------------------------------------- | --------- | ---------- | ----------------------------------------------------------------- |
| [Phone notice](original/playback-school-phone-12s.png)           | 12 s      | 524×294    | Testimonial phone notice; no phase-transition coverage.           |
| [Board question](original/playback-board-question-8s.png)        | 8 s       | 562×354    | Different board-selection experience; four visible shape choices. |
| [Board correct result](original/playback-board-correct-9_5s.png) | 9.5 s     | 562×354    | Green result card/confetti in that board demonstration.           |

Source URLs, dimensions, seek times and SHA-256 hashes for both clips and all
three PNGs are in PLAYBACK_REFERENCES.json. Reference screenshots include
publisher artwork solely for research documentation; they must not be imported
by game code or copied into production artwork.

## What remains unmeasured

No soundtrack was heard: both downloaded clips have zero audio streams and
the full tutorial media was unavailable. No BPM, timer-music ramp, reveal cut,
result sting, scoreboard swoosh or podium fanfare is claimed from listening.
The [official remote-hosting guide](https://kahoot.com/blog/2021/12/09/how-to-host-kahoot-remotely/)
documents music during the timer countdown, but that text is documentary
support, not an inspected audio sample.

The current official team guide documents five-second shared-device talk and
5–20-second custom-team talk. These are published setting values, not measured
playback timings. Question/reveal/scoreboard/podium hold lengths, ranking-motion
easing and the exact original response-chart transition remain unmeasured.

The inspected clips do not show the standard response-count chart, so they
cannot establish whether ClassicChart's horizontal rows match the original.
Any graph comparison must cite another actually inspected original state;
the board's green correct card must not be treated as the classic reveal chart.

## Additional inspected static answer-results reference

On October 12, the [official hosting-tips article](https://support.kahoot.com/hc/en-us/articles/360039900153-Tips-for-hosting-a-live-game) supplied an accessible [answer-results attachment](https://support.kahoot.com/hc/article_attachments/38926500115219). The complete [2876×1576 PNG](original/official-answer-results.png) was inspected: the prompt remains above vertical count bars, with four labeled choices below. Shapes and correctness marks accompany the bars. No explanation paragraph is visible. This supplies static chart geometry, not team-specific playback or transition timing.

The [older support-post screenshot](https://support.kahoot.com/hc/user_images/01HQRDBH4Z8C9Y5K32H5XTCZVA.png) returned HTTP 403 and was not inspected. This research opened no browser or live session. The accessible asset's SHA256 and attribution are in REFERENCES.md.
