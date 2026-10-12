# P03 — Quizizz research

Inspected 2026-10-11. This records source observations separately from the PartyBox rules.
Source IDs and URLs are in [SOURCES.md](SOURCES.md).

## Evidence and independent corroboration

| Observation                                                                                                                | Vendor evidence                                                      | Independent firsthand evidence |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| Quizizz's student-paced flow lets each person progress independently while the host monitors live progress.                | W1                                                                   | Q1, Q2                         |
| Questions and choices belong on the player's own device; the host's screen can track participants, answers and completion. | W1                                                                   | Q1, Q2                         |
| Per-answer feedback, personal score and power-ups give the question loop short rewards.                                    | W2, W3                                                               | Q2                             |
| Gold Quest is a fast self-paced question loop where answering earns gold and interaction can affect other players' gold.   | B1                                                                   | B2, B3                         |
| In recorded 2023 Gold Quest play, a correct answer leads to choosing one of three reward chests.                           | B1 identifies chests; B2 and B3 independently describe the selection | B2, B3                         |

W1 is current Wayground documentation; Quizizz's public join URL redirects to the same client.
Q1 is an original 2025 intervention report, and Q2 is a firsthand app evaluation with a screencast.
B2 and B3 describe their own teaching use, rather than copying a vendor comparison.
Historical observations are dated: they are not claims that every 2023 reward still exists today.

## Round structure, timing and scoring

- Quizizz Classic: host starts a common session; each phone reads and answers its own question,
  gets feedback and progresses. The host follows a live leaderboard (W1, Q1, Q2).
- Gold Quest: answer → verdict → reward chest after success → result/possible rival interaction
  → another question. This turns correctness into more reward opportunities (B1, B2, B3).
- Current vendor guidance calls Gold Quest self-paced with high-frequency prompts (B1).
  B3's classroom tutorial describes choosing a time or money goal and favors a definite time cap.
- B2 reports an approximately three-second delay after a wrong answer in 2023. That duration
  is singly observed and historical; it is not a verified current constant or a port requirement.
- W3 distinguishes correctness from the competitive score. Its optional timer can add a speed
  bonus. W2 describes score-changing abilities. Q2 independently observed power-ups and scores.
- Gold Quest's competitive gold can change through rewards and taking gold; its rewards create
  surprise and standings changes (B1, B2, B3). Exact current odds and amounts were not verified.

## Feel, sounds and the fun moments

The transferable rhythm is a short personal reward followed by immediate agency: read, choose,
see a verdict, decide whether to spend a power-up, continue. Meanwhile the shared leaderboard
makes individual work visible to the room (W1, Q1, Q2, B1, B3).
The surprise in Gold Quest is another person's visible standings changing after a reward;
Q2's recorded Quizizz use emphasizes personal feedback and selectable abilities.
These are design inferences from the observed loops, not measured engagement claims.

Q2 deliberately recorded a quiz without sound. W3 offers a music setting, but no original audio
file, exact cue length or music transition was measured or copied. Quizizz uses the
SDK's sound hooks and original CSS/inline artwork; silence must also be playable.

## Public live/client inspection

- `https://quizizz.com/join` and `https://wayground.com/join` returned HTTP 200 on 2026-10-11,
  with the same public join module. Read that module transiently: it includes question,
  leaderboard and power-up handling. No source code or asset was copied into the repository.
- `https://play.blooket.com/` is a Game ID join surface through web inspection. Direct HTTP
  requests to it and `https://gold.blooket.com/` returned 403; the web tool reported Gold Quest's
  entry as a game-not-found surface. Accessible official previews and firsthand recordings
  provided the research fallback. No stranger's room was joined and no account was created.
- A complete live original multiplayer session was not played. Exact present-day timings,
  Gold Quest reward probabilities and original audio remain unverified, recorded in ASSUMPTIONS.
- Tried the connected computer-use browser for a public visitor practice session: creating an
  in-app tab reported `Browser is not available: iab`, and the enabled-surfaces inventory returned
  no browsers or native apps. This runner used readable public sources and client inspection.

## PartyBox adaptation for eight people

- Each phone always carries its current question and four labeled choices, including rooms
  with a TV. Everyone advances independently through the same seeded finite question sequence.
- The TV is a public race track: one named lane per player, completed-question progress,
  score, clear frozen status, and a large shared clock. It never broadcasts questions or keys
  while another player might still be answering them.
- Correct answers score 100 plus a modest capped streak bonus. Energy is earned every three
  correct answers. Spend it on a nonstacking three-second rival freeze or doubling the next
  correct answer. These numbers and rules are original PartyBox choices, not source constants.
- Freeze-rival is a deliberate adaptation. Quizizz's documented Time Freeze extends the user's
  own answering opportunity; the two mechanics must not be conflated.
- Omit gold theft, score swapping and exponential multipliers so a late random reward cannot
  erase the whole knowledge race. Let players choose reward timing and a clearly named rival.
- A shared duration cap and finite content prevent waiting for idle or disconnected phones.
  Reconnect restores the current prompt/verdict. Pause shifts all private availability clocks.
- Phone-only play retains questions and shows compact public standings; spectators see the
  stage with no answer or power-up controls. Bots use separate factual knowledge and seeded
  uncertainty, not the private content answer key.

The implementation spec lives in `games/quizizz/README.md`; VERIFY.md records actual
durations, fit checks and tests rather than presenting proposed tuning as verified results.
