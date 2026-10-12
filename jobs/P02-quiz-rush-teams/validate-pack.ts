// Convert a UTF-8 authoring file or validate JSON with the same schema the game consumes.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classicPackSchema } from '../../games/kahoot/content/classic-schema';
import { parsePackText } from '../../games/kahoot/content/text-pack';

try {
  const [input, flag, output, ...extra] = process.argv.slice(2);
  if (!input || extra.length || (flag !== undefined && (flag !== '--out' || !output)))
    throw new Error(
      'Usage: pnpm exec tsx jobs/P02-quiz-rush-teams/validate-pack.ts INPUT [--out OUTPUT.json]',
    );
  const text = readFileSync(resolve(input), 'utf8').replace(/^\uFEFF/, '');
  const pack = text.trimStart().startsWith('{')
    ? classicPackSchema.parse(JSON.parse(text))
    : parsePackText(text);
  if (pack.id !== 'custom')
    throw new Error(
      'Owner packs must use Pack: custom (JSON id: custom) for the Custom local pack setting',
    );
  if (output) {
    if (resolve(input) === resolve(output))
      throw new Error('Input and output must be different files');
    writeFileSync(resolve(output), JSON.stringify(pack, null, 2) + '\n', 'utf8');
  }
  console.log(
    `Valid ${pack.id}: ${pack.questions.length} questions${output ? ` → ${output}` : ''}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
