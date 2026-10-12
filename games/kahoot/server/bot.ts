// An authored knowledge vocabulary, not the shuffled answer key. Skill controls confidence.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import knowledge from '../content/knowledge.json' with { type: 'json' };
import teamKnowledge from '../content/team-knowledge.json' with { type: 'json' };
import { publicQuestion } from './content';
import type { Input, State } from './types';

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'question' ||
    state.phase.paused ||
    !hasPlayer(state, playerId) ||
    !state.players[playerId]!.connected ||
    state.left.includes(playerId) ||
    Object.hasOwn(state.answers, playerId)
  )
    return null;
  const q = publicQuestion(state);
  const facts: Record<string, string> = { ...knowledge, ...teamKnowledge };
  const known = q.options.indexOf(Object.hasOwn(facts, q.id) ? facts[q.id]! : '');
  const confidence = skill === 'sharp' ? 0.94 : skill === 'easy' ? 0.35 : 0.7;
  // Judge complexity from the public wording, not private pack metadata.
  const difficulty = q.prompt.length > 70 ? 3 : q.prompt.length > 50 ? 2 : 1;
  const trust = confidence - (difficulty - 1) * 0.1;
  if (!rng.chance(skill === 'sharp' ? 0.9 : skill === 'easy' ? 0.35 : 0.65)) return null;
  const choice = known >= 0 && rng.chance(trust) ? known : rng.int(0, 3);
  return { type: 'answer', round: state.round, choice };
}
