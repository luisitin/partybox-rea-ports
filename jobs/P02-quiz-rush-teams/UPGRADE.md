# Existing Lightning Round upgrade

The owner's overlap rule makes P01/P02 an upgrade under the existing Lightning Round card. The public workshop uses the required official Kahoot! name/id. No owner checkout file, core registry or deployed host is changed by this job.

## Canonical public baseline

P01 public head 4043226 imports the existing Lightning Round engine and publishes additive Classic mode, authored packs, stamped answers and staged podium. Its provenance is recorded in jobs/P01-quiz-rush/core-base/. P02 integrates directly into that module. The earlier generic injected-base adapter and retired standalone engine are removed from current production source; they remain available in historical commit b254dd4.

Wager keeps the 1–16 roster, English/Spanish question library, categories/topics, existing scoring/awards, final wager and minigame. Classic keeps its individual English-pack quiz and partial podium. Existing settings and saves without new group metadata follow their previous paths.

## Added behavior

| Setting                   | Values/default                                    | Purpose                                                |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| quizMode                  | wager (existing default), classic, teams, tv-vote | Select the running flow                                |
| classicPack               | general, movies, science, sports, music, custom   | Authored English pack for non-wager flows              |
| teamCount                 | 2 (2–4)                                           | Seeded balanced teams, limited to roster               |
| talkSeconds               | 5 (5–20)                                          | Discussion before the answer clock, with reading floor |
| questions / answerSeconds | Existing defaults and bounds                      | Existing canonical pacing settings                     |

SDK playerCounts retains 1–16 for existing modes and limits groups to 2–8. Every phone uses the existing stamped answer input; the TV remains read-only. Teams average eligible personal points per question. Room vote uses plurality, seeded ties, mean vote time and a shared streak. Neither flow has a wager finale.

Custom UTF-8 text compiles to content/classic-custom.json before bundling. Rebuild/restart and choose classicPack=custom. The pure reducer performs no runtime file reads or content injection.

## Owner-core overlap

Read-only inspection on 2026-10-12 found core T-1146 already shipped seeded teams and mean scoring in Lightning Round's wager flow, including its final team wager. It explicitly lacks discussion, room vote and donor packs. Preserve that deployed mode and its final wager when adapting this public payload; add the missing authored-pack group flows under the same existing card. The frozen P01 public baseline predates T-1146, so this public PR does not prove a migration of the newer private state or settings.

Before owner rollout, compare against the then-current core game, retain core id/name/art/registration and shipped wager-team behavior, map the additive group settings, regenerate the existing registry and run the owner's prescribed checks. This public job verifies its canonical module and documents the migration; it does not claim private-host deployment or installed network behavior.
