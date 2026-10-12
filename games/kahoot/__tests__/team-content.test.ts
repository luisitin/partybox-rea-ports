// Authored answer text is independent from shuffled runtime keys.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import sports from '../content/sports.json' with { type: 'json' };
import music from '../content/music.json' with { type: 'json' };
import custom from '../content/custom.json' with { type: 'json' };
import facts from '../content/team-knowledge.json' with { type: 'json' };
import { knowledgeSchema, packSchema } from '../content/schema';
import { parsePackText } from '../content/text-pack';
import { makeDeck } from '../server/content';
import { game } from '../server/index';
import { NEW_PACKS, STRENGTHS } from './test-team-sim';

describe('original sports/music content', () => {
  it('has forty validated, distinct questions with a separate answer-text fact map', () => {
    expect(knowledgeSchema.safeParse(facts).success).toBe(true);
    const allIds: string[] = [];
    for (const raw of [sports, music]) {
      const pack = packSchema.parse(raw);
      expect(pack.lang).toBe('en');
      expect(pack.questions).toHaveLength(20);
      const keys = [0, 0, 0, 0];
      const difficulties = [0, 0, 0];
      for (const question of pack.questions) {
        expect(question.id.startsWith(`${pack.id}-`)).toBe(true);
        expect(question.prompt.length).toBeLessThanOrEqual(110);
        expect(question.explanation.length).toBeLessThanOrEqual(120);
        expect(question.options.every((option) => option.length > 0 && option.length <= 42)).toBe(
          true,
        );
        expect(new Set(question.options.map((option) => option.toLowerCase())).size).toBe(4);
        expect(facts[question.id as keyof typeof facts]).toBe(question.options[question.correct]);
        keys[question.correct]!++;
        difficulties[question.difficulty - 1]!++;
        allIds.push(question.id);
      }
      expect(keys).toEqual([5, 5, 5, 5]);
      expect(difficulties).toEqual([7, 7, 6]);
    }
    expect(new Set(allIds).size).toBe(40);
    expect(Object.keys(facts).sort()).toEqual(allIds.sort());
  });

  for (const raw of [sports, music, custom]) {
    it(`${raw.id}: seeded decks preserve meaning, shuffle keys and cap at the bundled size`, () => {
      const source = packSchema.parse(raw);
      const before = JSON.stringify(raw);
      const questionOrders = new Set<string>();
      const keyPositions = new Set<number>();
      for (let seed = 1; seed <= 20; seed++) {
        const result = makeDeck(source.id, 20, seedRng(seed));
        expect(makeDeck(source.id, 20, seedRng(seed))).toEqual(result);
        const [deck] = result;
        expect(deck).toHaveLength(Math.min(20, source.questions.length));
        expect(new Set(deck.map((question) => question.id)).size).toBe(deck.length);
        for (const question of deck) {
          const original = source.questions.find((candidate) => candidate.id === question.id)!;
          expect(question.options[question.correct]).toBe(original.options[original.correct]);
          expect(question.options.slice().sort()).toEqual(original.options.slice().sort());
          expect(question.prompt).toBe(original.prompt);
          expect(question.explanation).toBe(original.explanation);
          keyPositions.add(question.correct);
        }
        questionOrders.add(deck.map((question) => question.id).join(','));
      }
      expect(questionOrders.size).toBeGreaterThan(1);
      expect(keyPositions.size).toBe(4);
      expect(JSON.stringify(raw)).toBe(before);
      expect(makeDeck(source.id, 3, seedRng(99))[0]).toHaveLength(3);
    });
  }

  it('unknown and inherited-object pack names safely select general', () => {
    for (const pack of ['unknown-pack', '__proto__', 'constructor', 'toString'])
      expect(makeDeck(pack, 20, seedRng(17))).toEqual(makeDeck('general', 20, seedRng(17)));
  });

  it('new-pack bot choices do not change when private answer keys are changed', () => {
    for (const pack of NEW_PACKS)
      for (const strength of STRENGTHS) {
        const kit = testKit(game, {
          players: testPlayers(2, { bots: 2 }),
          settings: { mode: 'teams', pack },
        });
        const state = kit.timer(kit.start());
        expect(state.phase.id).toBe('question');
        const altered = {
          ...state,
          deck: state.deck.map((question) => ({
            ...question,
            correct: (question.correct + 1) % 4,
            explanation: 'Private changed answer key.',
          })),
        };
        for (let seed = 1; seed <= 20; seed++) {
          const input = game.bot.sampleInput(state, 'p1', createRng(seed), strength);
          expect(game.bot.sampleInput(altered, 'p1', createRng(seed), strength)).toEqual(input);
          if (input !== null) expect(game.inputSchema.safeParse(input).success).toBe(true);
        }
      }
  });
});

const authored = [
  'Pack: custom',
  'Name: Local quiz',
  'Lang: en',
  '---',
  'Id: local-square',
  'Difficulty: 1',
  'Prompt: How many sides does a square have?',
  'A: 3',
  'B: 4',
  'C: 5',
  'D: 6',
  'Correct: B',
  'Explanation: A square has four sides.',
].join('\n');

describe('pure custom-pack text authoring', () => {
  it('validates the authoring text into the same schema used by bundled custom content', () => {
    expect(packSchema.safeParse(custom).success).toBe(true);
    const parsed = parsePackText(
      `\uFEFF# Local authoring\r\n${authored.replaceAll('\n', '\r\n')}\r\n---\r\n`,
    );
    expect(parsed.id).toBe('custom');
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]!.options[parsed.questions[0]!.correct]).toBe('4');
    expect(packSchema.safeParse(parsed).success).toBe(true);
    expect(parsePackText(authored)).toEqual(parsed);
  });

  it('rejects missing fields, invalid keys, duplicate options/IDs and length violations', () => {
    const invalid = [
      authored.replace('Lang: en', 'Lang: xx'),
      authored.replace('Correct: B', 'Correct: E'),
      authored.replace('Difficulty: 1', 'Difficulty: 0'),
      authored.replace('\nExplanation: A square has four sides.', ''),
      authored.replace('D: 6', 'D: 4'),
      authored.replace('Prompt: How many sides does a square have?', `Prompt: ${'x'.repeat(111)}`),
      authored.replace('A: 3', `A: ${'x'.repeat(43)}`),
      `${authored}\nExtra: unauthorized`,
      `${authored}\nCorrect: A`,
      `${authored}\n---\n${authored.split('---\n')[1]}`,
    ];
    for (const text of invalid) expect(() => parsePackText(text)).toThrow(/Line \d+:/);
  });
});
