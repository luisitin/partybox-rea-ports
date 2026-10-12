import { useEffect, useRef } from 'react';
import { useSound } from '@partybox/game-sdk/ui';
import type { MatchView } from './match';

/** A retained goal is already observed on mount; only a fresh public score can cheer. */
export function useGoalCue(view: Pick<MatchView, 'goals' | 'paused'>, enabled: boolean): void {
  const play = useSound();
  const { red, blue } = view.goals;
  const observed = useRef({ red, blue, maximumRed: red, maximumBlue: blue });
  useEffect(() => {
    const previous = observed.current;
    // Consume every score push, including silent devices and paused goal beats.
    // The maxima also prevent a reset/decrease followed by restored scores from
    // replaying a goal already observed during this mounted match.
    observed.current = {
      red,
      blue,
      maximumRed: Math.max(previous.maximumRed, red),
      maximumBlue: Math.max(previous.maximumBlue, blue),
    };
    const increased =
      (red > previous.red && red > previous.maximumRed) ||
      (blue > previous.blue && blue > previous.maximumBlue);
    const decreased = red < previous.red || blue < previous.blue;
    // A horn or delayed catchup can reveal a real goal directly in halftime,
    // done or play. The authoritative score increase confirms it in every phase.
    if (enabled && !view.paused && increased && !decreased) play('cheer');
  }, [red, blue, view.paused, enabled, play]);
}
