// Local verification harness: the real controller/reducer with deliberately delayed views.
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider, SoundProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/draw-and-guess/client/Controller';
import { Tv } from '../../../games/draw-and-guess/client/Tv';
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
let tv = false;
const cues: string[] = [];
const play = (cue: string) => {
  cues.push(cue);
};
const sent: Input[] = [];
const root = createRoot(document.getElementById('root')!);
function publish() {
  root.render(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <PhoneOnlyProvider value={true}>
        <SoundProvider play={play}>
          {tv ? (
            <Tv view={game.tvView(state)} />
          ) : (
            <Controller view={game.controllerView(state, id)} me={state.players[id]!} send={send} />
          )}
        </SoundProvider>
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
  tv() {
    tv = true;
    publish();
  },
  cues() {
    return cues;
  },
  solveAnother() {
    const playerId = players.find(
      (p) => p.id !== state.drawer && !Object.hasOwn(state.solved, p.id),
    )!.id;
    state = game.reduce(state, {
      type: 'input',
      playerId,
      input: { type: 'guess', text: state.word },
      now: (now += 1000),
    });
    publish();
  },
  seconds(value: number) {
    now = state.endsAt - value * 1000;
    state = { ...state, clock: now };
    publish();
  },
  pause(value: boolean) {
    state = game.reduce(state, { type: 'vip', action: value ? 'pause' : 'resume', now });
    publish();
  },
};
publish();
