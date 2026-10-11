// Controller (phone) view for Quick Poll: a TextAnswer during "answer", a waiting screen after.
// `send` is the only way out; the server validates with inputSchema before reduce sees it.
import type { JSX } from 'react';
import { TextAnswer, WaitingScreen, usePhoneOnly, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { QuickPollControllerView } from '../server/index';
import type { Input } from '../server/types';
import { STRINGS } from './strings';

export function Controller({
  view,
  send,
}: GameControllerProps<QuickPollControllerView, Input>): JSX.Element {
  // A "phone only" room has no TV to look at (S-005): never point at one there.
  const phoneOnly = usePhoneOnly();
  // Every sentence through L: the phone's language, with its Spanish in ./strings.ts.
  const L = useT(STRINGS);
  if (view.phaseId === 'answer') {
    return (
      <TextAnswer
        kicker="Quick Poll"
        prompt={view.prompt}
        placeholder={L('One word…')}
        maxLength={24}
        submitted={view.submitted}
        promptKey={`${view.phaseId}:${view.deadline ?? ''}`}
        onSubmit={(text) => send({ type: 'answer', text })}
      />
    );
  }
  return (
    <WaitingScreen
      title={
        view.phaseId === 'done'
          ? L('Thanks for playing!')
          : phoneOnly
            ? L('One moment…')
            : L('Look at the TV')
      }
      hint={
        view.myAnswer
          ? L('You said "{answer}"', { answer: view.myAnswer })
          : L('You did not answer this time.')
      }
      mood={view.myAnswer ? 'done' : 'watch'}
    />
  );
}
