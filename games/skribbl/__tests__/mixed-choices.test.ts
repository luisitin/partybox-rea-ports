import { describe, expect, it } from 'vitest';
import { seedRng, shuffle } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { DECKS, WORDS } from '../server/content';
import { enterChoose } from '../server/phases/choose';
import { BOT_ART } from '../server/pictures';
import { deepFreeze, T0 } from './helpers';

const tiers = ['easy', 'medium', 'hard'] as const;
const tierOf = (word: string): string => tiers.find((tier) => DECKS[tier]!.includes(word))!;

function start(seed: number, bots: boolean, difficulty = 'mixed') {
  return game.init({
    players: testPlayers(8, { bots: bots ? 8 : 0 }),
    settings: { difficulty, laps: 2, drawSeconds: 30 },
    seed,
    now: T0,
  });
}

function previousHand(seed: number, bots: boolean, difficulty = 'mixed') {
  const players = testPlayers(8, { bots: bots ? 8 : 0 });
  const [, afterRotation] = shuffle(
    seedRng(seed),
    players.map((player) => player.id),
  );
  const words = difficulty === 'mixed' ? WORDS : DECKS[difficulty]!;
  const pool = words.filter((word) => !bots || Object.hasOwn(BOT_ART, word));
  const [deck, rng] = shuffle(afterRotation, pool);
  return { choices: deck.slice(0, 3), rng };
}

describe('balanced private mixed hands', () => {
  it.each([false, true])('removes all-hard deals across 1000 seeds with bots=%s', (bots) => {
    let beforeAllHard = 0;
    let afterAllHard = 0;
    const orders = new Set<string>();
    for (let seed = 1; seed <= 1000; seed++) {
      const before = previousHand(seed, bots);
      const after = start(seed, bots);
      if (before.choices.every((word) => tierOf(word) === 'hard')) beforeAllHard++;
      if (after.choices.every((word) => tierOf(word) === 'hard')) afterAllHard++;
      const dealtTiers = after.choices.map(tierOf);
      expect(dealtTiers.slice().sort()).toEqual(tiers.slice().sort());
      expect(new Set(after.choices).size).toBe(3);
      if (bots) for (const word of after.choices) expect(BOT_ART).toHaveProperty(word);
      orders.add(dealtTiers.join('/'));
    }
    expect(beforeAllHard).toBeGreaterThan(0);
    expect(afterAllHard).toBe(0);
    expect(orders.size).toBe(6);
    console.info(
      `Mixed all-hard deals bots=${bots}: ${beforeAllHard}/1000 -> ${afterAllHard}/1000`,
    );
  });

  it.each([false, true])(
    'preserves single-difficulty hands and RNG exactly with bots=%s',
    (bots) => {
      for (const tier of tiers)
        for (let seed = 1; seed <= 100; seed++) {
          const previous = previousHand(seed, bots, tier);
          const current = start(seed, bots, tier);
          expect(current.choices).toEqual(previous.choices);
          expect(current.rng).toEqual(previous.rng);
        }
    },
  );

  it.each([false, true])(
    'keeps all sixteen turns fresh even when every artist picks easy, bots=%s',
    (bots) => {
      let state = start(42, bots);
      for (let turn = 0; turn < 16; turn++) {
        expect(state.phase.id).toBe('choose');
        expect(state.choices.map(tierOf).sort()).toEqual(tiers.slice().sort());
        for (const word of state.choices) {
          expect(state.used).not.toContain(word);
          if (bots) expect(BOT_ART).toHaveProperty(word);
        }
        const index = state.choices.findIndex((word) => tierOf(word) === 'easy');
        state = game.reduce(state, {
          type: 'input',
          playerId: state.drawer,
          input: { type: 'choose', index },
          now: state.phase.startedAt + 1,
        });
        state = game.reduce(state, { type: 'vip', action: 'skip', now: state.began + 1 });
        state = game.reduce(state, {
          type: 'timer',
          now: state.phase.deadline!,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt,
        });
      }
      expect(state.phase.id).toBe('done');
      expect(state.used).toHaveLength(16);
      expect(new Set(state.used).size).toBe(16);
    },
  );

  it('is pure and seeded, and changing private choices does not change any public view', () => {
    const state = deepFreeze(start(77, false));
    const before = JSON.stringify(state);
    const next = enterChoose(state, T0 + 10_000, 1);
    expect(enterChoose(state, T0 + 10_000, 1)).toEqual(next);
    expect(JSON.stringify(state)).toBe(before);
    expect(start(77, false)).toEqual(state);
    expect(game.controllerView(next, next.drawer).choices).toEqual(next.choices);
    const changed = { ...next, choices: ['privateone', 'privatetwo', 'privatethree'] };
    expect(game.tvView(changed)).toEqual(game.tvView(next));
    for (const id of [...next.order.filter((id) => id !== next.drawer), 'spectator']) {
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(next, id));
      expect(game.controllerView(next, id).choices).toBeUndefined();
    }
  });
});
