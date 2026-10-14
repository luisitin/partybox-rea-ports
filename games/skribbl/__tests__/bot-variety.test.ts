import { describe, expect, it } from 'vitest';
import { createRng, seedRng, shuffle } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { DECKS } from '../server/content';
import { BOT_ART } from '../server/pictures';
import type { State } from '../server/types';
import { T0 } from './helpers';

const difficulties = ['easy', 'medium', 'hard'] as const;
const seeds = [1, 2, 3, 42, 777];

/** The old chooser had only the first twelve pictograms in each original word pack. */
function legacyChoices(state: State, rng: State['rng']): State {
  const oldArtWords = DECKS[state.settings.difficulty]!.slice(0, 12);
  const unused = oldArtWords.filter((word) => !state.used.includes(word));
  const [deck, nextRng] = shuffle(rng, unused.length >= 3 ? unused : oldArtWords);
  return { ...state, rng: nextRng, choices: deck.slice(0, 3) };
}

/** Exercise complete two-lap bot parties; the baseline replaces only the old private chooser. */
function party(difficulty: string, seed: number, legacy = false): State {
  const players = testPlayers(8, { bots: 8 });
  const bots = createRng(seed ^ 0x04da7);
  let state = game.init({
    players,
    settings: { difficulty, laps: 2, drawSeconds: 60 },
    seed,
    now: T0,
  });
  if (legacy) {
    const [, rngAfterRotation] = shuffle(
      seedRng(seed),
      players.map((player) => player.id),
    );
    state = legacyChoices(state, rngAfterRotation);
  }
  const checkChoices = (): void => {
    if (state.phase.id !== 'choose') return;
    expect(state.choices).toHaveLength(3);
    if (!legacy) for (const word of state.choices) expect(state.used).not.toContain(word);
  };
  checkChoices();
  let now = T0;
  const cap = T0 + game.manifest.estimatedMinutes * 2 * 60_000;
  while (state.phase.id !== 'done' && now < cap) {
    now += 1000;
    if (state.phase.deadline !== null && state.phase.deadline <= now) {
      const before = state;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      if (legacy && before.phase.id === 'reveal' && state.phase.id === 'choose')
        state = legacyChoices(state, before.rng);
      checkChoices();
    }
    for (const player of bots.shuffle(players)) {
      const input = game.bot.sampleInput(state, player.id, bots, 'sharp');
      if (input) state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
    }
  }
  expect(state.phase.id).toBe('done');
  expect(state.used).toHaveLength(16);
  expect(game.results(state)?.ranking).toHaveLength(8);
  return state;
}

describe('original bot picture variety', () => {
  it('has eighteen valid original pictures in every deck, enough for sixteen distinct turns', () => {
    expect(Object.keys(BOT_ART)).toHaveLength(54);
    for (const difficulty of difficulties) {
      const pictures = DECKS[difficulty]!.filter((word) => Object.hasOwn(BOT_ART, word));
      expect(pictures).toHaveLength(18);
      for (const word of pictures)
        for (const stroke of BOT_ART[word]!)
          expect(game.inputSchema.safeParse({ type: 'stroke', stroke }).success, word).toBe(true);
    }
  });

  it.each(difficulties)(
    'eliminates selected-word repeats in eight-bot two-lap %s parties',
    (deck) => {
      const metrics = seeds.map((seed) => {
        const before = party(deck, seed, true);
        const after = party(deck, seed);
        const oldRepeats = before.used.length - new Set(before.used).size;
        const newRepeats = after.used.length - new Set(after.used).size;
        expect(oldRepeats).toBeGreaterThanOrEqual(4);
        expect(newRepeats).toBe(0);
        return { seed, before: oldRepeats, after: newRepeats };
      });
      console.info(`Two-lap ${deck} bot repeats: ${JSON.stringify(metrics)}`);
    },
  );
});
