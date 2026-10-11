// Artists draw original pictograms. Guessers read only public ink, mask and their own history.
import { hasPlayer } from '@partybox/game-sdk';
import type { Rng, BotSkill } from '@partybox/game-sdk';
import { WORDS } from './content';
import { maskedWord } from './phases/draw';
import { BOT_ART } from './pictures';
import type { Input, State, Stroke } from './types';
function recognized(strokes: Stroke[]): string | null {
  for (const [word, picture] of Object.entries(BOT_ART)) {
    if (picture.length !== strokes.length) continue;
    if (picture.every((s, i) => JSON.stringify(s.points) === JSON.stringify(strokes[i]?.points)))
      return word;
  }
  return null;
}
export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    !hasPlayer(state, id) ||
    !state.players[id]?.connected ||
    state.left.includes(id) ||
    state.phase.paused
  )
    return null;
  if (state.phase.id === 'choose' && id === state.drawer) {
    const options = state.choices.map((word, index) => ({
      word,
      index,
      lines: BOT_ART[word]?.length ?? 999,
    }));
    options.sort((a, b) => a.lines - b.lines || a.word.length - b.word.length);
    return { type: 'choose', index: skill === 'easy' ? rng.int(0, 2) : (options[0]?.index ?? 0) };
  }
  if (state.phase.id !== 'draw') return null;
  if (id === state.drawer) {
    const stroke = BOT_ART[state.word]?.[state.strokes.length];
    return stroke ? { type: 'stroke', stroke: structuredClone(stroke) } : null;
  }
  if (Object.hasOwn(state.solved, id)) return null;
  const delay = skill === 'easy' ? 8000 : skill === 'sharp' ? 2000 : 4000;
  if (
    state.clock - state.began < delay ||
    state.clock - (state.lastGuessAt[id] ?? state.began) < delay
  )
    return null;
  const tried = state.guesses[id] ?? [];
  const seen = maskedWord(state)
    .split(' / ')
    .map((part) => part.split(' ').join(''))
    .join(' ');
  const match = new RegExp(`^${seen.replace(/_/g, '[a-z]')}$`);
  const candidates = WORDS.filter((word) => match.test(word) && !tried.includes(word));
  const picture = skill === 'easy' ? null : recognized(state.strokes);
  const text =
    picture && candidates.includes(picture) && (skill === 'sharp' || rng.float() < 0.65)
      ? picture
      : candidates.length
        ? rng.pick(candidates)
        : null;
  return text ? { type: 'guess', text } : null;
}
