// The bot every harness uses (contract suite, sim, e2e). Picks the right answer half the time —
// less for an easy bot, most of the time for a sharp one (ADR-059) — wagers a random allowed option,
// and stays quiet otherwise. Randomness comes from the given rng.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { questionById } from './content';
import { classicBotChoiceIndex } from './classic';
import { wagerOptions } from './scoring';
import { isParticipating, quizModeOf } from './types';
import type { Input, State } from './types';

/** How often a bot knows the answer, by the room's bot skill (normal: the harnesses' half). */
export const BOT_CORRECT_PROBABILITY: Readonly<Record<BotSkill, number>> = {
  easy: 0.3,
  normal: 0.5,
  sharp: 0.8,
};
const CHOICE_INDICES = [0, 1, 2, 3] as const;

export function sampleInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    !isParticipating(state, playerId) ||
    !state.players[playerId]?.connected ||
    state.phase.paused
  )
    return null;
  if (state.phase.id === 'question' && !Object.hasOwn(state.picks, playerId)) {
    const question = questionById(state.questionIds[state.index] ?? '', state.contentLang);
    if (quizModeOf(state) === 'classic') {
      if (!question) return null;
      const known = classicBotChoiceIndex(question.id, question.question, question.choices);
      const index =
        known >= 0 && rng.chance(BOT_CORRECT_PROBABILITY[skill])
          ? known
          : rng.pick(known >= 0 ? CHOICE_INDICES.filter((i) => i !== known) : CHOICE_INDICES);
      return {
        type: 'answer',
        index,
        questionId: question.id,
        questionStartedAt: state.phase.startedAt,
      };
    }
    if (!question) return { type: 'pick', index: rng.pick(CHOICE_INDICES) };
    if (rng.chance(BOT_CORRECT_PROBABILITY[skill]))
      return { type: 'pick', index: question.answerIndex };
    const wrong = CHOICE_INDICES.filter((i) => i !== question.answerIndex);
    return { type: 'pick', index: rng.pick(wrong) };
  }
  if (state.phase.id === 'wager' && !Object.hasOwn(state.wagers, playerId)) {
    const option = rng.pick(wagerOptions(state.scores[playerId] ?? 0));
    return { type: 'wager', percent: option.percent };
  }
  return null;
}
