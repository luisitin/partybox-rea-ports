# P24 improvement passes

Initial PR CI passed on `4337c3d`: run `38203229374`, completed 2026-10-12.
Only actual post-green reviews are recorded below. A completed pass requires measured evidence.

| Round | Five biggest weaknesses reviewed                                                                                                                                                                      | Change and measured gain                                                                                                                                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Silent goal feedback; goal credit disappears after at most 2 s; discs can overlap solid goalposts; odd-roster helper parity is unmeasured; eight discs can obscure each other in a crowded goalmouth. | Confirmed goal feedback improved from no stage cue to exactly one SDK cheer for a fresh score rise. 64/64 mounted goal-cue checks and 67/67 control checks pass, including red/blue goals, direct horn/delayed projections and replay protections. 37 focused client/SSR tests pass. TV and phone-only own the cue; with-TV phones stay quiet. |

Original live practice and a human eight-stranger network playtest remain unavailable; these
reviews use the real reducer, public views, mounted components and retained screenshots.
