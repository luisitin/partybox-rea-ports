// Local verification harness: the real controller/reducer with deliberately delayed views.
import { createRoot } from 'react-dom/client';
import {
  DraftScopeProvider,
  PhoneOnlyProvider,
  ServerClockProvider,
  SoundProvider,
} from '@partybox/game-sdk/ui';
import { Controller } from '../../../games/skribbl/client/Controller';
import { Tv } from '../../../games/skribbl/client/Tv';
import { game } from '../../../games/skribbl/server/index';
import type { Input } from '../../../games/skribbl/server/types';
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
let phoneMount = 0;
let clocksHeld = false;
let afterStroke: 'pause' | 'holdClock' | undefined;
let deferGuessToPause = false;
let rejectStrokeToPause = false;
// Freeze only the SDK clock callbacks while CDP delivers a native gesture batch.
// Releasing this harness gate resumes the real intervals; it never manufactures a game tick.
const nativeInterval = window.setInterval.bind(window);
window.setInterval = ((handler: TimerHandler, interval?: number, ...args: unknown[]) =>
  typeof handler === 'function' && (interval === 40 || interval === 250)
    ? nativeInterval(() => {
        if (!clocksHeld) handler(...args);
      }, interval)
    : nativeInterval(handler, interval, ...args)) as typeof window.setInterval;
const cues: string[] = [];
const play = (cue: string) => {
  cues.push(cue);
};
const sent: Input[] = [];
const sentAt: number[] = [];
const root = createRoot(document.getElementById('root')!);
function publish() {
  root.render(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <PhoneOnlyProvider value={true}>
        <SoundProvider play={play}>
          <DraftScopeProvider value={`p04-native:${id}:${state.turn}:${state.phase.id}`}>
            {tv ? (
              <Tv view={{ ...game.tvView(state), vip: null }} />
            ) : (
              <Controller
                key={phoneMount}
                view={{ ...game.controllerView(state, id), vip: null }}
                me={state.players[id]!}
                send={send}
              />
            )}
          </DraftScopeProvider>
        </SoundProvider>
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}
function send(input: Input) {
  sent.push(input);
  sentAt.push(performance.now());
  now += 80;
  if (
    (input.type === 'guess' && deferGuessToPause) ||
    (input.type === 'stroke' && rejectStrokeToPause)
  ) {
    deferGuessToPause = false;
    rejectStrokeToPause = false;
    state = game.reduce(state, { type: 'vip', action: 'pause', now });
  }
  state = game.reduce(state, { type: 'input', playerId: id, input, now });
  if (input.type === 'stroke' && afterStroke) {
    const action = afterStroke;
    afterStroke = undefined;
    if (action === 'pause') state = game.reduce(state, { type: 'vip', action: 'pause', now });
    else clocksHeld = true;
  }
  if (!held) publish();
}
(window as any).p04 = {
  hold(value: boolean) {
    held = value;
  },
  ack() {
    publish();
  },
  advance(milliseconds: number) {
    now += milliseconds;
  },
  info() {
    return {
      sent,
      sentAt,
      strokes: state.strokes,
      revision: state.inkRevision,
      phase: state.phase.id,
      paused: state.phase.paused !== undefined,
      receipt: game.controllerView(state, id).guessReceipt,
      playerId: id,
      drawer: state.drawer,
    };
  },
  holdClocks(value: boolean) {
    clocksHeld = value;
  },
  pauseAfterNextStroke() {
    afterStroke = 'pause';
  },
  holdClocksAfterNextStroke() {
    afterStroke = 'holdClock';
  },
  deferNextGuessToPause() {
    deferGuessToPause = true;
  },
  rejectNextStrokeToPause() {
    rejectStrokeToPause = true;
  },
  artist() {
    id = state.drawer;
    tv = false;
    publish();
  },
  remountPhone() {
    phoneMount++;
    publish();
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
