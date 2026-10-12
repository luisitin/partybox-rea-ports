// Strict, pure text authoring parser for the same classic schema used by the server.
import { classicPackSchema } from './classic-schema';
import type { ClassicPack } from './classic-schema';

type Field = { value: string; line: number };
type Block = Record<string, Field>;
const HEADER = ['Pack', 'Name', 'Lang'];
const QUESTION = ['Id', 'Difficulty', 'Prompt', 'A', 'B', 'C', 'D', 'Correct', 'Explanation'];

function fail(line: number, message: string): never {
  throw new Error(`Line ${line}: ${message}`);
}

function requireFields(block: Block, keys: string[], line: number): void {
  for (const key of keys) if (!Object.hasOwn(block, key)) fail(line, `Missing ${key}`);
}

/** Header fields, then --- and one nine-field question per block. */
export function parsePackText(text: string): ClassicPack {
  const blocks: Block[] = [{}];
  const starts = [1];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const [index, source] of lines.entries()) {
    const line = index + 1;
    const value = source.trim();
    if (!value || value.startsWith('#')) continue;
    if (value === '---') {
      if (Object.keys(blocks.at(-1)!).length === 0) fail(line, 'Empty block');
      blocks.push({});
      starts.push(line + 1);
      continue;
    }
    const colon = value.indexOf(':');
    if (colon < 1) fail(line, 'Expected Field: value');
    const key = value.slice(0, colon).trim();
    const allowed = blocks.length === 1 ? HEADER : QUESTION;
    if (!allowed.includes(key))
      fail(line, `Unknown ${blocks.length === 1 ? 'header' : 'question'} field ${key}`);
    const block = blocks.at(-1)!;
    if (Object.hasOwn(block, key)) fail(line, `Duplicate ${key}`);
    block[key] = { value: value.slice(colon + 1).trim(), line };
  }
  // A single trailing separator is harmless; an empty interior block fails above.
  if (blocks.length > 1 && Object.keys(blocks.at(-1)!).length === 0) {
    blocks.pop();
    starts.pop();
  }
  const header = blocks[0]!;
  requireFields(header, HEADER, 1);
  if (blocks.length === 1) fail(lines.length, 'Add --- and at least five questions');
  const seen = new Set<string>();
  const questions = blocks.slice(1).map((block, index) => {
    requireFields(block, QUESTION, starts[index + 1]!);
    if (!/^[123]$/.test(block.Difficulty!.value))
      fail(block.Difficulty!.line, 'Difficulty must be 1, 2 or 3');
    if (!/^[ABCD]$/.test(block.Correct!.value))
      fail(block.Correct!.line, 'Correct must be A, B, C or D');
    if (seen.has(block.Id!.value))
      fail(block.Id!.line, 'Question IDs must be unique within a pack');
    seen.add(block.Id!.value);
    return {
      id: block.Id!.value,
      prompt: block.Prompt!.value,
      options: ['A', 'B', 'C', 'D'].map((key) => block[key]!.value),
      correct: 'ABCD'.indexOf(block.Correct!.value),
      explanation: block.Explanation!.value,
      difficulty: Number(block.Difficulty!.value),
    };
  });
  const parsed = classicPackSchema.safeParse({
    id: header.Pack!.value,
    name: header.Name!.value,
    lang: header.Lang!.value,
    questions,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const questionIndex = issue.path[0] === 'questions' ? issue.path[1] : undefined;
    const block = typeof questionIndex === 'number' ? blocks[questionIndex + 1] : header;
    const key =
      typeof questionIndex === 'number'
        ? issue.path[2] === 'options'
          ? 'ABCD'[Number(issue.path[3] ?? 0)]
          : ({ id: 'Id', prompt: 'Prompt', explanation: 'Explanation' } as Record<string, string>)[
              String(issue.path[2])
            ]
        : ({ id: 'Pack', name: 'Name', lang: 'Lang' } as Record<string, string>)[
            String(issue.path[0])
          ];
    fail(
      block && key && block[key] ? block[key]!.line : 1,
      `${issue.path.join('.') || 'pack'}: ${issue.message}`,
    );
  }
  return parsed.data;
}
