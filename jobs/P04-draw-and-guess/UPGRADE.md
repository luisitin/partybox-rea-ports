# P04 upgrade of the existing drawing game

The owner’s Names rule makes this an upgrade payload for **Broken Pencil**, not another core picker card. The public `skribbl` manifest keeps the requested name **Skribbl.io** for this isolated port runner. Core installation uses the injected existing game’s id, name, art and registry entry. This repository contains neither the core host nor Broken Pencil; no private game code or assets are included, and no core deployment is claimed.

## Existing game and the addition

Read-only inspection found a shipped 3–8-player telephone game: everyone owns a book, draws a private word, guesses/redraws passed pages, then presents their book. It has no competitive points. Its existing tools, reconnect drafts, custom words, family/adult packs, Spanish content and presentation remain its default **telephone** mode.

P04 adds opt-in **live guessing**: one artist, a shared streamed picture, blank letters and timed hints, repeated private guesses, speed points, artist rewards and offline visual bot recognition. It does not replace the book routing or the unscored presentation. Release-coordinate handling, coalesced sampling, confirmed Clear and geometric simplification are also reusable drawing-tool improvements; the telephone wire format still needs its own adaptation.

## Server interface

`games/skribbl/server/upgrade.ts` exports `createSkribblUpgrade(baseDefinition)`. The base is a fully typed, injected `GameDefinition`; the adapter imports no other game. It returns a definition with the base’s canonical identity and these settings:

| Setting                | Default     | Used by                |
| ---------------------- | ----------- | ---------------------- |
| Existing base settings | unchanged   | telephone              |
| `playMode`             | `telephone` | mode selection at init |
| `liveLaps`             | 1           | live guessing          |
| `liveDrawSeconds`      | 60          | live guessing          |
| `liveDifficulty`       | `mixed`     | live guessing          |

Existing settings are passed to the telephone initializer after removing only the adapter’s four reserved keys. In particular, its `drawSeconds` is independent of `liveDrawSeconds`. Other init context fields remain intact. Unknown mode values select telephone. The mode cannot change during a match.

The state is `{ playMode, selected, phase, rng, players }`. `selected` is the untouched selected reducer’s state; the three SDK fields reference that state’s own fields and are refreshed after every accepted event. Large book/drawing data is stored only under `selected`. Timer ids and starts, VIP pause/resume/skip/end, participant events and selected game clocks are delegated without translation. An unchanged selected reducer result returns the exact previous wrapper.

Inputs are `{ type: 'mode-input', playMode: 'telephone' | 'live-guessing', input }`, validated against the matching injected schema. Unwrapped, invalid or wrong-mode packets return the previous state without calling either reducer. Mode tags prevent an old telephone packet from becoming a live guess or stroke. Bot RNG and skill are delegated; non-null bot/LLM answers receive the same wrapper. Results, speech, stage picks and recap hooks delegate to the selected game; recap history is unwrapped before the existing recap sees it.

TV and controller views retain the selected view’s fields, add `playMode`, and use the base `gameId`. The private selected state is never added to a view. `upgradeTelephoneState(saved)` wraps a legacy telephone save by reference; saved wrapper states then resume normally.

The manifest uses SDK `playerCounts`: telephone defaults to the existing range with a minimum of three, live guessing is 2–8. The host must use `playerCountRange(manifest, settings)` before init. The factory rejects reserved setting-key conflicts, an existing setting-dependent roster rule, a base that cannot seat three, and a wrapped input cap above the SDK hard limit. The manifest schema also checks the combined settings count. These conflicts require an explicit integration design rather than silently overwriting existing rules.

## Install under the existing card

1. Place this original live implementation beneath the existing game folder, such as `games/broken-pencil/modes/live-guessing/`, retaining its internal relative paths. Importing it from a separate `games/skribbl` entry would violate the core game import boundary and create the duplicate the owner rejected.
2. Keep the original telephone definition injectable. Preserve its original manifest in a local `telephone-manifest.json` and have that definition read it. Write the adapter’s generated manifest to the existing game’s root `manifest.json` for the catalog. This separate source is necessary: feeding the combined manifest back into the base would collide with the reserved upgrade setting keys on the next import.
3. Export `createSkribblUpgrade(telephoneDefinition)` from the existing server entry and regenerate the existing registry. Register only the canonical existing id. Keep the original definition available to its baseline tests; those inputs remain unwrapped when testing that definition directly.
4. In the existing TV and phone entries, inject their original modules and this live mode’s modules into `upgradeTvModule` and `upgradePhoneModule` from `client/upgrade.tsx`. Build/cache one module for each mode once, separately for each surface. The wrapper components dispatch by the pushed view’s `playMode`; outgoing controller inputs receive the matching mode envelope. `me`, `skip` and the view fields retain their existing contracts. Do not recreate the factories on every push.
5. Select the cached module metadata using lobby `readPlayMode(settings)` before a match, then the running state/view’s immutable `playMode`. A preference changed for the next game must not change the running game’s module. Keep VIP skip as a host action, not a wrapped game input.

## Required host presentation selection

Core’s current manifest/shared metadata is static. The adapter does **not** make those host APIs mode-aware by itself. `upgradeModeInfo(baseManifest, mode, baseShared.scoreless ?? false)` provides the selected instructions, languages, duration/estimate, player bounds and scoreless flag. The host integration must resolve these before its start stage, language chip and results stage:

- Telephone uses its existing instructions, content language options, estimate and scoreless results presentation.
- Live guessing uses Skribbl.io instructions, **English-only content**, its own estimate and points results (`scoreless: false`). Do not retain telephone instructions or advertise its Spanish deck for live guessing.
- The client module helpers choose complete selected metadata, retaining the base id. Telephone retains its existing metadata references. Live uses its own metadata; telephone music, StagePick, PhoneStage, Finale and strip callbacks must not leak into it. The helpers merge the available string/sound dictionaries under the canonical id.

The root combined manifest preserves telephone About/estimate/language fields for the default. A host that always reads those fields or loads one static scoreless client module must implement the selection above before enabling live mode. Component dispatch alone cannot fix the host’s opening instructions or result headline.

## Verification and disposition

Focused `server/upgrade.test.ts` tests use the original injected toy game in `__tests__/upgrade-helpers.ts`. They cover baseline reference/delegation, settings isolation, canonical identity, roster bounds, malformed and cross-mode rejection, private views and bot/LLM/recap/speech delegation. `server/upgrade-flow.test.ts` checks mirrored timers/pause/resume and direct-versus-wrapped live bot games to completion for 2/4/8 players at seeds 1/2/3. Client adapter tests exercise module selection and input wrapping. Executed commands/results belong in `VERIFY.md`.

```sh
pnpm vitest run games/skribbl/server/upgrade.test.ts games/skribbl/server/upgrade-flow.test.ts games/skribbl/client/upgrade.test.tsx
pnpm typecheck
```

Before shipping in core, run its existing telephone tests/fixtures unchanged against the original definition, the upgraded contract tests for both modes, and captures through the installed host. Check selected instructions, Spanish telephone/English live content, scoreless versus points results, draft refresh, disconnect, pause, input bytes and the 256 KiB state cap on an eight-player full book history. Wrapper metadata duplicates only the small SDK fields, but the installed state budget still needs measurement.

The public PR delivers the concrete injected adapter, original live mode and integration instructions. Actual core registration, static-manifest generation and host metadata selection remain unperformed in this authorized public clone.
