// Hints for the shared contract suite (packages/game-sdk/src/contract-tests). The suite checks that
// none of the returned strings appears in the JSON of a view. Lightning Round's secrets are
// positions and amounts (numbers), so what must stay out of a view is the KEY that would carry
// them: `correctIndex` and `pickIndex` before the reveal, `wagerAmount` before the final reveal.
// server/views.ts therefore omits those keys instead of setting them to null.
import type { GameStateBase } from '@partybox/game-sdk';
import type { State } from '../server/types';

function finalPending(state: State): boolean {
  const final = state.index === state.questionIds.length - 1;
  return state.phase.id === 'wager' || (state.phase.id === 'question' && final);
}

export const contractConfig = {
  hiddenFromTv: (base: GameStateBase): string[] => {
    const state = base as State;
    const hidden: string[] = [];
    if (state.phase.id === 'question')
      hidden.push('correctIndex', 'pickIndex', 'answerDistribution');
    if (finalPending(state)) hidden.push('wagerAmount');
    return hidden;
  },
  hiddenFromController: (base: GameStateBase, _playerId: string): string[] => {
    // Own values travel under `myPickIndex` / `myWagerAmount` (different key names by design).
    const state = base as State;
    const hidden: string[] = [];
    if (state.phase.id === 'question')
      hidden.push('correctIndex', 'pickIndex', 'answerDistribution');
    if (finalPending(state)) hidden.push('wagerAmount');
    return hidden;
  },
  settingsVariants: [
    { questions: 5, answerSeconds: 5 },
    { category: 'stem' },
    { category: 'sports', subcategories: 'basketball,soccer' },
  ],
};
