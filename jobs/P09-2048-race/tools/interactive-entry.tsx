// Capture-only room harness: real Controller, views and reducer; no network.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/2048/client/Controller';
import { game } from '../../../games/2048/server';
import type { Input, State } from '../../../games/2048/server/types';

const initial = JSON.parse(document.getElementById('capture-state')!.textContent!) as State;
if (new URLSearchParams(location.search).has('target')) {
  initial.racers.p1 = {
    ...initial.racers.p1!,
    board: [1024, 1024, ...Array<number>(14).fill(0)],
    score: 0,
    moves: 0,
  };
}
const offset = 40000 - Date.now();
function Room() {
  const [state, setState] = useState(initial);
  const send = (input: Input) =>
    flushSync(() =>
      setState((current) =>
        game.reduce(current, { type: 'input', playerId: 'p1', now: Date.now() + offset, input }),
      ),
    );
  return (
    <ServerClockProvider offsetMs={offset}>
      <PhoneOnlyProvider value={false}>
        <Controller
          view={{ ...game.controllerView(state, 'p1'), vip: null }}
          me={{ id: 'p1', name: 'You', avatarId: 'fox' }}
          send={send}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}
createRoot(document.getElementById('game-frame')!).render(<Room />);
