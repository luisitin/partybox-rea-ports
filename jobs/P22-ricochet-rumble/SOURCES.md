# P22 sources

Accessed 2026-10-11 by r1-local. Sources are read as evidence only; no original code, art,
audio, fonts or questions are copied into Ricochet Rumble.

| ID  | Primary source                                                                                                              | What was checked                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | [Original product](https://tanktrouble.com/)                                                                                | Public HTML returned 200; release label `RELEASE-2026-10-09-01`, with a current game bundle.                                                                                                                                                          |
| O2  | [Original public client bundle](https://tanktrouble.com/build/js/index-4YALVKHK.js)                                         | Read in memory, 1,954,941 characters; ammunition/lifetime constants, weapon enums, countdown/round constants, and self-kill handling. No bundle is committed.                                                                                         |
| I1  | [Aman Pasricha implementation README](https://github.com/amanpasricha/Tank-Trouble/blob/master/README.md)                   | Independent author description: generated mazes, steering/reverse/fire, five active shells, ten-second expiry, wall ricochets and any-tank damage. Repository description specifies last-survivor rounds.                                             |
| I2  | [Ethan Baker implementation README](https://github.com/ethanbaker/tank-trouble/blob/main/README.md)                         | Independent author: map regeneration at zero/one survivors, one point for the lone survivor, five-shell limit, a 200 ms firing gap and collectible weapon changes. Its roadmap lists incomplete powerups.                                             |
| I3  | [Paul Sinclair and collaborators' implementation README](https://github.com/pbsinclair42/TankTrouble/blob/master/README.md) | Independent 2014 remake: ricochets, self-harm, forward/reverse/turn controls and five shells. Its fifteen-second expiry differs from O2/I1; it is not evidence for a ten-second original lifetime. Corner tunnelling is a documented defect to avoid. |
| I4  | [BANANAPEEL202 implementation README](https://github.com/BANANAPEEL202/Tank-Trouble/blob/main/README.md)                    | Independent author: random arenas, machine gun, shotgun, laser, homing missile, beam and fragmentation weapons; weapon behaviors and sound-effect feature. These describe that remake, not a complete current-original inventory.                     |
| I5  | [Same author's bullet source](https://github.com/BANANAPEEL202/Tank-Trouble/blob/main/Bullet.pde)                           | Separate firing/bounce audio hooks and velocity/lifetime data. Its commented collision helper is not treated as executed physics evidence. No code or sound file is reused.                                                                           |

## Paired gameplay evidence

- Generated maze, steering/reverse/fire and ricochets: I1 + I3; map variation also I2 + I4.
- Five active default shells: O2 + I1, independently supported by I2/I3.
- Ten-second default shell lifetime: O2 + I1; I3 demonstrates that remakes vary.
- A returning shell can destroy its owner: O2's killer/victim handling + I3's explicit warning;
  I1 additionally describes destruction of any tank hit.
- Last-survivor round and fresh map after it: I1's repository description + I2's round section.
- Collectible weapon variety: O2 + I4; I2 corroborates pickup/change flow, with incomplete weapons.
- Rapid-fire, spread and fast beam families: O2 weapon data + I4's behavior descriptions.

Exact original countdown, crate cadence, finishing delay, storm timing, audio timbre and measured
human round length lack a second independent observation. They remain unmeasured in ASSUMPTIONS.md.
