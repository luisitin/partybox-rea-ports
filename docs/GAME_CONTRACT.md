# The game contract

Source of truth: `packages/shared/src/contract.ts` (types + zod schemas). This page explains it.
A game is a **pure, deterministic state machine**. The engine owns time, seeds, players and networking;
the game owns its state, phase transitions, views and scoring.

## `GameDefinition<S, I>` — what `games/<id>/server/index.ts` exports as `game`

```ts
// S = your state, I = your input union; TV / CV = your view interfaces (default: the bare envelopes).
export interface GameDefinition<
  S extends GameStateBase,
  I,
  TV extends TvView = TvView,
  CV extends ControllerView = ControllerView,
> {
  manifest: GameManifest; // must deep-equal games/<id>/manifest.json (contract test)
  phases: readonly string[]; // every phase id, in typical order; each needs fixtures/<id>.json
  inputSchema: z.ZodType<I>; // validated at the socket BEFORE reduce sees the input
  init(ctx: InitContext): S; // { players, settings, seed, now, presence?, botSkill?, contentLang?, minigame? } — botSkill (ADR-104): 'easy' | 'sharp', the room's bot skill when the game started, fixed for the game; absent = normal; minigame (ADR-087): set when a board game runs the game as a minigame, see "Minigame mode" below; presence (ADR-047): { mode: 'together' | 'remote-voice' | 'remote-text', phoneOnly }, fixed for the game; absent = together with a TV. contentLang (ADR-054): 'en' | 'es', the language of the game's deck, bot lines, reader and matcher, fixed for the game; absent = 'en'. On the client, a deck rendered there reads the pushed view's `contentLang` (the running game's), never `room.contentLang` (the next game's)
  reduce(state: S, event: GameEvent<I>): S; // PURE + TOTAL — never throws
  tvView(state: S): TV; // JSON; identical for every TV
  controllerView(state: S, playerId: string): CV; // JSON; per player
  results(state: S): GameResults | null; // non-null once the game is over
  bot: {
    sampleInput(state: S, playerId: string, rng: Rng, skill?: BotSkill): I | null;
    llm?: GameBotLlm<S, I>;
  }; // sampleInput REQUIRED; llm optional (ADR-068)
}
```

An edition may narrow its roster through `manifest.playerCounts` (ADR-072), naming a select
setting, a default `[minimum, maximum]` and option overrides. All ranges stay within the
manifest's global bounds. The lobby and engine use the selected range; contract checks exercise
the valid minimum, midpoint and maximum for every configured settings variant.

### State base (`GameStateBase`)

```ts
interface GameStateBase {
  phase: { id: string; startedAt: number; deadline: number | null; paused?: { at: number } };
  rng: RngState; // { seed, step } — pure PRNG state lives IN the state
  players: Record<string, PlayerInfo>; // { id, name, avatarId, connected, bot?, canSeeTv? } — who is playing; bot: true for a bot (ADR-028) so a game can act for it where a person taps (Bingo's ready-up); avatarId is a face id or `photo:<id>` for a photo avatar (ADR-037) — pass it to `Avatar` as is; canSeeTv (ADR-047) is whether the player could see the TV at start (bots always) — switch features with it and with ctx.presence, never branch view content on it (a remote phone needs every input phase on its own screen)
}
```

- Put everything else your game needs next to these (`round`, `answers`, `scores`, …). Keep it JSON.
- `rng`: draw with the game-sdk helpers, e.g. `const [value, rng] = nextFloat(state.rng)`, then store `rng`.
  Never `Math.random()`.

### Events (`GameEvent<I>`)

```ts
type GameEvent<I> =
  | { type: 'input'; now: number; playerId: string; input: I; vip?: boolean } // schema-valid input; `vip` = sent by the VIP (ADR-042)
  | { type: 'timer'; now: number; phaseId: string; startedAt: number } // once per deadline (ADR-033)
  | { type: 'player'; now: number; playerId: string; connected: boolean; gone?: 'left' | 'kicked' } // (re)connect / leave; `gone` = for good (ADR-046); a drop arrives 8 s late, and not at all when the phone is back sooner (ADR-065)
  | { type: 'vip'; now: number; action: 'skip' | 'pause' | 'resume' | 'end' }
  | { type: 'speech'; now: number; key: string; ms: number } // a reading you asked for is ready: its length, or -1 (ADR-045)
  | { type: 'speechStart'; now: number; key: string }; // the host's reader started one of yours; its `speech` follows (T-0159; most games ignore it)
```

`reduce` must handle every event in every phase. A timer fires once per phase instance — unless
the reducer answers it by staying in the phase with a _later_ `deadline`, which is a second beat
and fires too (ADR-033; Bingo scores a win at the TV's verdict, then waits for the room). Ignoring
a timer, or a pause shifting the deadline, never re-arms it. A stepped reveal is that second beat:
keep the step in your state and move it with `nextStep(state, deadline, (s) => ({ ...s, step }))`
(same phase instance, new deadline), and put every secret of a later step in the views only once
that step is on stage — a secrets test walks the steps and checks each view (Who Said It's `land`
→ `shown`: authors and points appear at `shown`). The usual shape:

```ts
// server/index.ts owns the phase ORDER; phase files never import each other (no import cycles).
// `advance` is what a deadline does — and what a VIP skip does.
export function advance(state: S, now: number): S {
  switch (state.phase.id) {
    case 'answer':
      return enterReveal(state, now);
    case 'reveal':
      return enterDone(state, now);
    default:
      return state;
  }
}

// sdk composeReduce, in the one order: player → speech → VIP (pause/resume/skip/end) → paused
// (inputs and timers wait) → the phase on stage.
const reduce = composeReduce<S, I>({
  phases: { answer: reduceAnswer, reveal: reduceReveal }, // one file per phase; `next` = advance
  advance, // a deadline, or the VIP's skip
  end: enterDone, // the VIP's end
  // optional: onPlayer (default setConnected), onSpeech (readings), afterVip (a resume's re-check)
});
```

Anything a game does between those steps goes in a hook, so the order stays the SDK's: `prepare`
readies the state before the VIP step (Bingo credits a claim before a skip, Nightfall shifts its day,
Secret Hitler expires drops), `afterVip` follows the VIP (a resume's re-check or clock shift), `skip`
is a VIP skip that isn't the phase's exit, and a phase with its own exit or an input for every phase
wraps its reducer (`(s, e) => reduceShow(s, e, enterSummary)`). Every game builds its `reduce` this way.

A game that waits on everyone (answers, votes) closes a phase a drop has finished:
`onPlayerEvent(state, event, { closeIfDone, isIn })` in place of `setConnected` (a leave goes once on
`state.left` when the game keeps one — `isIn` narrows it to the seats; `closeIfDone` runs after a drop
or a leave, never while paused), and after `applyVip`, `recheckOnResume(vip, event, closeIfDone)` so a
drop during a pause doesn't leave the phase to its timer. More to do on a new leaver (a volunteer, a
void round)? Compare `left.length` before and after. Every game but Blanks' judge rules and Secret
Hitler's exile goes through it.

Inside a phase file, `isTimerFor(state, event)` tells a live timer from a stale one and
`hasPlayer(state, id)` (never `state.players[id]` truthiness — `'__proto__'` is truthy) tells a player
from a spectator. `reduce` receives only schema-valid inputs (the socket validates with `inputSchema`
first, ADR-024) but must tolerate everything else: inputs from spectators, unknown ids and other phases,
stale timers, VIP actions in any order.

### Rules the engine and `packages/game-sdk/src/contract-tests` enforce

| #   | Rule                                                                                                                                                                                                                                                                 | How it is checked                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `reduce` never throws; unexpected events return `state` unchanged (same reference is fine).                                                                                                                                                                          | fuzz: every event type in every phase, from spectators/unknown ids, stale timers                                                                                                                                                                                                                                                                           |
| 2   | No `Date.now()`, `Math.random()`, timers, I/O or module-level mutable state under `games/*/server`.                                                                                                                                                                  | ESLint rules on `games/**/server/**` + source scan test                                                                                                                                                                                                                                                                                                    |
| 3   | **Timers are data.** Set `state.phase.deadline`; the engine schedules ONE `timer` event per `phase.id + startedAt`. Never register callbacks.                                                                                                                        | engine unit tests; contract test asserts a timer event for a stale `startedAt` is ignored                                                                                                                                                                                                                                                                  |
| 4   | State is JSON-serializable, ≤ 256 KB, deterministic: same seed + same events ⇒ byte-identical state.                                                                                                                                                                 | every game replayed twice, hashes compared after every event                                                                                                                                                                                                                                                                                               |
| 5   | Views never throw for any `(state, playerId)` — spectators, disconnected, unknown ids — and never leak hidden info.                                                                                                                                                  | fuzz + each game's `__tests__/contract.config.ts` declares `hiddenFromTv(state)` / `hiddenFromController(state, viewer)`: strings that must not appear in the serialized view outside `players[]`. For numeric secrets omit the KEY from the view and list the key name. Exclude what the viewer may see (own answer, own id — `me.id` is always present). |
| 6   | Every phase is exitable: a deadline, an "all submitted" rule, or VIP `skip`.                                                                                                                                                                                         | random + idle bots must finish within `estimatedMinutes × 3` of simulated time                                                                                                                                                                                                                                                                             |
| 7   | `results()` includes every player from `init` (even ones who left) with finite scores. Computer seats the game plays itself are never in `state.players`; they are ranked beside the players through `results.seats` (`buildResults(state, scores, awards, seats)`). | asserted at termination                                                                                                                                                                                                                                                                                                                                    |
| 8   | `bot.sampleInput` returns schema-valid input (or `null`) in every phase for every player.                                                                                                                                                                            | asserted after every event of the bot runs                                                                                                                                                                                                                                                                                                                 |
| 9   | `manifest` deep-equals `manifest.json`; a fixture exists for every id in `phases`; content packs validate; every fixture plays on without throwing; `done.json` is the last scores fixture played out (T-0207).                                                      | contract test + `pnpm check-drift`                                                                                                                                                                                                                                                                                                                         |

For classic board games, a manifest may declare `unlimitedDuration: true` (ADR-069). The estimate remains catalog metadata. The contract suite checks active-bot completion with an extended simulation budget and checks that idle play persists until explicit VIP end. The engine pauses an empty room and keeps it available instead of aborting it after five minutes. Explicit optional tournament clocks still use event.now and phase.deadline.

## Pausing

On `vip.pause` the shared helper stores `phase.paused = { at: now }`; on `resume` it shifts `deadline` by
the paused duration and clears `paused`. While paused, ignore inputs and timers (the helper does this for you), except the inputs `composeReduce`'s `whilePaused` takes: a card-style sheet or settings menu closed on a phone, which the resume must see (T-0774).
A VIP skip into a phase with the same id starts a new instance (`phaseAt` changes), so its countdown restarts (ADR-097). A skip while paused that moves the same instance on to a beat names it with `phase.beatAt` (the skip time, ADR-101), so `phaseAt` changes and a resume keeps it. A pause never re-stamps a phase, a minigame included.
A game with clocks of its own (a secret pop time, a day's bot beats) moves them by the same amount on
resume: `pausedFor(state, now)` before `applyVip`, then `shiftClocks(obj, ['popAt'], ms)` (unset ones stay).
A VIP skip sent while paused runs the resume first (the whole reduce: `prepare`, the unpause, `afterVip`), then the skip, so paused time never counts as play; a resume that already moved the phase on leaves the skip nothing (T-0784).
The VIP's phone sends `pause` itself when it opens the ★ menu and `resume` when it closes (T-0538, D-074), but only
while the view shows a clock (`deadline` set): a game with nothing counting down is left running. So a view's
`deadline` means "a clock the people can see runs"; don't set it for a hidden fallback. The hold lives in the
phone: if it reloads or loses its socket with the menu open, the game stays paused until someone taps Resume (the
TV's host bar does too). "Make VIP" resumes a held game first, so the new VIP is not handed a paused one.

A phase where people ready up (seating, a team pick) with a hidden net for a forgotten phone answers its
own timer with `patienceNet(state, now, { busy, stepMs, capMs }) ?? next(state, now)`: an idle room
moves on, a busy one re-arms `stepMs` on, never past `capMs`. Decks: `drawFromDeck(rng, deck, n, refill)`.

### Enough time to read [cc45f4]

The owner's pacing rule: no screen with words moves on before a slow reader could read it. Size such a
deadline with `readingMs(words, { ui, lang, largeText })` from `@partybox/game-sdk` (1.5 s + 333 ms a word;
x1.3 for the UI's own words, x1.1 Spanish, x1.2 large text) and `wordCount(text)`; don't keep a per-game copy.

### The start is the shell's (ADR-053)

`init` runs after the shell's start stage: the room has read the manifest's three `howToPlay` steps,
everyone connected has tapped READY, and the 3·2·1 has played on the TV and every phone. A game does
not show its own rules, READY or countdown, and needs no idle timeout for them. Its first phase may
still hold game content that has to follow the start (a card pick, a secret role to read, teams) —
never a second READY for the rules.

**A pick before the rules (T-0475, optional).** A game may declare `stagePick: { options(settings): string[] }`
(Monopoly's piece). The stage then opens on the game's own pick screen (`StagePick` in the `shared`
object of its phone and TV modules, so no download of its own): each phone chooses one option, first tap wins and a
choice stands; READY and the opening film wait for it. The VIP's Start now fills the rest with free
options, a dropped phone never blocks, bots take what is left. `init(ctx)` then gets `ctx.picks`
(playerId → option) for the people who chose; with no `picks` (sim, saves, a game without the pick)
the game must still work on its own. The opening film plays after the pick, with the chosen options.

### Views

Both views share the envelope; the shells render it (timer, player chips, VIP overlay) and hand the whole
view to your components.

A view may name its own countdown with the envelope's `deadline` and `phaseAt` options (docs/sdk/views.md). A phase that re-arms a short beat inside a longer round passes the round's end, so the shells count the round and not the beat. The `phaseAt` it passes must hold through a pause: pass a stamp taken at the round's (or the stage's) start, never its end, since a resume moves the end on.

```ts
interface ViewEnvelope {
  gameId: string;
  phaseId: string;
  deadline: number | null;
  paused: boolean;
  clockHeldAt?: number; // server hold time while paused, including for late/reloaded screens (ADR-096)
  phaseAt: number; // the view's phaseAt option (T-0833), else phase.beatAt (ADR-101), else phase.startedAt: with phaseId it names the phase instance; a resume keeps it, a new phase, a same-id skip or a beat skipped into while paused changes it (ADR-097)
  players: ViewPlayer[]; // { id, name, avatarId, connected, status, score? }  status: 'active' | 'submitted' | 'waiting' | 'spectator'
  timerMode?: 'normal' | 'quiet' | 'hidden'; // ADR-030: quiet = bar only (a rhythm, not a countdown); hidden = nothing
  screen?: string; // T-0147: a new screen inside one phase id (a reveal per card: `card ${i}`); the phone's screen reader says a screen when phaseId or this changes. Leave it out for a phase that restarts on a rhythm (a bingo call)
}
type TvView = ViewEnvelope & Record<string, JsonValue>; // + your fields
type ControllerView = ViewEnvelope & { me: { id: string; role: 'player' | 'spectator' } } & Record<
    string,
    JsonValue
  >;
```

The engine adds `vip` (current VIP id) and `rev` on the wire; games never see who is VIP.
It also sets each `players[].connected` from the room (ADR-074): a phone that dropped reads as
gone once its 8 s grace ends (ADR-065), even in a game that never applies `player` events, so a
game's own copy only matters to its rules ("every connected player is done"). Do not reuse envelope keys for game fields. Keep views small (a few KB) — they are pushed in full.
Views must survive `JSON.parse(JSON.stringify(view))` unchanged: no `undefined`, no `NaN`, no `-0`
(`0 - 0` is fine, `-wager` with `wager === 0` is not — write `|| 0`). Declare your view interfaces
(`interface MyTvView extends TvView { … }`) and pass them as the `TV`/`CV` generics so tests and client
code get typed fields.

### Results

```ts
interface GameResults {
  scores: Record<string, number>; // every player from init
  ranking: { playerId: string; score: number; rank: number }[]; // rank 1 = winner; ties share a rank
  winnerIds: string[]; // empty only for a co-op game the players lost
  awards: { id: string; title: string; description: string; playerId: string }[];
  // ADR-052, optional: how a co-op or team game ended, and the results line (English, translated
  // through the game's strings like awards)
  outcome?:
    | { kind: 'coop'; won: boolean }
    | {
        kind: 'teams';
        winner: string | null;
        teams: { id; name; mark?; color?; members: string[] }[];
      };
  headline?: string;
  // T-0208, optional: a smaller line under the headline, English, translated like headline: why the
  // winner won when the rules decided ("Tie-break: the quickest to spot the imposter"); the headline
  // stays the shell's "Ana wins!". On a board nobody scored a note replaces the shell's "The game
  // ended before anyone could." (TV and phone alike): a game with its own line says why there.
  headlineNote?: string;
  // T-0196, optional: a player's own results-phone line in place of the shell's ("Level on points:
  // Sam spotted the imposter quicker."), English, translated like headline
  placeLines?: Record<string, string>;
  // T-0257: short labels under a player's name on the results board, TV and phone (English, each
  // translated like headline): a hidden role revealed, a power used
  tags?: Record<string, string[]>;
  // T-0866, optional: the unit of `scores` and `ranking` when it is not points: 'ms' is milliseconds,
  // shown as seconds on the boards ("30.0 s"). Ranks and ties still compare the raw numbers.
  scoreUnit?: 'ms';
  // T-0496, optional: public end-state the TV's outro film shows beyond the scoreboard (small JSON).
  // Keys by game: clue { solution: {suspect, weapon, room}, winner: suspectId | null }; nightfall
  // { day, seats: { [playerId]: { role, alive } } }; secret-hitler { liberal, fascist } (policies
  // enacted). films.ts finalFor maps them to each film's final.
  detail?: Record<string, unknown>;
}
// a team game still ranks every member of the winning team 1 (winnerIds = that team); `color` is the
// game's own colour for the team (a CSS colour or token): the results boards group by team, head each
// group in it, and tint the winner's headline. Build them with the SDK: `buildResults(state, scores,
// awards)`, then `coopResults(results, won, headline?)` or `teamResults(results, { winner, teams }, headline?)`
```

### Recap (optional, ADR-035)

`recap?(state, ctx)` returns `{ markdown, files? }` — what the host writes to disk when a room records a
game (`recordings/<gameId>/<time>-<room>/recap.md` next to `session.json` and `state.json`). `ctx` has
the players, the results (null when the VIP ended the game) and `history`: the state as each phase
instance began, oldest first — read the reveal states there for anything the game clears per round
(Lightning's picks, Wisecrack's votes). Write the game's own sections and hand them to the SDK's
`recapMarkdown({ title, at, endedEarly, body, ranking, awards, name })`: it writes the frame every
recap shares (title and date, the ended-early line, final scores, awards). `recapName(ctx.players,
state, id)` names a player. Files are plain names written beside the markdown (Broken
Pencil writes each drawing as an SVG). Pure like every other method; without it the host keeps only the
state.

### Speech (optional, ADR-045)

`speech?(state)` lists the readings the state wants: `SpeechRequest { key, voice, parts }`, where a part
is `{ text }` or `{ ipa, text }` — `text` is required on phoneme parts too, because Zira (`original`)
reads it where Kokoro reads the phonemes. The host makes each key once, serves it at
`/api/speech/<key>.wav` (cached for good: the key is a content hash) and answers with the `speech`
event; `-1` means no voice — carry on with reading time. Ask for a line as soon as its text is known,
never before a secret it contains is revealed, and at most `pendingCap(players)` at a time. Build
readings with the server-only `@partybox/game-sdk/speech` (never from `client/`):

```ts
import { drainSpeech, parsePronunciations, pendingCap, reader } from '@partybox/game-sdk/speech';
import list from '../content/pronunciations.json' with { type: 'json' };
const OVERRIDES = parsePronunciations(list); // validated once, at module level

// null when the room's reader setting is 'none'
const voice = reader('fake-out', state.cfg.reader, { overrides: OVERRIDES });
const fact = voice?.line(prompt.text, { itemId: prompt.id }) ?? null;
// player-written text: { playerText: true } (shouting, stretched words, 140 characters)
const lie = voice?.line(display, { playerText: true }) ?? null;

export function speech(state: State): SpeechRequest[] {
  // most urgent first; drops nulls, repeats and made keys, then caps
  return drainSpeech([fact, lie], state.speechMs, pendingCap(state.seats.length));
}
```

- `speechCatalog?({ voice, contentLang })` (optional, T-0144): every reading the game's content can
  ask for in that voice — questions, prompts, fixed lines; never names, typed answers or a card
  filled with someone's answer. Build it with the same `reader(…)` calls as `speech()` (the keys
  must match) and return `uniqueReadings(list)`; `pnpm speech:warm` renders it into the host's cache
  ahead of play, levelled to one loudness like every reading (T-0137). List the fixed lines too, so
  a first game never waits for them. Test it the way `games/echo/__tests__/speech-catalog.test.ts`
  does: play whole games in one voice and check every reading asked for, except the room's own, is
  in the catalog.
- `reader(gameId, setting, { lang?, overrides? })`: `line(text, { playerText?, itemId? })` is a
  request (`toSpeakable` parts under `speechKey`; its parts are empty when nothing is left to say);
  `parts(parts)` takes a game's own rewrite. `speechLine(gameId, voice, text, opts)` is the same line
  for code that already holds the voice. Views and phase timing: `madeMs(state.speechMs, req)` (ms,
  `-1` failed, `undefined` pending) and `playable(state.speechMs, req)` (`{ key, url }` once made,
  else `null`; put it in a view only when its line plays); `speechUrl(key)`.
- `toSpeakable(text, { voice, lang, overrides?, itemId?, playerText? })` applies Part 00 §5.3's rules:
  numbers, money, times and years as words, symbols and abbreviations, acronyms spelled (as phonemes,
  so a mid-line "A" is not "uh"), pacing, no emoji. Spanish gets rules 1, 9, 10 and 11 only.
- Overrides: the SDK's `speech/overrides.en.json`, beaten by your `content/pronunciations.json`
  (`docs/game-pack/schemas/pronunciations.schema.json`: `words`, `items`, `patterns`; each entry
  `say` / `ipa` (alias `phonemes`) / `spell`), whole words, **case-sensitive** unless `anyCase: true`.
  Test your list: it parses, and `unknownPhonemes(ipa)` is empty for every entry.
- `speakableName(name)`: the name to read, or `null` to skip it. `speechKey(gameId, voice, parts)`:
  `<gameId>-<16 hex>`, a hash of `SPEECH_ENGINE_VERSION`, the voice and the parts.
- Playing it (client, `@partybox/game-sdk/ui`, mute-aware through the shell):
  `useReading(view.say, { on, delayMs, holdMs })` plays the view's made line once per key while the
  screen is mounted; `useSay(view.say, view)` plays a list of `SayItem { key, url, at, ms }` at their
  server times, once per phase instance (crossfade-safe). The TV speaks; a phone passes
  `on: phoneOnly`.

### Content languages (`manifest.contentLangs`, ADR-054)

`"contentLangs": ["en", "es"]` declares the languages the game's deck, bot lines and reader ship in
(absent = English only). The engine tells the game `ctx.contentLang` = the room's language when the
game ships it, else the first listed; the picker's chip is honest about it. A game that ships Spanish
loads its ES pack by that value, passes it to the SDK matcher and `toSpeakable`, and defaults its
reader to a Spanish voice (`dora` / `alex` / `santa`).

`"noCards": true` marks a game with no cards, prompts or words in a language (a board or dice game): the
picker shows no "Cards in English" chip for it (T-0535). Leave it out when the game has any such content.

A select setting option may carry `lang: "en"` or `"es"`. The picker offers untagged options and
options for the game's content language. If a stored value is not offered in that language, the
picker displays the manifest default when it is offered, otherwise the first option tagged for
that language, then the first offered untagged option if the manifest has no language-specific
option. The game's server must use the same fallback for play; hiding an option in the picker alone
does not change the stored value.

### Saved games (`manifest.saveable`)

`"saveable": true` lets the VIP save the running game and resume it later from the lobby (ADR-067). The whole
state is stored as JSON, so it must already be JSON-safe (invariant 4). Bump `version` whenever the state changes
shape: a save from another version is refused, not migrated.

### Minigame mode (`manifest.minigame`, ADR-087)

A manifest `minigame` block (`modes` of `ffa` | `2v2` | `1v3` | `duel`, `seconds` 20-180, `settings`, `controls`, `howTo`, optional `practice`, optional `teamScore: "sum"`, optional `category: "boss"`, optional `jamboreeOnly: true`) lets a board game (Party World) run the game as one round. `init` then gets `ctx.minigame` (`mode`, `teams`, `seconds`) and `ctx.settings` is the defaults plus `minigame.settings`; a team mode ends with a winning side. The wrapper, its screens and the contract test: [docs/sdk/minigame.md](sdk/minigame.md). Every game with this block belongs exclusively to the Party World picker family, alongside the whole Party World modes; Classics uses its complement (ADR-091, amended 2026-10-08). `jamboreeOnly` remains engine metadata, not the shelf filter.

### Bots (`manifest.supportsBots`)

Every game ships `bot.sampleInput` (sim, e2e and the contract suite need it). Setting
`"supportsBots": true` in `manifest.json` additionally declares the game **available for bots**: players may
add bot seats from the lobby and they will play with your bot logic. Without the flag the engine refuses to
start your game while bots are in the room. When you set it, make the bot an honest opponent: it acts in
every input phase, its inputs vary (the contract suite fails a bot that always sends the same input), and it
never needs information a phone would not have. Bots are never VIP and count toward `minPlayers`/`maxPlayers`.
A `null` is a sit-out, not an end: the runner asks the bot again after a beat (300–1200 ms), so a random sampler is
safe. It rolls once to decide and once more to act (`packages/server/src/bots.ts`), so a roll of `p` taps about `p²` of beats.
`skill` (ADR-059) is how well the room's bots play — `easy`, `normal` or `sharp`, the VIP's choice; absent
means `normal`. Reading it is optional; if your bot does, keep `normal` exactly the bot it was.
The VIP cannot change it mid-game, so `init` also gets it as `ctx.botSkill` (`easy` or `sharp`; absent = normal, ADR-104):
a game that shows what level its bots play at (a seat label) keeps it in state; `sampleInput`'s `skill` stays the live value.

**Smarter bots (ADR-068, optional).** `bot.llm = { ask(state, playerId), answer(state, playerId, reply) }`
lets a host that runs a language model (`PARTYBOX_LLM_BOTS`) play a bot's turn with it. Both are pure:
`ask` returns a `BotAsk` (`{ prompt, image?, format?: 'json', maxTokens? }`; `image` is a `BotImage` of
strokes the host renders to PNG) or `null` to let `sampleInput` play; `answer` turns the model's text into
an input or `null`. The server asks, waits at most 25 s and 3 s short of the deadline, and plays
`sampleInput` whenever the model is off, slow, wrong or the phase moved. Put only what the bot's phone
shows in a prompt, and keep `sampleInput` a full bot: most hosts run no model.

### Settings

`manifest.settings` is a list of specs (`number` with min/max/step, `boolean`, `select` with options,
`multiselect` with options — several picks, stored as one comma-joined string, `''` = none; with
`groupBy: '<select key>'` and a `group` per option only the options of the sibling select's current
value are offered and kept, ADR-034). The VIP edits them in the lobby; the engine validates against the
spec and passes `settings` to `init`. Read them there with the SDK's `numberSetting`, `boolSetting`,
`selectSetting` and `picksSetting` (`manifest`, `ctx.settings`, key): the lobby's own rule, so a test or
fixture that passes a stale value gets what the lobby would have (`multiselectPicks(value)` splits a
multiselect as given).

### Typed answers — `@partybox/game-sdk/match` (ADR-048)

Whatever a player types that the game compares — a guess, a clue, a lie, a free-text answer — goes
through the shared matcher, never `===` on raw text. It is pure and gives the same answer on every
machine, so `reduce` may call it and a phone may run the same check as the player types. Every
function takes the content's `lang` (`'en' | 'es'`), read from the pack's required `lang` field.

| Function                                                   | Returns                                                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize(text, lang)`                                    | `{ norm, compact }`: lowercase, no accents, quotes or punctuation, one leading article dropped, number words to 99 as digits ("The Twenty-One Pilots" → `21 pilots`, `21pilots`) |
| `stem(word, lang)`                                         | a key where singular and plural meet (movies, movie → `movi`; luces, luz → `luz`)                                                                                                |
| `matchAnswer(input, item, lang)`                           | `'exact' \| 'stem' \| 'fuzzy' \| 'none'` against `{ answer, accept?, reject?, family? }`; a reject blocks every level, digits never fuzz                                         |
| `sameAnswer(a, b, lang)`                                   | one player's text against another's: the same compact form, the same stems, or 6+ letters one edit apart                                                                         |
| `groupAnswers(texts, lang)`                                | `number[][]`: indices grouped by chains of `sameAnswer`, in submission order                                                                                                     |
| `isLegalClue(clue, secret, { lang, maxChars?, oneWord? })` | `{ ok: true }` or `{ ok: false, reason }`: `empty`, `too-long`, `not-one-word`, `is-secret`, `contains-secret` (the game words the message, in both languages)                   |

Each game picks the level it accepts (a guess usually scores at `fuzzy` or better); `isLegalClue`
calls a clue the secret at `stem` or better. Pass `secret: null` for a player who does not know the
secret (Imposter's imposter): the error itself would tell them their clue is close. Sort ids with
`compareCodeUnits` (`@partybox/game-sdk`): `localeCompare`, `toLocale*` and `Intl` are banned under
`games/*/server`.

**Answer packs.** A content file with typed answers carries `lang` and items `{ id, answer, accept,
reject, family }`, all lowercase (`docs/game-pack/schemas/answer-item.schema.json`); spacing, case,
accent and apostrophe variants are automatic and never listed. Build the content schema with
`answerItemSchema` and test the pack with `checkAnswerPack({ lang, items }, { isCommon? })` (both from
`@partybox/game-sdk`, not `./match`, so zod stays off phones): it fails on two entries equal after
normalization and on an accept that does not come back `exact`, and warns on common words with fewer
than 3 accepts.

**"That counts" (game pack §4.8).** When a guess is judged below the game's bar, the reveal shows what
was typed and the VIP's phone (`view.vip === me.id`) shows ✓ That counts until Next. The button sends a
game input the reducer honours only when `event.vip === true` (ADR-042); it re-scores through the same
`judged()` helper that feeds the score, awards, views and recap, and the TV tags the answer "Counted by
the VIP". Store what was counted, never who counted it. Only a phone sends game inputs, so a room run
from the TV host bar has no override. The contract fuzz sends every input stamped `vip: true` too.

## Client side — `games/<id>/client/{shared,phone-entry,tv-entry}.ts` (ADR-050)

Each surface is its own download: a phone fetches the game's phone entry once the game is chosen
(and never a TV entry), the TV fetches the TV entry. The generated registry imports them lazily;
nothing in `packages/client` may import a game statically (lint).

```ts
// shared.ts — what both surfaces carry
export const shared: GameShared = {
  id: 'my-game',
  strings: STRINGS, // from ./strings.ts: the game's Spanish, keyed by the English sentence (ADR-044)
  sounds: { reveal: 'reveal' }, // optional: map your moments to design-system cue names
  music,
  beds,
  scoreless, // optional: the sound plan (a phone plays it in a phone-only room)
};
// phone-entry.ts
export const phone: GamePhoneModule = {
  ...shared,
  Controller,
  PhoneStage: lazy(() => import('./PhoneStage')), // optional: in a "phone only" room the phones show what the TV would for `phoneStagePhases`, in place of the Controller (S-005)
  phoneStagePhases: ['bingo'],
};
// tv-entry.ts
export const tv: GameTvModule = {
  ...shared,
  Tv,
  quickInto: ['play'], // optional: phases the TV cuts into (their own entrance is the choreography)
  // keepMounted: true, // optional (T-0332): one TV stage all game, never swapped between phases (a 3D board)
  stripActive: (view) => [], // optional: player ids the TV strip rings as "on" — whoever the room should look at (I-017)
  ownLocks: ['answer'], // optional: TV phases where the game sounds its own lock-ins; the shell's `lock` tick stays quiet there (I-020)
  finale,
  Finale: lazyFinale(() => import('./Finale').then((m) => m.Finale)), // optional: keep the game's last board on the results stage (fetched while the game plays)
};
// settings-entry.ts (optional; `"phoneSettings": true` in the manifest): the game's per-phone
// panel for the lobby's 🎨 sheet — a closed row until a player opens it (S-003)
export const settings: GameSettingsModule = { PhoneSettings: PhonePanel };
```

Never import a TV file from the phone side (a constant both need goes in its own file, like Blanks'
`timing.ts`): the phone would download the TV screen with it.

Components receive `{ view, send(input), me, skip? }` and are dumb (`skip` is set on the VIP's phone only and
fires the engine's VIP skip, so a game's own "Next" button is the VIP's without the game knowing who that is — ADR-036): no sockets, no global state, no game logic —
compose `@partybox/game-sdk/ui` primitives (`TextAnswer`, `ChoiceGrid`, `VoteList`, `WaitingScreen`,
`Stage`, `BigText`, `Timer`, `PlayerChips`, `Scoreboard`, `Reveal`). The shell already renders the envelope
(timer, chips, VIP overlay). Server code imports `@partybox/game-sdk` (pure); client code imports
`@partybox/game-sdk/ui` (ADR-023) — the linter enforces the split. The one exception is chess, whose server also imports `chess.js` and `js-chess-engine` (ADR-075).

Every sentence a player or the room reads goes through the device's language (ADR-044): `const L =
useT(STRINGS)` at the top of a component, then `L('Waiting for {name}…', { name })` — the key is the
literal English, placeholders instead of template strings, one key per plural form. A sentence your
server writes renders through `L.sent(text)` (the table's exact entry, or a `{placeholder}` entry that
matches it). The manifest's own sentences (tagline, description, how-to-play, setting labels) go in
`manifest.es.json` next to it: the host serves them to the picker, About and the settings form, so the
picker never loads game code (ADR-049). `scripts/i18n-coverage.test.ts` fails until each has its
Spanish (an English-only `jamboree` game is exempt, D-093). Content stays as written.

## Worked example — the template game (`games/_template`)

"Quick Poll": one input phase (`answer`, 30 s, everyone types a word), one `reveal` phase (10 s), then `done`.

1. **State**: `{ ...base, answers: Record<playerId, string>, scores: Record<playerId, number> }`.
2. **`init`**: seeds `rng` from `ctx.seed`, copies `ctx.players`, enters `answer` with `deadline = now + 30_000`.
3. **`answer` phase**: `input` stores the trimmed answer for a _playing_ player (spectators ignored);
   when every connected player has answered **or** the `timer` fires → `next(state, now)`, which
   `index.ts` wires to `enterReveal`.
4. **`reveal` phase**: everyone who answered scores 1; `timer` → `enterDone`. `results()` is non-null in `done`.
5. **Views**: `tvView` lists who has submitted (status chips) and, in `reveal`, the answers.
   `controllerView` in `answer` returns `{ submitted: boolean }` for the player and hides other answers.
6. **`bot.sampleInput`**: in `answer` returns `{ type: 'answer', text: rng.pick(WORDS) }`; else `null`.
7. **Fixtures**: `fixtures/answer.json`, `fixtures/reveal.json`, `fixtures/done.json` — a full state each.

Read the real files; they are ~150 lines total and every line is commented with _why_.

## Things that are deliberately possible

- A canvas/drawing game: inputs are JSON, so a stroke list is a fine `I`; raise `manifest.maxInputBytes`
  (default 16 KB, hard cap 256 KB, ADR-002) if strokes need it.
- Team games: keep team membership in state; the envelope's `players[]` is still per player.
- Hidden roles: keep secrets in state, expose them only through `controllerView(state, playerId)`.
