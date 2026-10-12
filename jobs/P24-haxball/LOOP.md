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

Round 3 (in progress): reviewed player/post overlap, late keeper credit overwrite, goals erased
by final-y walls, goals falsely passing a grazed post and odd-helper parity. The first eight new
regressions failed on the old server; post separation and crossing-before-kick fixes pass all
42 rules. Eight further real-step crossing/post regressions also fail on that intermediate
source, proving both lost valid goals and false grazed-post goals. Resolve swept post contacts
before a later goal, and allow valid rebounds; final full scope and mutation checks remain.

Original live practice and a human eight-stranger network playtest remain unavailable; these
reviews use the real reducer, public views, mounted components and retained screenshots.
