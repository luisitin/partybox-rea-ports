// Bots see the same mask and sketch as players. Skill controls inference and willingness to try.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { WORDS } from './content';
import { publicMask } from './mask';
import { drawnCategory, sketchFor } from './sketch';
import type { Input, State } from './types';

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (!hasPlayer(state, playerId) || !state.players[playerId]?.connected || state.phase.paused)
    return null;
  const artist = state.drawerId === playerId;
  if (state.phase.id === 'choose' && artist) {
    const best = state.choices.reduce(
      (a, word, i) => (word.text.length < state.choices[a]!.text.length ? i : a),
      0,
    );
    return { type: 'choose', index: skill === 'easy' ? rng.int(0, 2) : best };
  }
  if (state.phase.id !== 'draw') return null;
  if (artist) {
    if (!state.word) return null;
    const lines = sketchFor(state.word);
    const next = state.lastSeq + 1;
    const points = lines[next];
    return points
      ? { type: 'stroke', stroke: { id: next, seq: next, color: 0, size: 5, points } }
      : null;
  }
  if (
    Object.hasOwn(state.solved, playerId) ||
    !rng.chance(skill === 'easy' ? 0.25 : skill === 'sharp' ? 0.95 : 0.65)
  )
    return null;
  const mask = publicMask(state);
  const attempted = Object.hasOwn(state.guesses, playerId) ? state.guesses[playerId]! : [];
  const category = skill === 'easy' ? null : drawnCategory(state.strokes);
  const candidates = WORDS.filter(
    (word) =>
      word.text.length === mask.length &&
      !attempted.includes(word.text) &&
      [...mask].every((letter, i) => letter === '_' || word.text[i] === letter),
  );
  const recognized = category ? candidates.filter((word) => word.category === category) : [];
  const pool = recognized.length ? recognized : candidates;
  return pool.length ? { type: 'guess', text: rng.pick(pool).text } : null;
}
