# Local question packs

Author UTF-8 text with the three header fields below. Put `---` before every
question; each question has exactly the nine fields shown. Blank lines and
whole lines starting with `#` are ignored. Values remain on one line; colons
inside a value are allowed. `Correct` is A/B/C/D and difficulty is1/2/3.

```text
Pack: my-pack
Name: My questions
Lang: en
---
Id: my-pack-first
Difficulty: 1
Prompt: Your original question?
A: First option
B: Second option
C: Third option
D: Fourth option
Correct: B
Explanation: Why the second option is correct.
```

The existing game schema enforces1–200questions, unique kebab-case IDs,
four distinct options (case-insensitive),110-character prompts,42-character
options and120-character explanations. Keep questions family-friendly and
record your fact sources. No text is executed or fetched.

```sh
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt
pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts my-pack.txt --out games/kahoot/content/custom.json
```

The first command checks; the second validates before replacing the bundled
custom JSON. Invalid input exits1 and leaves the destination unchanged.
JSON input is also accepted with the same schema. Then rebuild/restart your
PartyBox host and select Custom local pack. Replace custom.json for another
pack without editing code. Questions requested above the pack length are
limited to its length. Custom sample uses five P01 general questions; their
paired fact sources remain in P01/CONTENT_SOURCES.md.

In core, generate the file inside the installed existing Lightning Round
upgrade payload. Follow UPGRADE.md for its namespaced quizPack setting.
This is a local authoring format, not Kahoot's spreadsheet format.
