// Content validation is the boundary that keeps malformed packs off the phones.
import { describe, expect, it } from 'vitest';
import { questionPackSchema, questionSchema } from '../content/schema';
import { PACKS } from '../server/content';

const basePack = PACKS.general!;
const boundaryQuestion = {
  ...basePack.questions[0]!,
  prompt:
    'Which carefully described scientific object matches the following detailed description most closely?',
  options: [
    'A carefully described scientific object',
    'A completely different scientific object',
    'An unrelated natural object or substance',
    'Another plausible scientific explanation',
  ],
  explanation:
    'This deliberately long explanation checks that readable answer feedback fits with the score, progress, next control and earned powers on a tiny phone.',
};

function packWithQuestion(change: Record<string, unknown>): unknown {
  return {
    ...basePack,
    questions: basePack.questions.map((question, index) =>
      index === 0 ? { ...boundaryQuestion, ...change } : question,
    ),
  };
}

describe('question pack validation', () => {
  it('accepts a displayable question at the 100/40/150 character limits', () => {
    expect(boundaryQuestion.prompt).toHaveLength(100);
    expect(Math.max(...boundaryQuestion.options.map((option) => option.length))).toBe(40);
    expect(boundaryQuestion.explanation).toHaveLength(150);
    expect(questionSchema.parse(boundaryQuestion)).toEqual(boundaryQuestion);
    expect(questionPackSchema.safeParse(packWithQuestion({})).success).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ['prompt', { prompt: `${boundaryQuestion.prompt}x` }],
    [
      'option',
      {
        options: boundaryQuestion.options.map((option, index) =>
          index === 1 ? `${option}x` : option,
        ),
      },
    ],
    ['explanation', { explanation: `${boundaryQuestion.explanation}x` }],
  ])('rejects a %s one character over its limit', (_field, change) => {
    expect(questionPackSchema.safeParse(packWithQuestion(change)).success).toBe(false);
  });

  it.each(['prompt', 'explanation'])('rejects a whitespace-only %s', (field) => {
    expect(questionPackSchema.safeParse(packWithQuestion({ [field]: '   ' })).success).toBe(false);
  });

  it.each([
    { name: 'identical', options: ['Alpha', 'Alpha', 'Beta', 'Gamma'] },
    { name: 'case-folded', options: ['Alpha', 'alpha', 'Beta', 'Gamma'] },
    { name: 'trimmed and case-folded', options: ['Alpha', ' ALPHA ', 'Beta', 'Gamma'] },
  ])('rejects $name repeated choices', ({ options }) => {
    expect(questionPackSchema.safeParse(packWithQuestion({ options })).success).toBe(false);
  });

  it('rejects repeated question IDs even when both questions are otherwise valid', () => {
    const questions = basePack.questions.map((question, index) =>
      index === 1 ? { ...question, id: basePack.questions[0]!.id } : question,
    );
    expect(questionPackSchema.safeParse({ ...basePack, questions }).success).toBe(false);
  });

  it.each([19, 21])('rejects a pack with %i otherwise valid, distinct questions', (count) => {
    const questions =
      count === 19
        ? basePack.questions.slice(0, 19)
        : [...basePack.questions, { ...basePack.questions[0]!, id: 'general-extra' }];
    expect(questionPackSchema.safeParse({ ...basePack, questions }).success).toBe(false);
  });

  it.each([-1, 4, 1.5])('rejects the invalid correctIndex %s', (correctIndex) => {
    expect(questionPackSchema.safeParse(packWithQuestion({ correctIndex })).success).toBe(false);
  });

  it('rejects unknown fields on the pack and on an individual question', () => {
    expect(questionPackSchema.safeParse({ ...basePack, answerKey: 'unrecognised' }).success).toBe(
      false,
    );
    expect(
      questionPackSchema.safeParse(packWithQuestion({ answerKey: 'unrecognised' })).success,
    ).toBe(false);
  });
});
