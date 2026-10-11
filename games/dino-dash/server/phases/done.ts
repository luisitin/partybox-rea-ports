import { enterPhase } from '@partybox/game-sdk';
import type { State } from '../types';
export const enterDone = (state: State, now: number): State => enterPhase(state, 'done', now, null);
