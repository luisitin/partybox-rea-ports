# Decisions for the public port kit

## P09: numeric leading game IDs (2026-10-12)

Owner instructions in JOBS.md require the official game ID `2048`. The inherited
manifest validator required a leading letter, preventing that module from loading.
Allow a lowercase letter or digit as the first character. Keep the existing
2?32 character length and lowercase letters/digits/hyphens for remaining characters.
All previously valid IDs remain valid; separators, traversal, uppercase and leading
hyphens remain invalid. Game-local manifest tests cover the numeric ID and malformed
paths without changing the published game-agnostic contract tests. No export or
wire shape is added. The owner's separate core checkout remains untouched; importing
this numeric-ID port there also requires this validator change.
