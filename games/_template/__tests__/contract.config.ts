// Optional hints for the shared contract suite (packages/game-sdk/src/contract-tests).
// hiddenFromTv: strings that must not appear anywhere in tvView(state) except players[] — here, the
// answers before the reveal. hiddenFromController(state, viewer): strings that must not appear in
// that viewer's phone view — exclude what the viewer legitimately sees (their own answer, their own
// id: `me.id` is always present). For numeric secrets (indices, amounts) list the KEY names you
// omit from the view instead of values; the suite matches substrings ≥ 3 characters.
import type { GameStateBase } from '@partybox/game-sdk';
import type { State } from '../server/types';

export const contractConfig = {
  hiddenFromTv: (state: GameStateBase): string[] =>
    state.phase.id === 'answer' ? Object.values((state as State).answers) : [],
  // Other players' answers — except one identical to my own, which I legitimately see.
  hiddenFromController: (state: GameStateBase, playerId: string): string[] => {
    const answers = (state as State).answers;
    return Object.entries(answers)
      .filter(([id, text]) => id !== playerId && text !== answers[playerId])
      .map(([, text]) => text);
  },
  settingsVariants: [{ answerSeconds: 10 }],
};
