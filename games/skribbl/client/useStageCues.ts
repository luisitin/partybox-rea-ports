import { useEffect, useRef } from 'react';
import { useSound } from '@partybox/game-sdk/ui';
import type { DrawTvView } from '../server/types';

/** Public room beats; reconnecting never replays prior solves or old ticks. */
export function useStageCues(view: DrawTvView, seconds: number): void {
  const play = useSound();
  const previous = useRef({
    turn: view.turn,
    solved: view.solvedCount,
    seconds,
    phase: view.phaseId,
  });
  const ticks = useRef({ turn: view.turn, mask: seconds > 0 && seconds <= 5 ? 1 << seconds : 0 });
  useEffect(() => {
    const before = previous.current;
    if (ticks.current.turn !== view.turn || (view.phaseId === 'draw' && before.phase !== 'draw'))
      ticks.current = { turn: view.turn, mask: 0 };
    if (!view.paused && before.turn === view.turn) {
      if (
        before.phase === 'draw' &&
        (view.phaseId === 'draw' || view.phaseId === 'reveal') &&
        view.solvedCount > before.solved
      )
        play('correct');
      if (
        view.phaseId === 'draw' &&
        seconds > 0 &&
        seconds <= 5 &&
        before.seconds !== seconds &&
        (ticks.current.mask & (1 << seconds)) === 0
      ) {
        play('tick', { quiet: true });
        ticks.current.mask |= 1 << seconds;
      }
    }
    previous.current = { turn: view.turn, solved: view.solvedCount, seconds, phase: view.phaseId };
  }, [view.turn, view.solvedCount, view.phaseId, view.paused, seconds, play]);
}
