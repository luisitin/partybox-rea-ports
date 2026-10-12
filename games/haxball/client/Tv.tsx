import type { JSX } from 'react';
import { Stage, useServerNow } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { HaxballTvView } from '../server/index';
import { MatchStage } from './MatchStage';
import { useGoalCue } from './useGoalCue';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<HaxballTvView>): JSX.Element {
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  useGoalCue(view, true);
  return (
    <Stage className={styles.stage}>
      <MatchStage view={view} now={now} />
      <p className={styles.help}>
        {view.phaseId === 'done'
          ? 'Final team scores · every jersey stays with its team'
          : view.phaseId === 'play'
            ? 'Hold arrows to move · hold Kick near the ball · release to kick again'
            : 'Controls rest between plays · watch the pitch'}
      </p>
    </Stage>
  );
}
