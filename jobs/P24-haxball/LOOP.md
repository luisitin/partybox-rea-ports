# P24 improvement passes

Initial PR CI passed on `4337c3d`: run `38203229374`, completed 2026-10-12.
Only actual post-green reviews are recorded below. A completed pass requires measured evidence.

| Round | Five biggest weaknesses reviewed                                                                                                                                                                      | Change and measured gain                                                                                                                                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Silent goal feedback; goal credit disappears after at most 2 s; discs can overlap solid goalposts; odd-roster helper parity is unmeasured; eight discs can obscure each other in a crowded goalmouth. | Confirmed goal feedback improved from no stage cue to exactly one SDK cheer for a fresh score rise. 64/64 mounted goal-cue checks and 67/67 control checks pass, including red/blue goals, direct horn/delayed projections and replay protections. 37 focused client/SSR tests pass. TV and phone-only own the cue; with-TV phones stay quiet. |

Round 2: reviewed the short-lived scorer credit, player/post overlap, possible post-crossing
scorer overwrite, unmeasured odd-helper parity and coarse 100 ms movement updates. Retained credit
now stays visible through play/halftime/done; both half caps and the 188,000 ms default duration
stay unchanged. Gain: credit previously disappeared after at most 2 s; now the 64-character
own-goal name remains accessible, with a one-line jersey credit on compact phones. All 46 focused
client/SSR tests, 75 static layouts, 12 mounted retained-credit checks, 67 controls and 64 goal-cue
checks pass. The 704 px phone mount fits; TV jerseys remain at least 34.613 px.

Round 3 (completed): reviewed player/post overlap, late keeper credit overwrite, goals erased
by final-y walls, goals falsely passing a grazed post and odd-helper parity. The first eight new
regressions failed on the old server; post separation and crossing-before-kick fixes pass all
42 rules. Eight further real-step crossing/post regressions also fail on that intermediate
source, proving both lost valid goals and false grazed-post goals. Swept post contacts now
resolve before a later goal while valid rebounds remain. The final full 141-test / 7,000-match
run and refreshed 20/20 mutations pass.

Original live practice and a human eight-stranger network playtest remain unavailable; these
reviews use the real reducer, public views, mounted components and retained screenshots.

Round 4: reviewed unexplained radial aim, halftime arrows that still show the old direction,
spectator copy addressing a player, crowded goalmouth identification and worst-case long
scorer names. Instructions now say to get behind the ball and that kicks send it away from
your disc. Halftime says goals switch when play restarts, matching the actual phase timing.
Gain: two rules fit the 90-character contract at 79/76 characters; phone/TV helper copy is
58/68 characters, shorter than before. All 46 focused client/SSR tests, 75 static layouts,
67 mounted controls, 64 goal-cue checks and 12 retained-credit checks pass. Manual phone/TV
halftime review confirms the restart instruction fits and remains distinct from retained credit.

A subsequent full CI check exposed a two-player sharp-bot corner trap: 333 matches scored
zero goals despite 2,484 accepted kicks. This is a remaining player-visible weakness, not a
zero-gain review; root tracing reproduces a ball stranded in the corner for most of each half.
Bot tactics must recover without changing solid posts or relaxing the positive-goal check.

Round 5 (completed): reviewed unreachable bot corner contacts, a repeated favorable
kickoff route for the same ID, crowded compact jerseys, direct 100 ms pose updates and unmeasured
odd-helper parity. Actual radial contact bounds now permit an outward bank clear; near-contact
movement uses the real ball. Public goals/halftime rotate the existing distinct dribble styles.
Measured gain: eight old corner cases never kicked within 8 s; all now clear. A known two-sharp
fixture changed from 0–0 trapped to 0–24 repeated and then 12–12 after rotation. A real three-kickoff
regression failed with only p2 first kicks and now includes both seats. All 67 rules pass. These
measurements establish recovery and route variation, not human play or competitive win-rate parity.

Round 6: reviewed held-key auto-repeat reviving cancelled inputs, post-departure team imbalance,
release coasting, dense-disc visual overlap and unmeasured mixed-skill coordination. Repeat
key-downs now cannot restart a source cleared by phase/pause/blur; genuine holds still use the
300 ms heartbeat. Measured gain: six revived-input/heartbeat failures across three boundaries
on the old hook became zero failures, with all 88 controls, 64 goal cues and 12 credit checks
passing. All 46 focused client/SSR tests pass; 75 canonical static pages remain byte-identical.
Server source is unchanged from the green 141-test / 7,000-match run. The other reviewed aspects
are documented policy/physics tradeoffs or require real-play evidence for tuning.

Round 7: reviewed captured touches reviving after blur/hidden, neutral-centre drag recovery,
independent-thumb cancellation, compact jersey identification and 100 ms pose updates.
Global cancellation now invalidates the gesture token; an old captured contact cannot register
movement until lifted and pressed again. Measured gain: four replay/heartbeat failures across
blur and hidden transitions become zero, with all 104 mounted controls, 64 goal cues and
12 retained-credit checks passing. All 46 focused client/SSR tests pass. Existing real centre
drags, two-thumb releases and repeat-key regressions remain green. Two intermediate heartbeat
timing failures and the foreground automation rerun are retained honestly in VERIFY.md.
