// Honest solver: candidates follow only the requesting player's observed letter clues.
import { compareCodeUnits, hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { ANSWERS } from './content';
import { feedback } from './letters';
import { finished } from './types';
import type { Guess, Input, State } from './types';

export function candidates(history: readonly Guess[]): string[] {
  return ANSWERS.filter(
    (word) =>
      !history.some((guess) => guess.word === word) &&
      history.every((guess) =>
        feedback(guess.word, word).every((mark, index) => mark === guess.marks[index]),
      ),
  );
}

function frequencyOrder(words: readonly string[]): string[] {
  const frequency: Record<string, number> = {};
  for (const word of words)
    for (const letter of new Set(word)) frequency[letter] = (frequency[letter] ?? 0) + 1;
  const scored = words.map((word) => ({
    word,
    value: [...new Set(word)].reduce((sum, letter) => sum + (frequency[letter] ?? 0), 0),
  }));
  return scored
    .sort((a, b) => b.value - a.value || compareCodeUnits(a.word, b.word))
    .map((row) => row.word);
}

/** Expected remaining candidates after this probe (equal prior over the public answer pool). */
function partitionCost(probe: string, words: readonly string[]): number {
  const groups: Record<string, number> = {};
  for (const word of words) {
    const key = feedback(probe, word)
      .map((mark) => (mark === 'correct' ? '2' : mark === 'present' ? '1' : '0'))
      .join('');
    groups[key] = (groups[key] ?? 0) + 1;
  }
  return Object.values(groups).reduce((sum, count) => sum + count * count, 0);
}

function bestProbes(ordered: readonly string[], possible: readonly string[]): string[] {
  const probes = ordered
    .slice(0, 12)
    .map((word) => ({ word, cost: partitionCost(word, possible) }));
  const minimum = Math.min(...probes.map((probe) => probe.cost));
  return probes.filter((probe) => probe.cost === minimum).map((probe) => probe.word);
}

// Immutable public-dictionary analysis, never a cache of game state or a hidden solution.
const INITIAL_ORDER = Object.freeze(frequencyOrder(ANSWERS));
const INITIAL_PROBES = Object.freeze(bestProbes(INITIAL_ORDER, ANSWERS));

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'guess' || state.phase.paused || !hasPlayer(state, playerId)) return null;
  const entry = state.entries[playerId];
  if (!entry || finished(entry) || state.players[playerId]?.connected !== true) return null;
  if (entry.guesses.length === 0)
    return {
      type: 'guess',
      word:
        skill === 'easy'
          ? rng.pick(ANSWERS)
          : skill === 'sharp'
            ? rng.pick(INITIAL_PROBES)
            : INITIAL_ORDER[0]!,
      round: state.round,
    };
  const possible = candidates(entry.guesses);
  if (possible.length === 0) return null;
  if (skill === 'easy') return { type: 'guess', word: rng.pick(possible), round: state.round };
  const ordered = frequencyOrder(possible);
  if (skill === 'normal' || possible.length <= 2)
    return { type: 'guess', word: ordered[0]!, round: state.round };
  // Twelve strong probes cap work on a crowded eight-seat room; no search through secret state.
  return { type: 'guess', word: rng.pick(bestProbes(ordered, possible)), round: state.round };
}
