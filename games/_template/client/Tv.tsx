// TV view for Quick Poll. Dumb component: renders `view`, composes game-sdk primitives, never
// touches sockets or game logic. The shell already shows the timer and player chips.
import type { JSX } from 'react';
import { BigText, Reveal, Stage, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { QuickPollTvView } from '../server/index';
import { STRINGS } from './strings';

export function Tv({ view }: GameTvProps<QuickPollTvView>): JSX.Element {
  const L = useT(STRINGS);
  if (view.phaseId === 'answer') {
    return (
      <Stage center>
        <BigText level="display">{view.prompt}</BigText>
        <BigText level="h2" tone="muted">
          {L('{answered} / {total} answered', {
            answered: view.answeredCount,
            total: view.totalCount,
          })}
        </BigText>
      </Stage>
    );
  }
  return (
    <Stage>
      <BigText level="h2" tone="muted">
        {view.prompt}
      </BigText>
      <Reveal
        items={view.answers.map((a) => ({ id: a.playerId, text: a.text, detail: a.name }))}
        stepMs={view.phaseId === 'done' ? 0 : 500}
      />
      {view.phaseId === 'done' ? <BigText tone="accent">{L("That's the poll!")}</BigText> : null}
    </Stage>
  );
}
