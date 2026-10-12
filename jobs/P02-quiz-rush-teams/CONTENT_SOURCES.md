# P02 content sources

Researched 2026-10-12. These 40 questions, distractors, and explanations are
original writing about family-friendly facts. No source quiz questions,
illustrations, sounds, lyrics, or other assets are included. Each fact below
has two independently published references; links are research-only and are
never fetched by the game. Formats are qualified where rules differ.

The sports and music packs each contain 20 English questions: 7 easy, 7 medium,
6 hard. All questions use the existing P01 pack shape, with four distinct
options. `team-knowledge.json` is a separately authored ID-to-answer-text map;
bot integration must match those words against the shuffled choices, without
reading a shuffled correct index. P01's existing content and source ledger
remain at [the P01 job](../P01-quiz-rush/).

## Sports

| ID        | Correct fact                                       | First reference                                      | Independent reference                                          |
| --------- | -------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| sports-01 | Regular half: 45 minutes                           | [IFAB Law 7][if7], periods of play                   | [Axios][soccer-guide], match length                            |
| sports-02 | Yellow communicates a caution                      | [IFAB Law 12][if12], disciplinary action             | [Sporting News][cards], yellow cards                           |
| sports-03 | Red communicates a sending-off                     | [IFAB Law 12][if12], disciplinary action             | [Sporting News][cards], red cards                              |
| sports-04 | Penalty mark: 12 yards                             | [IFAB Law 1][if1], penalty area                      | [1911 Britannica][football-history], association-football laws |
| sports-05 | Made free throw: one point                         | [NBA Rule 5][nba5], scoring I.6                      | [University of Georgia][uga], scoring                          |
| sports-06 | Basket inside the arc: two points                  | [NBA Rule 5][nba5], scoring I.2                      | [University of Georgia][uga], scoring                          |
| sports-07 | Basket beyond the arc: three points                | [NBA Rule 5][nba5], scoring I.3                      | [University of Georgia][uga], scoring                          |
| sports-08 | Three-pointer plus free throw: four points         | [NBA Rule 5][nba5], I.3 and I.6; addition            | [University of Georgia][uga], four-point-play example          |
| sports-09 | Love means zero                                    | [ITF glossary][itf], scoring                         | [USTA guide][usta], point system                               |
| sports-10 | 40-40 is deuce                                     | [ITF glossary][itf], both sides at three points      | [USTA guide][usta], deuce                                      |
| sports-11 | The score after 30 is 40                           | [ITF glossary][itf], point sequence                  | [USTA guide][usta], point system                               |
| sports-12 | Winning a point at deuce gives advantage           | [ITF glossary][itf], advantage                       | [USTA guide][usta], deuce; standard advantage format           |
| sports-13 | Walk: four balls                                   | [MLB walk definition][walk]                          | [Baseball Canada coaching manual][canada-coach], PDF page 158  |
| sports-14 | Strikeout: third strike                            | [MLB strikeout definition][strikeout]                | [Baseball Canada coaching manual][canada-coach], PDF page 158  |
| sports-15 | Three outs end a normal half-inning                | [MLB out definition][out]                            | [Baseball Reference][br-out], definition                       |
| sports-16 | Grand slam: four runs                              | [MLB grand-slam definition][slam]                    | [Baseball Reference][br-slam], definition                      |
| sports-17 | Beach doubles: two players per team                | [FIVB beach guide][beach], introduction              | [USA Volleyball][usav], beach formats                          |
| sports-18 | International indoor fifth-set target: 15          | [FIVB rules][fivb], 6.3.2, PDF page 25               | [USA Volleyball][usav], scoring FAQ                            |
| sports-19 | Indoor team: up to three hits besides blocking     | [FIVB rules][fivb], 9.1, PDF page 30                 | [USA Volleyball][usav], three-contact basics                   |
| sports-20 | Gaining the indoor serve rotates players clockwise | [FIVB rules][fivb], game characteristics, PDF page 9 | [USA Volleyball][usav], basics and 6-vs-6                      |

## Music

| ID       | Correct fact                                  | First reference                                            | Independent reference                                                      |
| -------- | --------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| music-01 | Standard full-size piano: 88 keys             | [Yamaha piano strings][piano]                              | [MusicRadar keyboard guide][piano-guide]                                   |
| music-02 | Standard violin: four strings                 | [Yamaha violin strings][violin]                            | [Philharmonia violin][phil-violin], range                                  |
| music-03 | Standard acoustic guitar: six strings         | [Yamaha acoustic guitar][guitar]                           | [Fender string guide][fender]                                              |
| music-04 | Trombone slide changes pitch                  | [Yamaha trombone][trombone], smooth pitch changes          | [Philharmonia trombone][phil-trombone], construction                       |
| music-05 | Standard trumpet: three valves                | [Dallas Symphony trumpet][trumpet]                         | [Associated Press][trumpet-report], comparison with a one-valve instrument |
| music-06 | Clarinet: single reed                         | [Yamaha clarinet][clarinet], mouthpiece                    | [Dallas Symphony clarinet][dso-clarinet]                                   |
| music-07 | Oboe: double reed                             | [Yamaha oboe][oboe]                                        | [Dallas Symphony oboe][dso-oboe]                                           |
| music-08 | Flute: woodwind family                        | [Yamaha instrument guide][yamaha-guide], woodwinds         | [Philharmonia flute][phil-flute], introduction                             |
| music-09 | Standard staff: five lines                    | [musictheory.net][staff], staff                            | [SUNY textbook][pitch], 5.4                                                |
| music-10 | Treble clef is the G clef                     | [musictheory.net][staff], treble clef                      | [SUNY textbook][pitch], 5.4                                                |
| music-11 | Bass clef is the F clef                       | [musictheory.net][staff], bass clef                        | [SUNY textbook][pitch], 5.4                                                |
| music-12 | Sharp raises a pitch one half step            | [musictheory.net][accidentals], sharp                      | [University of Puget Sound][puget-accidentals], 1.4                        |
| music-13 | Flat lowers a pitch one half step             | [musictheory.net][accidentals], flat                       | [University of Puget Sound][puget-accidentals], 1.4                        |
| music-14 | Natural cancels a sharp or flat               | [musictheory.net][accidentals], natural                    | [University of Puget Sound][puget-accidentals], 1.4                        |
| music-15 | Whole-note duration equals four quarters      | [musictheory.net][duration], two halves, each two quarters | [SUNY textbook][rhythm], 1.4; same 2-by-2 duration ratios                  |
| music-16 | Half-note duration equals two quarters        | [musictheory.net][duration], half and quarter notes        | [SUNY textbook][rhythm], 1.4                                               |
| music-17 | Rest indicates silence in that part           | [musictheory.net][rests], rest definition                  | [SUNY textbook][rhythm], 1.5                                               |
| music-18 | One duration dot adds half the original value | [SUNY textbook][rhythm], 1.6                               | [University of Puget Sound][puget-ties], 4.3                               |
| music-19 | Tie combines durations at the same pitch      | [SUNY textbook][rhythm], 1.6, distinction from slur        | [University of Puget Sound][puget-ties], 4.3                               |
| music-20 | Standard violin's highest string: E           | [Yamaha violin strings][violin], high-to-low E-A-D-G       | [Philharmonia violin][phil-violin], G3-D4-A4-E5 tuning                     |

## Access and scope notes

- The reference text was read before writing the packs. IFAB, NBA, UGA,
  FIVB/USA Volleyball, Baseball Canada, Yamaha, Philharmonia, Dallas Symphony,
  and the university textbook pages supplied readable text or PDF extraction.
  Other listed pages supplied supporting indexed text through web search.
- musictheory.net's dynamic lesson pages generally opened as an empty shell;
  the site's indexed printed lesson text supplied the staff, duration, rest,
  and accidental facts. Baseball Reference direct opens sometimes failed,
  while the referenced Out and Grand Slam entries were available as indexed
  text. Neither failure is presented as a successful interactive visit.
- Current Britannica articles failed to open, and BBC blocked access. The
  public-domain 1911 Britannica entry is used only as a historical independent
  check of the 12-yard penalty mark; current IFAB Law 1 confirms that distance.
  No other historical rules are treated as current rules.
- The pitches and durations use conventional Western notation. Instrument
  counts explicitly refer to standard instruments; variants are not denied.
  Tennis uses advantage scoring, and basketball uses the five-on-five format.
  Baseball strikeout wording avoids claiming every third strike automatically
  puts the batter out, since an uncaught third strike can allow a baserunner.
- Source verification is a content check. Automated schema checks, reading
  budgets, formatting, integration, and browser evidence belong to the main
  runner and are not claimed here.

[if7]: https://www.theifab.com/laws/latest/the-duration-of-the-match/
[if12]: https://theifab.com/laws/latest/fouls-and-misconduct/
[if1]: https://theifab.com/laws/latest/the-field-of-play/
[soccer-guide]: https://www.axios.com/2026/06/09/what-to-know-about-soccer-rules-for-the-world-cup
[cards]: https://www.sportingnews.com/in/football/news/yellow-card-red-card-meanings-explained/4909a1542e9e049c26163758
[football-history]: https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Football
[nba5]: https://official.nba.com/rule-no-5-scoring-and-timing/
[uga]: https://open.online.uga.edu/basketball/chapter/1-basketball-rules-and-scoring/
[itf]: https://www.itftennis.com/en/about-us/organisation/tennis-glossary/
[usta]: https://www.usta.com/en/home/improve/tips-and-instruction/national/tennis-scoring-rules.html
[walk]: https://www.mlb.com/glossary/standard-stats/walk
[strikeout]: https://www.mlb.com/glossary/standard-stats/strikeout
[out]: https://www.mlb.com/glossary/standard-stats/out
[slam]: https://www.mlb.com/glossary/standard-stats/grand-slam
[canada-coach]: https://baseball.ca/uploads/files/RallyCap-CoachesManual-v04.pdf
[br-out]: https://www.baseball-reference.com/bullpen/Out
[br-slam]: https://www.baseball-reference.com/glossary/grand-slam/
[beach]: https://www.fivb.com/beach-volleyball/the-game/basic-rules/
[fivb]: https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf
[usav]: https://usavolleyball.org/play/rules-of-volleyball/
[piano]: https://www.yamaha.com/en/musical_instrument_guide/piano/mechanism/mechanism004.html
[piano-guide]: https://www.musicradar.com/music-tech/keyboards-pianos/how-many-keys-are-there-on-a-piano-and-why-are-some-keyboards-bigger-than-others-heres-everything-you-need-to-know-about-keyboard-sizes-but-were-afraid-to-ask
[violin]: https://www.yamaha.com/en/musical_instrument_guide/violin/mechanism/mechanism002.html
[phil-violin]: https://philharmonia.co.uk/resources/instruments/violin/
[guitar]: https://uk.yamaha.com/en/musical-instruments/guitars-basses-amps/explore/musical-instrument-guide/acoustic-guitar/structure002.html
[fender]: https://www.fender.com/articles/techniques/never-forget-string-names-again
[trombone]: https://www.yamaha.com/en/musical_instrument_guide/trombone/mechanism/mechanism002.html
[phil-trombone]: https://philharmonia.co.uk/resources/instruments/trombone/
[trumpet]: https://www.dallassymphony.org/community-education/dso-kids/listen-watch/instruments/trumpet/
[trumpet-report]: https://apnews.com/article/8a3f1eddb9b1f9f1f3ba95d6471e3664
[clarinet]: https://www.yamaha.com/en/musical_instrument_guide/clarinet/mechanism/mechanism004.html
[dso-clarinet]: https://www.dallassymphony.org/community-education/dso-kids/listen-watch/instruments/clarinet/
[oboe]: https://www.yamaha.com/en/musical_instrument_guide/oboe/mechanism/mechanism002.html
[dso-oboe]: https://www.dallassymphony.org/community-education/dso-kids/listen-watch/instruments/oboe/
[yamaha-guide]: https://www.yamaha.com/en/musical_instrument_guide/
[phil-flute]: https://philharmonia.co.uk/resources/instruments/flute/
[staff]: https://www.musictheory.net/lessons/10
[pitch]: https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/5-pitch/
[accidentals]: https://www.musictheory.net/lessons/20
[puget-accidentals]: https://musictheory.pugetsound.edu/mt21c/Accidentals.html
[duration]: https://www.musictheory.net/lessons/11
[rests]: https://www.musictheory.net/lessons/13
[rhythm]: https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/1-introduction-to-rhythm-and-meter-2/
[puget-ties]: https://musictheory.pugetsound.edu/mt21c/DotsAndTies.html
