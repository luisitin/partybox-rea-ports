import { describe, expect, it } from 'vitest';
import { shuffle } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { DECKS } from '../server/content';
import { enterDraw } from '../server/phases/draw';
import { BEAT_MS, CHOOSE_MS } from '../server/types';
import type { State } from '../server/types';
import { deepFreeze, T0 } from './helpers';

function start(seed: number, bots = false, difficulty = 'mixed'): State {
  return game.init({
    players: testPlayers(8, { bots: bots ? 8 : 0 }),
    settings: { difficulty, laps: 2, drawSeconds: 30 },
    seed,
    now: T0,
  });
}

function timeout(state: State): State {
  return game.reduce(state, {
    type: 'timer',
    now: state.phase.deadline!,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
}

function checkDrawingStart(before: State, after: State, at: number): void {
  const positions = [...after.word].flatMap((letter, i) => (letter === ' ' ? [] : [i]));
  const [hintOrder, rng] = shuffle(before.rng, positions);
  expect(after.rng).toEqual(rng);
  expect(after.hintOrder).toEqual(hintOrder);
  expect(after.phase).toEqual({ id: 'draw', startedAt: at, deadline: at + BEAT_MS });
  expect(after.began).toBe(at);
  expect(after.clock).toBe(at);
  expect(after.endsAt).toBe(at + before.settings.drawSeconds * 1000);
  expect(after.turn).toBe(before.turn);
  expect(after.drawer).toBe(before.drawer);
  expect(after.order).toBe(before.order);
  expect(after.players).toBe(before.players);
  expect(after.used).toEqual([...before.used, after.word]);
  expect(after.choices).toEqual([]);
}

describe('artist word-choice timeout', () => {
  it.each([false, true])(
    'eliminates medium and hard automatic words over 1000 mixed seeds with bots=%s',
    (bots) => {
      const before = { medium: 0, hard: 0 };
      const after = { medium: 0, hard: 0 };
      for (let seed = 1; seed <= 1000; seed++) {
        const choosing = start(seed, bots);
        const drawing = timeout(choosing);
        for (const tier of ['medium', 'hard'] as const) {
          if (DECKS[tier]!.includes(choosing.choices[0]!)) before[tier]++;
          if (DECKS[tier]!.includes(drawing.word)) after[tier]++;
        }
        expect(DECKS.easy).toContain(drawing.word);
        expect(choosing.choices).toContain(drawing.word);
        const explicit = game.reduce(choosing, {
          type: 'input',
          now: T0 + CHOOSE_MS - 1,
          playerId: choosing.drawer,
          input: { type: 'choose', index: choosing.choices.indexOf(drawing.word) },
        });
        expect(drawing.rng).toEqual(explicit.rng);
        expect(drawing.hintOrder).toEqual(explicit.hintOrder);
        expect(choosing.phase.deadline).toBe(T0 + CHOOSE_MS);
        checkDrawingStart(choosing, drawing, T0 + CHOOSE_MS);
      }
      expect(before.medium).toBeGreaterThan(0);
      expect(before.hard).toBeGreaterThan(0);
      expect(after).toEqual({ medium: 0, hard: 0 });
      console.info(
        `Mixed timeout bots=${bots}: medium ${before.medium}/1000 -> ${after.medium}/1000; hard ${before.hard}/1000 -> ${after.hard}/1000`,
      );
    },
  );

  it.each([0, 1, 2])('preserves an explicit choice of index %i at every tier', (index) => {
    const selectedTiers = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const choosing = deepFreeze(start(seed));
      const before = JSON.stringify(choosing);
      const at = T0 + 1;
      const drawing = game.reduce(choosing, {
        type: 'input',
        now: at,
        playerId: choosing.drawer,
        input: { type: 'choose', index },
      });
      expect(drawing.word).toBe(choosing.choices[index]);
      checkDrawingStart(choosing, drawing, at);
      expect(JSON.stringify(choosing)).toBe(before);
      selectedTiers.add(Object.keys(DECKS).find((tier) => DECKS[tier]!.includes(drawing.word))!);
    }
    expect([...selectedTiers].sort()).toEqual(['easy', 'hard', 'medium']);
  });

  it.each(['easy', 'medium', 'hard'])(
    'keeps the first offered word when the selected deck is %s',
    (difficulty) => {
      for (let seed = 1; seed <= 100; seed++) {
        const choosing = start(seed, false, difficulty);
        const drawing = timeout(choosing);
        expect(drawing.word).toBe(choosing.choices[0]);
        checkDrawingStart(choosing, drawing, T0 + CHOOSE_MS);
      }
    },
  );

  it('remains total with missing easy options, empty hands and unknown difficulty values', () => {
    const choosing = start(7);
    for (const { difficulty, choices, word } of [
      {
        difficulty: 'mixed',
        choices: ['unknown option', 'another option'],
        word: 'unknown option',
      },
      { difficulty: 'mixed', choices: [], word: 'cat' },
      { difficulty: 'mixed', choices: [''], word: 'cat' },
      { difficulty: 'unknown deck', choices: ['first option', 'cat'], word: 'first option' },
    ]) {
      const state = deepFreeze({
        ...choosing,
        choices,
        settings: { ...choosing.settings, difficulty },
      });
      const drawing = enterDraw(state, T0 + CHOOSE_MS);
      expect(drawing.word).toBe(word);
      checkDrawingStart(state, drawing, T0 + CHOOSE_MS);
    }
  });

  it('ignores invalid choices and premature/stale timers before the same safe timeout', () => {
    const choosing = deepFreeze(start(31));
    for (const index of [-1, 3, 99, NaN]) {
      expect(
        game.reduce(choosing, {
          type: 'input',
          now: T0 + 1,
          playerId: choosing.drawer,
          input: { type: 'choose', index },
        }),
      ).toBe(choosing);
    }
    for (const event of [
      {
        type: 'timer' as const,
        now: T0 + CHOOSE_MS - 1,
        phaseId: choosing.phase.id,
        startedAt: T0,
      },
      {
        type: 'timer' as const,
        now: T0 + CHOOSE_MS,
        phaseId: choosing.phase.id,
        startedAt: T0 - 1,
      },
    ])
      expect(game.reduce(choosing, event)).toBe(choosing);
    expect(DECKS.easy).toContain(timeout(choosing).word);
  });

  it('keeps all offered words and the timeout answer private until the ordinary reveal', () => {
    const choosing = start(14);
    const drawing = timeout(choosing);
    const tv = game.tvView(drawing);
    expect(tv.answer).toBeUndefined();
    expect(tv).not.toHaveProperty('choices');
    expect(tv).not.toHaveProperty('secret');
    expect(tv.mask).toMatch(/^[_ /]+$/);
    expect(game.controllerView(drawing, drawing.drawer).secret).toBe(drawing.word);
    for (const id of [...choosing.order.filter((id) => id !== choosing.drawer), 'spectator']) {
      expect(game.controllerView(choosing, id).choices).toBeUndefined();
      const view = game.controllerView(drawing, id);
      expect(view.secret).toBeUndefined();
      expect(view.choices).toBeUndefined();
      expect(view.answer).toBeUndefined();
    }
    const revealed = game.reduce(drawing, { type: 'vip', action: 'skip', now: drawing.began + 1 });
    expect(game.tvView(revealed).answer).toBe(drawing.word);
  });
});
