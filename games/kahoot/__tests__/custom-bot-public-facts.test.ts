// Public bot knowledge survives owner IDs without reading the owner's answer key.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { BOT_CORRECT_PROBABILITY, sampleInput } from '../server/bot';
import {
  CLASSIC_PACKS,
  classicBotChoiceIndex,
  classicBotFact,
  classicQuestionById,
  publicClassicPromptFacts,
} from '../server/classic';
import type { ClassicQuestion } from '../server/classic';
import * as content from '../server/content';
import type { State } from '../server/types';
import { start, timer } from './helpers';

const skills = ['easy', 'normal', 'sharp'] as const;
const modes = ['classic', 'teams', 'tv-vote'] as const;
const publicParis = classicQuestionById('general-01')!;
const SAMPLES = 1000;

function open(mode: (typeof modes)[number]): State {
  let state = start({ quizMode: mode, classicPack: 'custom', questions: 5 });
  for (let step = 0; step < 3 && state.phase.id !== 'question'; step++) state = timer(state);
  expect(state.phase.id).toBe('question');
  return { ...state, questionIds: ['custom-owner-fact'], index: 0, picks: {} };
}

function ownerQuestion(overrides: Partial<ClassicQuestion> = {}): ClassicQuestion {
  return {
    ...publicParis,
    id: 'custom-owner-fact',
    category: 'classic-custom',
    choices: ['Tokyo', 'Berlin', 'Madrid', 'Paris'],
    answerIndex: 0, // Deliberately wrong: learned fact text is Paris, not this owner's key.
    ...overrides,
  };
}

function forbiddenKeys(question: ClassicQuestion): ClassicQuestion {
  const copy = { ...question };
  for (const key of ['answerIndex', 'correctIndex', 'correct', 'explanation'])
    Object.defineProperty(copy, key, {
      configurable: true,
      get() {
        throw new Error(`Bot read forbidden owner metadata: ${key}`);
      },
    });
  return copy;
}

function seededChoices(
  question: ClassicQuestion,
  skill: BotSkill,
  mode: (typeof modes)[number] = 'classic',
): number[] {
  const state = open(mode);
  const lookup = vi.spyOn(content, 'questionById').mockReturnValue(question);
  try {
    return Array.from({ length: SAMPLES }, (_, index) => {
      const input = sampleInput(state, 'a', createRng(index + 1), skill);
      if (input?.type !== 'answer')
        throw new Error('Custom quiz bot did not return a stamped answer');
      return input.index;
    });
  } finally {
    lookup.mockRestore();
  }
}

function uniformAcrossSkills(question: ClassicQuestion): void {
  const answers = skills.map((skill) => seededChoices(forbiddenKeys(question), skill));
  expect(answers[1]).toEqual(answers[0]);
  expect(answers[2]).toEqual(answers[0]);
  for (const index of [0, 1, 2, 3]) {
    const count = answers[0]!.filter((answer) => answer === index).length;
    expect(count).toBeGreaterThanOrEqual(180);
    expect(count).toBeLessThanOrEqual(320);
  }
}

describe('custom bots reuse independent public facts', () => {
  it.each(modes)(
    '%s distinguishes three strengths over 1,000 seeds on a renamed public prompt',
    (mode) => {
      const question = ownerQuestion();
      const counts = skills.map(
        (skill) => seededChoices(question, skill, mode).filter((index) => index === 3).length,
      );
      // Seven percentage-point bands tolerate sampling noise but reject a flat 25%.
      expect(counts[0]).toBeGreaterThanOrEqual(230);
      expect(counts[0]).toBeLessThanOrEqual(370);
      expect(counts[1]).toBeGreaterThanOrEqual(430);
      expect(counts[1]).toBeLessThanOrEqual(570);
      expect(counts[2]).toBeGreaterThanOrEqual(730);
      expect(counts[2]).toBeLessThanOrEqual(870);
      expect(counts[1]! - counts[0]!).toBeGreaterThan(100);
      expect(counts[2]! - counts[1]!).toBeGreaterThan(200);
    },
  );

  it.each(modes)(
    '%s calibrates the actual five-question custom pack without mocking its lookup',
    (mode) => {
      const questions = CLASSIC_PACKS.custom.questions;
      const ids = questions.map((question) => question.id);
      const facts = questions.map((question) => classicBotFact(question.id, question.prompt));
      expect(ids).toEqual([
        'custom-general-01',
        'custom-general-02',
        'custom-general-03',
        'custom-general-04',
        'custom-general-05',
      ]);
      expect(facts).toEqual(['Paris', 'Tokyo', 'Four', 'Leonardo da Vinci', 'India']);
      const knownQuestions = facts.filter((fact) => fact !== undefined).length;
      expect(knownQuestions).toBe(5);
      const base = open(mode);
      const strengths = skills.map((skill) => {
        const perQuestion = questions.map((question, index) => {
          const state = { ...base, questionIds: ids, index, picks: {} };
          const choiceCounts = [0, 0, 0, 0];
          const firstSeed = index * SAMPLES + 1;
          const lastSeed = (index + 1) * SAMPLES;
          // Real questionById and current imported custom pack; only the RNG is varied.
          for (let seed = firstSeed; seed <= lastSeed; seed++) {
            const input = sampleInput(state, 'a', createRng(seed), skill);
            if (
              input?.type !== 'answer' ||
              input.questionId !== question.id ||
              input.questionStartedAt !== state.phase.startedAt ||
              !Number.isInteger(input.index) ||
              input.index < 0 ||
              input.index > 3
            )
              throw new Error(`Invalid ${skill} bundled custom answer at seed ${seed}`);
            choiceCounts[input.index] = (choiceCounts[input.index] ?? 0) + 1;
          }
          const expectedCorrectProbability =
            facts[index] === undefined ? 0.25 : BOT_CORRECT_PROBABILITY[skill];
          // Assess correctness externally; the bot must not consult this owner key.
          const correctAnswers = choiceCounts[question.correct]!;
          const measuredCorrectProbability = correctAnswers / SAMPLES;
          expect(choiceCounts.reduce((sum, count) => sum + count, 0)).toBe(SAMPLES);
          expect(
            Math.abs(measuredCorrectProbability - expectedCorrectProbability),
          ).toBeLessThanOrEqual(0.07);
          return {
            questionId: question.id,
            publicFact: facts[index] ?? null,
            independentFactKnown: facts[index] !== undefined,
            samples: SAMPLES,
            seeds: `${firstSeed}..${lastSeed}`,
            choiceCounts,
            correctAnswers,
            measuredCorrectProbability,
            expectedCorrectProbability,
            absoluteTolerance: 0.07,
          };
        });
        const correctAnswers = perQuestion.reduce((sum, row) => sum + row.correctAnswers, 0);
        const samples = SAMPLES * questions.length;
        const expectedCorrectProbability =
          (knownQuestions * BOT_CORRECT_PROBABILITY[skill] +
            (questions.length - knownQuestions) * 0.25) /
          questions.length;
        const measuredCorrectProbability = correctAnswers / samples;
        expect(
          Math.abs(measuredCorrectProbability - expectedCorrectProbability),
        ).toBeLessThanOrEqual(0.055);
        return {
          skill,
          samples,
          correctAnswers,
          measuredCorrectProbability,
          expectedCorrectProbability,
          absoluteTolerance: 0.055,
          perQuestion,
        };
      });
      expect(
        strengths[1]!.measuredCorrectProbability - strengths[0]!.measuredCorrectProbability,
      ).toBeGreaterThan(0.1);
      expect(
        strengths[2]!.measuredCorrectProbability - strengths[1]!.measuredCorrectProbability,
      ).toBeGreaterThan(0.15);
      for (let index = 0; index < questions.length; index++) {
        expect(strengths[1]!.perQuestion[index]!.correctAnswers).toBeGreaterThan(
          strengths[0]!.perQuestion[index]!.correctAnswers,
        );
        expect(strengths[2]!.perQuestion[index]!.correctAnswers).toBeGreaterThan(
          strengths[1]!.perQuestion[index]!.correctAnswers,
        );
      }
      if (process.env.P02_WRITE_EVIDENCE === '1') {
        const media = resolve(import.meta.dirname, '../../../jobs/P02-quiz-rush-teams/media');
        mkdirSync(media, { recursive: true });
        writeFileSync(
          resolve(media, `bot-custom-calibration-${mode}.json`),
          JSON.stringify(
            {
              mode,
              pack: 'custom',
              questionCount: questions.length,
              knownQuestions,
              unknownQuestions: questions.length - knownQuestions,
              seedsPerQuestionAndStrength: SAMPLES,
              requiredSeedsPerQuestionAndStrength: 1000,
              completeRequiredCampaign: SAMPLES === 1000 && questions.length === 5,
              totalAnswerSamples: strengths.reduce((sum, row) => sum + row.samples, 0),
              seeds: '1..5000; five disjoint ranges of 1,000, reused across strengths',
              measurement:
                'Real custom lookup and bot answer sampling; seed = questionIndex * 1000 + 1..1000. Correctness assessed externally from the authored pack.',
              expectedBehavior:
                'All five exact public facts follow the configured skill. Equivalent numeric count words/digits match a unique visible choice; no answer-key metadata is consulted by the bot.',
              strengths,
            },
            null,
            2,
          ) + '\n',
          'utf8',
        );
      }
    },
  );

  it('never reads the owner answer key or explanation, even for an exact known prompt', () => {
    const answers = seededChoices(forbiddenKeys(ownerQuestion()), 'sharp');
    expect(answers.filter((index) => index === 3).length).toBeGreaterThanOrEqual(730);
  });

  it.each(['A made-up fact?', '__proto__', 'constructor', 'toString', 'valueOf'])(
    'keeps unknown/prototype prompt %s as a seeded uniform guess at every strength',
    (question) => uniformAcrossSkills(ownerQuestion({ question })),
  );

  it('guesses after a representable prompt edit or when independent answer text is absent', () => {
    uniformAcrossSkills(ownerQuestion({ question: 'What is the capital of Atlantis?' }));
    uniformAcrossSkills(ownerQuestion({ question: publicParis.question.toLowerCase() }));
    uniformAcrossSkills(ownerQuestion({ question: publicParis.question.replace(/\?$/, '.') }));
    uniformAcrossSkills(ownerQuestion({ choices: ['Tokyo', 'Berlin', 'Madrid', 'Rome'] }));
  });

  it.each([
    ['written violin count', 'general-03', ['Four', 'Six', 'Eight', 'Ten'], 0],
    ['digit violin count', 'general-03', ['1', '2', '3', '4'], 3],
    ['written tennis count', 'sports-09', ['15', '30', 'Zero', '40'], 2],
    ['digit tennis count', 'sports-09', ['15', '30', '0', '40'], 2],
  ] as const)(
    'knows the %s through visible text without owner-key access',
    (_name, id, choices, known) => {
      const source = classicQuestionById(id)!;
      const question = ownerQuestion({ question: source.question, choices: [...choices] });
      expect(classicBotChoiceIndex(question.id, question.question, question.choices)).toBe(known);
      const counts = skills.map(
        (skill) =>
          seededChoices(forbiddenKeys(question), skill).filter((index) => index === known).length,
      );
      expect(counts[0]).toBeGreaterThanOrEqual(230);
      expect(counts[0]).toBeLessThanOrEqual(370);
      expect(counts[1]).toBeGreaterThanOrEqual(430);
      expect(counts[1]).toBeLessThanOrEqual(570);
      expect(counts[2]).toBeGreaterThanOrEqual(730);
      expect(counts[2]).toBeLessThanOrEqual(870);
      expect(counts[1]! - counts[0]!).toBeGreaterThan(100);
      expect(counts[2]! - counts[1]!).toBeGreaterThan(200);
    },
  );

  it.each([
    ['general-03', ['Four', '4', 'Six', 'Eight']],
    ['sports-09', ['Zero', '0', '15', '30']],
  ] as const)('guesses when %s has multiple equivalent visible count choices', (id, choices) => {
    const source = classicQuestionById(id)!;
    const question = ownerQuestion({ question: source.question, choices: [...choices] });
    expect(classicBotChoiceIndex(question.id, question.question, question.choices)).toBe(-1);
    uniformAcrossSkills(question);
  });

  it('keeps Four/4 public count facts equivalent and preserves canonical exact-ID matching', () => {
    const violin = classicQuestionById('general-03')!;
    expect(classicBotFact('custom-violin', violin.question)).toBe('Four');
    expect(classicBotFact('general-03', violin.question)).toBe('Four');
    expect(classicBotFact('music-02', violin.question)).toBe('4');
    const choices = ['4', 'Six', 'Four', 'Ten'];
    expect(classicBotChoiceIndex('custom-violin', violin.question, choices)).toBe(-1);
    expect(classicBotChoiceIndex('general-03', 'An altered prompt', choices)).toBe(2);
    expect(classicBotChoiceIndex('music-02', 'An altered prompt', choices)).toBe(0);
  });

  it.each([
    ['How many counters are there?', ['Four', '4', '04'], 'Four'],
    ['What number is printed?', ['Zero', '0', '00'], 'Zero'],
    ['How many counters are there?', ['Twelve', '12', '012'], 'Twelve'],
    ['How many counters are there?', ['Three', '4', 'Four'], undefined],
    ['How many counters are there?', ['Four', '4', 'Five'], undefined],
    ['Which label is printed?', ['Four', '4', 'Four'], undefined],
    ['How many counters are there?', ['Four', '4.0', 'Four'], undefined],
    ['How many counters are there?', ['Thirteen', '13', 'Thirteen'], undefined],
    [
      'How many counters are there?',
      ['9007199254740992', '9007199254740993', '9007199254740992'],
      undefined,
    ],
  ] as const)(
    'limits count equivalence and permanently rejects conflicts for %s with %j',
    (prompt, answers, expected) => {
      const questions = answers.map((_answer, index) => ({ id: `public-${index}`, prompt }));
      const facts = Object.fromEntries(answers.map((answer, index) => [`public-${index}`, answer]));
      const index = publicClassicPromptFacts([{ id: 'general', questions }], facts);
      expect(index.get(prompt)).toBe(expected);
    },
  );

  it('keeps canonical known-ID priority and never adds prompt lookup to unrelated IDs', () => {
    expect(classicBotFact('general-01', 'An altered prompt')).toBe('Paris');
    expect(classicBotFact('general-missing', publicParis.question)).toBeUndefined();
    expect(classicBotFact('geo-000', publicParis.question)).toBeUndefined();
  });

  it('indexes only standard facts and keeps conflicting prompts omitted after later repeats', () => {
    const packs = [
      {
        id: 'general',
        questions: [
          { id: 'public-a', prompt: 'Repeated prompt' },
          { id: 'public-b', prompt: 'Repeated prompt' },
          { id: 'public-c', prompt: 'Repeated prompt' },
          { id: 'missing-fact', prompt: 'No independent fact' },
          { id: 'inherited-fact', prompt: 'Inherited fact' },
          { id: 'public-safe', prompt: 'Unambiguous prompt' },
        ],
      },
      {
        id: 'custom',
        questions: [
          { id: 'custom-poison', prompt: 'Unambiguous prompt' },
          { id: 'custom-only', prompt: 'Owner-only prompt' },
        ],
      },
    ];
    const facts = Object.assign(Object.create({ 'inherited-fact': 'Inherited' }), {
      'public-a': 'A',
      'public-b': 'B',
      'public-c': 'A',
      'public-safe': 'Safe',
      'custom-poison': 'Wrong',
      'custom-only': 'Owner key',
    }) as Record<string, string>;
    const index = publicClassicPromptFacts(packs, facts);
    expect(index.get('Repeated prompt')).toBeUndefined();
    expect(index.get('No independent fact')).toBeUndefined();
    expect(index.get('Inherited fact')).toBeUndefined();
    expect(index.get('Owner-only prompt')).toBeUndefined();
    expect(index.get('Unambiguous prompt')).toBe('Safe');
  });
});
