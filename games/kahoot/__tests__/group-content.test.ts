// Team packs and owner authoring share the additive P01 classic schema.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import general from '../content/classic-general.json' with { type: 'json' };
import movies from '../content/classic-movies.json' with { type: 'json' };
import science from '../content/classic-science.json' with { type: 'json' };
import sports from '../content/classic-sports.json' with { type: 'json' };
import music from '../content/classic-music.json' with { type: 'json' };
import custom from '../content/classic-custom.json' with { type: 'json' };
import knowledge from '../content/team-knowledge.json' with { type: 'json' };
import {
  CLASSIC_PACK_IDS,
  classicKnowledgeSchema,
  classicPackSchema,
} from '../content/classic-schema';
import { packs } from '../content/schema';
import { parsePackText } from '../content/text-pack';

const question = (id = 'custom-house-0') => `Id: ${id}
Difficulty: 1
Prompt: Choose the word: which means a pause?
A: Rest
B: Tempo
C: Forte
D: Pitch
Correct: A
Explanation: A rest marks a pause in the music.`;
const textWith = (count: number) =>
  'Pack: custom\nName: House questions\nLang: en\n' +
  Array.from({ length: count }, (_, i) => `---\n${question(`custom-house-${i}`)}`).join('\n');
const source = textWith(5);

describe('additive classic team packs', () => {
  it('keeps the three P01 packs and adds two standard twenty-question packs plus custom', () => {
    expect(CLASSIC_PACK_IDS).toEqual(['general', 'movies', 'science', 'sports', 'music', 'custom']);
    for (const pack of [general, movies, science, sports, music]) {
      expect(classicPackSchema.parse(pack).questions).toHaveLength(20);
      expect(
        classicPackSchema.safeParse({ ...pack, questions: pack.questions.slice(0, 19) }).success,
      ).toBe(false);
    }
    expect(packs['classic-sports'].parse(sports).id).toBe('sports');
    expect(packs['classic-music'].parse(music).id).toBe('music');
    expect(packs['classic-custom'].parse(custom).questions).toHaveLength(5);
    expect(packs['team-knowledge'].parse(knowledge)).toEqual(knowledge);
    expect(custom.questions).toEqual(
      general.questions.slice(0, 5).map((q) => ({ ...q, id: `custom-${q.id}` })),
    );
  });

  it('ships balanced answer positions, mixed difficulty, and answer-text facts for all forty new questions', () => {
    const facts = classicKnowledgeSchema.parse(knowledge);
    const ids: string[] = [];
    for (const raw of [sports, music]) {
      const pack = classicPackSchema.parse(raw);
      expect([0, 1, 2, 3].map((i) => pack.questions.filter((q) => q.correct === i).length)).toEqual(
        [5, 5, 5, 5],
      );
      expect([1, 2, 3].map((d) => pack.questions.filter((q) => q.difficulty === d).length)).toEqual(
        [7, 7, 6],
      );
      for (const q of pack.questions) {
        ids.push(q.id);
        expect(facts[q.id], q.id).toBe(q.options[q.correct]);
        // The independent bot library remains words that survive answer-position shuffling.
        const reordered = [...q.options].reverse();
        expect(reordered[reordered.indexOf(facts[q.id]!)], q.id).toBe(q.options[q.correct]);
      }
    }
    expect(new Set(ids).size).toBe(40);
    expect(Object.keys(facts).sort()).toEqual(ids.sort());
  });

  it('keeps an existing paired-reference ledger for every added fact', () => {
    const ledger = readFileSync(
      new URL('../../../jobs/P02-quiz-rush-teams/CONTENT_SOURCES.md', import.meta.url),
      'utf8',
    );
    for (const q of [...sports.questions, ...music.questions]) {
      const row = ledger.split('\n').find((line) => line.startsWith('| ' + q.id + ' '));
      expect(row, q.id).toBeDefined();
      expect(row!.match(/\]\[/g)?.length, q.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('owner text pack authoring', () => {
  it('converts UTF-8/BOM/CRLF comments and value colons with the canonical shape', () => {
    const result = parsePackText(
      '\uFEFF# Original questions\r\n' + source.replaceAll('\n', '\r\n'),
    );
    expect(result.id).toBe('custom');
    expect(result.lang).toBe('en');
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]).toEqual({
      id: 'custom-house-0',
      prompt: 'Choose the word: which means a pause?',
      options: ['Rest', 'Tempo', 'Forte', 'Pitch'],
      correct: 0,
      explanation: 'A rest marks a pause in the music.',
      difficulty: 1,
    });
  });

  it('allows one trailing separator and rejects empty interior blocks', () => {
    expect(parsePackText(source + '\n---\n# End of pack').questions).toHaveLength(5);
    expect(() => parsePackText(source + '\n---\n---\n' + question('custom-house-5'))).toThrow(
      'Empty block',
    );
  });

  it.each([
    [
      'duplicate field',
      source.replace('Correct: A', 'Correct: A\nCorrect: B'),
      'Duplicate Correct',
    ],
    ['duplicate choice label', source.replace('B: Tempo', 'A: Tempo'), 'Duplicate A'],
    ['unknown header', source.replace('Lang: en', 'Lang: en\nVersion: 1'), 'Unknown header field'],
    ['unknown question field', source + '\nExecutable: alert(1)', 'Unknown question field'],
    ['missing header', source.replace('Name: House questions\n', ''), 'Missing Name'],
    ['missing question field', source.replace('Correct: A\n', ''), 'Missing Correct'],
    ['bad letter', source.replace('Correct: A', 'Correct: E'), 'Correct must be'],
    ['bad difficulty', source.replace('Difficulty: 1', 'Difficulty: 1.5'), 'Difficulty must be'],
    ['duplicate options', source.replace('B: Tempo', 'B: rest'), 'distinct options'],
    ['foreign language', source.replace('Lang: en', 'Lang: es'), 'lang'],
    ['unknown pack', source.replace('Pack: custom', 'Pack: house'), 'id'],
    ['bad id', source.replace('Id: custom-house-0', 'Id: House first'), 'questions.0.id'],
    ['long id', source.replace('Id: custom-house-0', `Id: ${'x'.repeat(49)}`), 'questions.0.id'],
    ['long option', source.replace('A: Rest', `A: ${'x'.repeat(43)}`), 'questions.0.options.0'],
    [
      'long prompt',
      source.replace('Prompt: Choose the word: which means a pause?', `Prompt: ${'x'.repeat(111)}`),
      'questions.0.prompt',
    ],
    [
      'long explanation',
      source.replace(
        'Explanation: A rest marks a pause in the music.',
        `Explanation: ${'x'.repeat(121)}`,
      ),
      'questions.0.explanation',
    ],
    ['missing delimiter', source.replace('---\n', ''), 'Unknown header field'],
    ['missing colon', source.replace('Correct: A', 'Correct A'), 'Expected Field: value'],
    ['blank option', source.replace('A: Rest', 'A:   '), 'questions.0.options.0'],
  ])('rejects %s with a useful line number', (_name, text, message) => {
    expect(() => parsePackText(text)).toThrow(message);
    expect(() => parsePackText(text)).toThrow(/Line \d+:/);
  });

  it('rejects repeated question IDs at the repeated field', () => {
    const repeated = source + '\n---\n' + question();
    const idLine = repeated.split('\n').findLastIndex((line) => line === 'Id: custom-house-0') + 1;
    expect(() => parsePackText(repeated)).toThrow(`Line ${idLine}: Question IDs must be unique`);
  });

  it('uses the runtime five-to-twenty custom question bounds', () => {
    expect(() => parsePackText(textWith(4))).toThrow('questions');
    expect(parsePackText(textWith(20)).questions).toHaveLength(20);
    expect(() => parsePackText(textWith(21))).toThrow('questions');
    expect(() => parsePackText(source.replace('Pack: custom', 'Pack: sports'))).toThrow(
      'exactly twenty',
    );
    expect(
      parsePackText(textWith(20).replace('Pack: custom', 'Pack: sports')).questions,
    ).toHaveLength(20);
  });

  it.each(['general-01', 'movies-01', 'sports-01', 'house-0'])(
    'rejects custom question ID %s outside the reserved namespace',
    (id) => {
      const pack = parsePackText(source);
      const collision = {
        ...pack,
        questions: [{ ...pack.questions[0]!, id }, ...pack.questions.slice(1)],
      };
      expect(classicPackSchema.safeParse(collision).success).toBe(false);
      expect(() => parsePackText(source.replace('Id: custom-house-0', `Id: ${id}`))).toThrow(
        'must start with custom-',
      );
    },
  );

  it('enforces canonical JSON bounds and rejects extra fields, repeated IDs and tuple lengths', () => {
    const pack = parsePackText(source);
    const q = pack.questions[0]!;
    expect(classicPackSchema.safeParse({ ...pack, execute: 'alert(1)' }).success).toBe(false);
    expect(
      classicPackSchema.safeParse({ ...pack, questions: [q, ...pack.questions] }).success,
    ).toBe(false);
    for (const options of [q.options.slice(0, 3), [...q.options, 'Extra']])
      expect(
        classicPackSchema.safeParse({
          ...pack,
          questions: [{ ...q, options }, ...pack.questions.slice(1)],
        }).success,
      ).toBe(false);
    const exact = {
      ...q,
      id: 'custom-' + 'x'.repeat(41),
      prompt: 'x'.repeat(110),
      explanation: 'x'.repeat(120),
      options: ['x'.repeat(42), 'B', 'C', 'D'],
    };
    expect(
      classicPackSchema.safeParse({ ...pack, questions: [exact, ...pack.questions.slice(1)] })
        .success,
    ).toBe(true);
  });
});
