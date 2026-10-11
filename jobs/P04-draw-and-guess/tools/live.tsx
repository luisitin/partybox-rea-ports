// Local verification harness: the real controller/reducer with deliberately delayed views.
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/draw-and-guess/client/Controller';
import { game } from '../../../games/draw-and-guess/server/index';
import type { Input } from '../../../games/draw-and-guess/server/types';
import '../../../design/tokens.css';

const players = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: ['Avery', 'Blake', 'Casey', 'Devon', 'Ellis', 'Frankie', 'Gray', 'Harper'][i]!,
  avatarId: 'fox',
  connected: true,
}));
let now = Date.now();
let state = game.init({
  players,
  settings: { laps: 1, drawSeconds: 60, difficulty: 'easy' },
  seed: 44,
  now,
});
state = game.reduce(state, {
  type: 'input',
  playerId: state.drawer,
  input: { type: 'choose', index: 0 },
  now: ++now,
});
let id = state.drawer;
let held = false;
const sent: Input[] = [];
const root = createRoot(document.getElementById('root')!);
function publish() {
  root.render(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <PhoneOnlyProvider value={true}>
        <Controller view={game.controllerView(state, id)} me={state.players[id]!} send={send} />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}
function send(input: Input) {
  sent.push(input);
  state = game.reduce(state, { type: 'input', playerId: id, input, now: (now += 80) });
  if (!held) publish();
}
(window as any).p04 = {
  hold(value: boolean) {
    held = value;
  },
  ack() {
    publish();
  },
  info() {
    return { sent, strokes: state.strokes, revision: state.inkRevision, phase: state.phase.id };
  },
  guesser() {
    id = players.find((p) => p.id !== state.drawer)!.id;
    publish();
  },
  solve() {
    send({ type: 'guess', text: state.word });
  },
};
publish();
