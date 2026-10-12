import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
import { neutral } from '../types';

export function enterDone(state: State, now: number): State {
  return enterPhase(
    {
      ...state,
      clock: now,
      discs: state.discs.map((disc) => ({ ...disc, vx: 0, vy: 0 })),
      ball: { ...state.ball, vx: 0, vy: 0 },
      intents: Object.fromEntries(
        Object.entries(state.intents).map(([id, intent]) => [id, neutral(intent)]),
      ),
    },
    'done',
    now,
    null,
  );
}
