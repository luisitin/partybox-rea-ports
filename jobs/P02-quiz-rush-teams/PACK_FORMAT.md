# Local question packs

Author UTF-8 text with the three header fields below. Put `---` before every
question; each question has exactly the nine fields shown. Blank lines and
whole lines starting with `#` are ignored. Values remain on one line; colons
inside a value are allowed. `Correct` is A/B/C/D and difficulty is 1/2/3.

```text
Pack: custom
Name: My questions
Lang: en
---
Id: custom-my-first
Difficulty: 1
Prompt: Your original question?
A: First option
B: Second option
C: Third option
D: Fourth option
Correct: B
Explanation: Why the second option is correct.
```

The canonical P01 classic schema enforces 5–20 custom questions, unique
kebab-case question IDs starting with `custom-` (48 characters maximum,
including the prefix), four distinct options
(case-insensitive), 110-character prompts, 42-character options and
120-character explanations. The five standard packs each require exactly 20
questions. Pack and question objects reject extra fields. Keep questions
family-friendly and record two independent references for each fact. No text
is executed or fetched. Use `Pack: custom`; the name is your display label.
Question IDs use a reserved custom namespace so owner questions cannot replace
standard pack questions. The compiler validates this prefix without rewriting IDs.

```sh
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt --out games/kahoot/content/classic-custom.json
```

The first command checks; the second validates before replacing the bundled
custom JSON. Invalid input exits1 and leaves the destination unchanged.
JSON input is also accepted with the same schema, including `id: "custom"`.
Errors include text line numbers. A single trailing `---` is allowed; duplicate
fields, empty interior blocks and missing fields are rejected. Then rebuild/restart your
PartyBox host and select Custom local pack. Replace classic-custom.json for another
pack without editing code. Questions requested above the pack length are
limited to its length. Custom sample uses five P01 general questions with
`custom-` prefixes on their IDs; their
paired fact sources remain in P01/CONTENT_SOURCES.md.

The compiled JSON is imported by the existing Kahoot classic engine. Its
question shape is `id`, `prompt`, `options`, `correct`, `explanation`,
`difficulty`, under a pack with `id`, `name`, `lang` and `questions`. The
bilingual wager library and its schema are separate. This is a local
authoring format, not Kahoot's spreadsheet format.
