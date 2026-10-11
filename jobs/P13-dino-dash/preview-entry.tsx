// Live controller verification harness: all game events use its explicit synthetic server clock.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/dino-dash/client/Controller';
import { game } from '../../games/dino-dash/server/index';
import type { State } from '../../games/dino-dash/server/types';
import type { Input } from '../../games/dino-dash/server/world';

interface RecordedInput {
  now: number;
  input: Input;
  phase: string;
  accepted: boolean;
}
interface Snapshot {
  state: State;
  now: number;
  inputs: RecordedInput[];
}
interface Harness {
  snapshot: () => Snapshot;
  reset: () => void;
  clearInputs: () => void;
  advance: (ms: number) => void;
  pause: () => void;
  resume: () => void;
  drop: () => void;
  rejoin: () => void;
  skip: () => void;
  inputFor: (id: string, input: Input) => void;
  setFixture: (state: State, viewer?: string) => void;
}
declare global {
  interface Window {
    dinoHarness: Harness;
  }
}

const players = Array.from({ length: 8 }, (_, n) => ({
  id: `p${n + 1}`,
  name: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'][n]!,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
let now = 1_000_000;
let state = game.init({
  players,
  settings: { rounds: 3 },
  seed: 14,
  now,
  presence: { mode: 'together', phoneOnly: true },
});
let viewer = 'p1';
let generation = 0;
let inputs: RecordedInput[] = [];
let update: (() => void) | undefined;
const push = (): void => {
  update?.();
};
function inputFor(id: string, input: Input): void {
  const before = state;
  state = game.reduce(state, { type: 'input', now, playerId: id, input });
  inputs.push({ now, input, phase: before.phase.id, accepted: before !== state });
  push();
}
const vip = (action: 'pause' | 'resume' | 'skip'): void => {
  state = game.reduce(state, { type: 'vip', now, action });
  push();
};
const playerEvent = (connected: boolean): void => {
  state = game.reduce(state, { type: 'player', now, playerId: viewer, connected });
  push();
};

window.dinoHarness = {
  snapshot: () => structuredClone({ state, now, inputs }),
  clearInputs: () => {
    inputs = [];
  },
  reset: () => {
    generation++;
    now = 1_000_000;
    viewer = 'p1';
    inputs = [];
    state = game.init({
      players,
      settings: { rounds: 3 },
      seed: 14,
      now,
      presence: { mode: 'together', phoneOnly: true },
    });
    push();
  },
  advance: (ms) => {
    const target = now + Math.max(0, ms);
    let count = 0;
    while (
      !state.phase.paused &&
      state.phase.deadline !== null &&
      state.phase.deadline <= target &&
      state.phase.id !== 'done' &&
      count++ < 10000
    ) {
      now = state.phase.deadline;
      const before = state;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      if (state === before) break;
    }
    now = target;
    push();
  },
  pause: () => vip('pause'),
  resume: () => vip('resume'),
  drop: () => playerEvent(false),
  rejoin: () => playerEvent(true),
  skip: () => vip('skip'),
  inputFor,
  setFixture: (next, id = 'p1') => {
    generation++;
    state = structuredClone(next);
    viewer = id;
    now = state.phase.paused?.at ?? state.began + state.world.checked;
    inputs = [];
    push();
  },
};

function Preview(): JSX.Element {
  const [, redraw] = useState(0);
  useEffect(() => {
    update = () => redraw((n) => n + 1);
    return () => {
      update = undefined;
    };
  }, []);
  const view = { ...game.controllerView(state, viewer), vip: null };
  return (
    <ServerClockProvider offsetMs={now - Date.now()}>
      <PhoneOnlyProvider value={state.phoneOnly}>
        <div className="capture-shell">
          <header className="capture-header">
            <b>PartyBox</b>
            <span>Dino Dash · live controls</span>
          </header>
          <main id="game-viewport">
            <Controller
              key={`${generation}:${viewer}:${state.round}`}
              view={view}
              me={state.players[viewer] ?? { id: viewer, name: 'Spectator', avatarId: 'owl' }}
              send={(input) => inputFor(viewer, input)}
            />
          </main>
          <footer className="capture-footer" />
        </div>
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}

const container = document.getElementById('preview-root');
if (!container) throw new Error('Preview root is missing');
createRoot(container).render(<Preview />);
