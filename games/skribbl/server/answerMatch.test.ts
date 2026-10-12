import { describe, expect, it } from 'vitest';
import { game } from './index';
import { WORDS } from './content';
import { answerCompact, answerSpellings } from './answerMatch';
import { deepFreeze, drawing, guesser, kit } from '../__tests__/helpers';

const variants = [
  ['donut', 'doughnut', 'doughnu'],
  ['airplane', 'aeroplane', 'aeroplan'],
  ['snowplow', 'snowplough', 'snowploug'],
  ['lasagna', 'lasagne', 'lasagnex'],
] as const;

describe('ordinary English answer spellings', () => {
  it.each(variants)('accepts both exact spellings of %s after SDK normalization', (word, alias) => {
    expect(WORDS).toContain(word);
    expect(answerCompact(word)).toBe(word);
    expect(answerCompact(alias)).toBe(word);
    expect(answerCompact(` THE ${alias.toUpperCase()}!!! `)).toBe(word);
    expect(answerSpellings(word)).toEqual([word, alias]);
    expect(answerSpellings(alias)).toEqual([word, alias]);
  });

  it('keeps every distinct content word distinct and preserves ordinary compact phrase matching', () => {
    expect(new Set(WORDS.map(answerCompact)).size).toBe(WORDS.length);
    expect(answerCompact('an ICE-CREAM!')).toBe('icecream');
    expect(answerSpellings('ice cream')).toEqual(['icecream']);
    const spellings = answerSpellings('doughnut');
    spellings[0] = 'changed by caller';
    expect(answerSpellings('donut')).toEqual(['donut', 'doughnut']);
  });

  it.each([
    ['airplane', 'plane'],
    ['fire engine', 'fire truck'],
    ['refrigerator', 'fridge'],
    ['cookie', 'biscuit'],
    ['wrench', 'spanner'],
    ['snowplow', 'snowplower'],
    ['donut', 'doughnutz'],
  ])('does not turn %s synonyms or guessed corrections into an exact answer: %s', (word, text) => {
    expect(answerCompact(text)).not.toBe(answerCompact(word));
  });

  it.each(variants)(
    'gives %s alternate spelling the same points once, without revealing it',
    (word, alias) => {
      const start = deepFreeze({ ...drawing(), word, hintOrder: [...word].map((_, i) => i) });
      const id = guesser(start);
      const now = start.began + 6000;
      const exact = kit.input(start, id, { type: 'guess', text: word }, now);
      const alternate = kit.input(start, id, { type: 'guess', text: alias, request: 1 }, now);
      expect(alternate.scores).toEqual(exact.scores);
      expect(alternate.gains).toEqual(exact.gains);
      expect(alternate.solved).toEqual(exact.solved);
      expect(alternate.solved[id]).toBe(860);
      expect(alternate.scores[start.drawer]).toBe(250);
      const own = game.controllerView(alternate, id);
      expect(own.feedback).toBe('Correct!');
      expect(own.lastGuess).toBe('');
      expect(own.secret).toBeUndefined();
      expect(own.answer).toBeUndefined();
      expect(own.guessReceipt).toEqual({ revision: 1, request: 1, accepted: true });
      for (const view of [
        game.tvView(alternate),
        ...start.order
          .filter((other) => other !== start.drawer)
          .map((other) => game.controllerView(alternate, other)),
        game.controllerView(alternate, 'spectator'),
      ]) {
        expect(view).not.toHaveProperty('answer');
        expect(view).not.toHaveProperty('secret');
        expect(JSON.stringify(view)).not.toContain(alias);
      }
      const repeated = kit.input(alternate, id, { type: 'guess', text: word }, now + 1000);
      expect(repeated.scores).toEqual(alternate.scores);
      expect(repeated.solved).toEqual(alternate.solved);
      expect(start.guesses).toEqual({});
      expect(start.solved).toEqual({});
    },
  );

  it.each(variants)(
    'keeps a one-edit miss of %s alternate spelling private and scoreless',
    (word, _alias, text) => {
      const start = { ...drawing(), word, hintOrder: [...word].map((_, i) => i) };
      const id = guesser(start);
      const next = kit.input(start, id, { type: 'guess', text }, start.began + 1000);
      const own = game.controllerView(next, id);
      expect(own.feedback).toBe('Close!');
      expect(own.lastGuess).toBe(text);
      expect(next.scores).toEqual(start.scores);
      expect(next.solved).toEqual({});
      expect(game.tvView(next)).toEqual(game.tvView(start));
      for (const other of [
        ...start.order.filter((other) => other !== id),
        'spectator',
        '__proto__',
      ]) {
        expect(game.controllerView(next, other)).toEqual(game.controllerView(start, other));
      }
    },
  );
});
