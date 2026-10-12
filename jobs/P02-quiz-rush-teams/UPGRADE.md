# Existing Lightning Round upgrade payload

The owner's overlap rule makes P01/P02 an upgrade of **Lightning Round**, not another core picker card. The public workshop manifest uses **Kahoot! / kahoot** as requested. Core installation keeps the injected existing definition's canonical id, name, art and registration. This public clone contains neither the core host nor Lightning Round, and no private implementation or assets are copied or deployed.

## Existing behavior and addition

Read-only inspection found a shipped 1–16-player quiz: individual speed/streak answers, a final wager, EN/ES question content, bots, categories/topics, and a four-question minigame. Its existing answer chart, standings tally and personal verdict audio already incorporate P01 donor improvements. The existing wager finale and 300-point streak cap remain the **classic** default.

P02 adds opt-in **teams** and **TV vote** using the original public Kahoot engine. There is no additional individual core mode. Teams are fixed and balanced, discuss before the answer clock, then every member answers; group gains average eligible members' points. TV vote discusses, then phones vote for the shared answer; maximum votes win, seeded ties break independently of the answer key, and the room shares points. The TV's game answers remain driven by phones. Both modes use original English packs, including sports/music and the owner-imported custom pack.

## Server API

`games/kahoot/server/upgrade.ts` exports `createKahootUpgrade(baseDefinition)`, `upgradeClassicState(saved)`, `readPlayMode(settings)`, `QUIZ_SETTING_KEYS`, and `upgradeModeInfo(baseManifest, mode, baseScoreless)`. The base is an injected generic `GameDefinition`; no other game is imported.

| Core setting      | Default   | Purpose                                     |
| ----------------- | --------- | ------------------------------------------- |
| Existing settings | Unchanged | Classic only                                |
| `playMode`        | `classic` | `classic`, `teams`, or `tv-vote`            |
| `quizPack`        | `general` | New mode's pack                             |
| `quizRounds`      | 10        | New mode's question count                   |
| `quizSeconds`     | 20        | Minimum answering time                      |
| `quizTeamCount`   | 2         | Fixed team count; capped by roster          |
| `quizTalkSeconds` | 5         | Discussion time plus required reading floor |

The adapter strips only its reserved setting keys from classic init. When none are present it passes the exact context reference; all remaining context fields and classic settings stay intact. New modes receive only their mapped quiz settings, public `mode`, and English content language. Mode is fixed at init. Unknown values, including `solo`, select classic.

State is `{ playMode, selected, phase, rng, players }`. The selected state is retained by reference; the three SDK fields mirror its own fields after every accepted event. A selected reducer returning its unchanged state retains the exact wrapper reference. Timer identities, VIP pause/resume/skip/end, player events, bots/RNG/skill, results, recap and speech delegate to the selected definition. Recap history unwraps selected states; classic stage picks receive only classic settings.

Game inputs are `{ type: 'mode-input', playMode, input }`, validated against the matching schema. Wrong-mode, unwrapped and malformed packets are ignored; old callbacks cannot cross modes. Public answers additionally carry their original question-round stamp. TV/controller views retain the selected fields, add `playMode`, and use the canonical base `gameId`; private selected state is never put in a view. `upgradeClassicState` wraps existing classic saves by reference.

SDK `playerCounts` preserves the base's default bounds (Lightning 1–16) and limits teams/TV vote to 2–8. The host must use `playerCountRange(manifest, settings)` before init. Reserved-key conflicts, a pre-existing roster selector, excess settings count or input-envelope size fail explicitly rather than overwrite baseline rules.

## Install under the existing card

1. Place this original payload under the existing game's folder, for example `games/lightning-round/modes/kahoot/`, preserving internal paths. Keep the existing canonical registry entry; do not register a parallel Kahoot card or import across core game folders.
2. Keep the original classic definition injectable and its manifest in a separate local `classic-manifest.json`. Write the combined adapter manifest to the existing root manifest for discovery. Feeding the combined manifest back into the injected base would collide with its reserved setting keys. Preserve original classic tests against that original definition.
3. Export `createKahootUpgrade(classicDefinition)` from the existing server entry. Classic minigame metadata remains intact; the existing minigame workflow must explicitly select/default to classic. Team/vote minigames are not advertised or newly implemented.
4. In the TV and phone entries inject each surface's original and quiz modules into `upgradeTvModule`/`upgradePhoneModule` from `client/upgrade.tsx`. Cache one complete module per mode once. Select by lobby mode before start, then the running view's immutable `playMode`. Do not recreate component factories for every pushed view. `createUpgradedTv`/`createUpgradedPhone` preserve view, `me` and VIP `skip` references; only game sends receive the mode envelope.
5. Use `upgradeModeInfo` with the **original base manifest** for opening instructions, content language, estimated duration, roster bounds, scoreless results and minigame availability. Classic keeps all its original metadata. Teams/TV vote use their selected English instructions, quiz duration and points results. If the quiz gains a formula estimate, its rounds key is mapped to the namespaced setting.

Static host metadata is not automatically mode-aware. Full module selection preserves classic music, Finale, PhoneStage, StagePick and strip callbacks only for classic. New modes start from the entire public quiz module, so those classic callbacks cannot consume new-mode views. Strings merge under the base id; sounds, music and beds belong to the selected module. Component dispatch alone cannot correct static opening instructions or catalog language claims. The public host is absent, so that selection remains an explicit integration step.

## Owner pack workflow

The text format/compiler/validator writes the bundled `content/custom.json`; rebuild/restart, then choose `quizPack=custom` in the installed card. Keep that file and the compiler in the installed mode folder with the unchanged public pack schema. Adjust the CLI's import/default output paths to that installed folder, or use its output argument. No runtime file reads enter the pure reducer. The current SDK `InitContext` has no content-slot API: there is no `quizCustom` slot, runtime content injection or claimed stock-host schema registration. Private classic decks and their language/provenance rules remain untouched.

## Checks and unperformed integration

The original toy base in `__tests__/upgrade-fixture.ts` tests context/default/reference delegation, hooks and private views. Server tests pair direct and wrapped team/vote games through completion at 2/4/8 seats and seeds 1/2/3, plus pause mirrors, cross-mode/stale rejection and canonical views. Client tests cover injected dispatch, mode sends and complete metadata selection. Executed results belong in VERIFY.md; this document does not claim those commands ran.

```sh
pnpm vitest run games/kahoot/server/upgrade.test.ts games/kahoot/server/upgrade-flow.test.ts games/kahoot/client/upgrade.test.tsx
pnpm typecheck
```

Before core rollout, run its unchanged classic tests/fixtures, both upgraded contracts, installed-host captures and full histories against input/state caps. Verify EN/ES classic versus English new modes, classic wager finale/music/minigame, team results including every starter, vote ties, phone-only views, pause/disconnect/refresh and selected metadata. Actual core registration, manifest generation, original baseline verification and host rollout remain unperformed in this authorized public-clone task.
