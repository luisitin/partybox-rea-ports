import { describe, expect, it } from 'vitest';
import { parsePackText } from './text-pack';

const question = (id = 'house-first') => `Id: ${id}
Difficulty: 1
Prompt: Choose the word: which means a pause?
A: Rest
B: Tempo
C: Forte
D: Pitch
Correct: A
Explanation: A rest marks a pause in the music.`;
const source = `Pack: house
Name: House questions
Lang: en
---
${question()}`;

describe('owner pack authoring', () => {
  it('converts UTF-8/BOM/CRLF comments and value colons without changing the answer', () => {
    const result = parsePackText(
      '\uFEFF# Original fact questions\r\n' + source.replaceAll('\n', '\r\n'),
    );
    expect(result.id).toBe('house');
    expect(result.questions[0]).toMatchObject({
      prompt: 'Choose the word: which means a pause?',
      correct: 0,
      options: ['Rest', 'Tempo', 'Forte', 'Pitch'],
    });
  });
  it('allows a trailing separator but not an empty middle question', () => {
    expect(parsePackText(source + '\n---\n').questions).toHaveLength(1);
    expect(() => parsePackText(source + '\n---\n---\n' + question('house-two'))).toThrow(
      'Empty block',
    );
  });
  it.each([
    [
      'duplicate field',
      source.replace('Correct: A', 'Correct: A\nCorrect: B'),
      'Duplicate Correct',
    ],
    ['unknown field', source + '\nExecutable: alert(1)', 'Unknown question field'],
    ['missing field', source.replace('Correct: A\n', ''), 'Missing Correct'],
    ['bad letter', source.replace('Correct: A', 'Correct: E'), 'Correct must be'],
    ['bad difficulty', source.replace('Difficulty: 1', 'Difficulty: 1.5'), 'Difficulty must be'],
    ['duplicate options', source.replace('B: Tempo', 'B: rest'), 'distinct options'],
    ['foreign language', source.replace('Lang: en', 'Lang: es'), 'lang'],
    ['bad id', source.replace('Id: house-first', 'Id: House first'), 'questions.0.id'],
    ['long option', source.replace('A: Rest', `A: ${'x'.repeat(43)}`), 'questions.0.options.0'],
  ])('rejects %s with a useful location', (_name, text, message) => {
    expect(() => parsePackText(text)).toThrow(message);
    expect(() => parsePackText(text)).toThrow(/Line \d+:/);
  });
  it('rejects duplicate IDs across separated questions', () => {
    expect(() => parsePackText(source + '\n---\n' + question())).toThrow('unique');
  });
  it('accepts200questions and rejects201, using the actual game bounds', () => {
    const text =
      'Pack: house\nName: House questions\nLang: en\n' +
      Array.from({ length: 200 }, (_, i) => `---\n${question(`house-${i}`)}`).join('\n');
    expect(parsePackText(text).questions).toHaveLength(200);
    expect(() => parsePackText(text + '\n---\n' + question('house-200'))).toThrow('200');
  });
});
