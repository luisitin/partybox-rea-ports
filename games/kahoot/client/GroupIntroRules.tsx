// One public rule sentence makes the selected group format clear before the first discussion.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { STRINGS } from './strings';
import styles from './Group.module.css';

export function GroupIntroRules({
  group,
}: {
  group: NonNullable<LightningTvView['group']>;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <p className={styles.rule} data-group-intro-rules={group.mode}>
      {L(
        group.mode === 'teams'
          ? 'Everyone answers; team points are the average, and nobody is eliminated.'
          : 'Everyone votes for one shared answer and score; nobody is eliminated.',
      )}
    </p>
  );
}
