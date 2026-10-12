// Offline input evidence: the production Controller and reducer create the rendered hand.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  PhoneOnlyProvider,
  ServerClockProvider,
  SoundProvider,
  hapticsEnabled,
  setHapticsEnabled,
} from '@partybox/game-sdk/ui';
import type { PlayCue, PlayCueOptions, SoundCue } from '@partybox/game-sdk/ui';
import type { InitContext } from '@partybox/game-sdk';
import { Controller } from '../../../games/tank-trouble/client/Controller';
import { Tv } from '../../../games/tank-trouble/client/Tv';
import { game } from '../../../games/tank-trouble/server/index';
import type { Input } from '../../../games/tank-trouble/server/world';
import { PHASES } from '../../../games/tank-trouble/server/types';
import type { State } from '../../../games/tank-trouble/server/types';
import '../../../design/tokens.css';
import './harness.css';

type Phase = (typeof PHASES)[number];
type FeedbackMode = 'own' | 'survivor' | 'paused';
type FeedbackAction = 'prepare' | 'advance' | 'rerender' | 'next-round' | 'resume' | 'snapshot';
interface SoundRequest {
  cue: SoundCue;
  options?: PlayCueOptions;
}
interface HarnessOptions {
  active: boolean;
  connected: boolean;
  phoneOnly: boolean;
  phase: Phase;
  round: number;
}
declare global {
  interface Window {
    __harnessReady: boolean;
    __sentControls: Input[];
    __lastControl: Input | null;
    __clearSentControls: () => void;
    __setActive: (active: boolean) => void;
    __setPhase: (phase: Phase) => void;
    __setConnected: (connected: boolean) => void;
    __setPhoneOnly: (phoneOnly: boolean) => void;
    __setRound: (round: number) => void;
    __getHarnessOptions: () => HarnessOptions;
    __resetHarness: () => void;
    __feedbackReady: boolean;
    __soundRequests: SoundRequest[];
    __vibrationRequests: (number | number[])[];
    __clearFeedbackRequests: () => void;
    __installFeedbackRecorder: () => { activated: boolean; haptics: boolean };
    __restoreFeedbackRecorder: () => void;
    __feedback: (
      action: FeedbackAction,
      mode?: FeedbackMode,
    ) => ReturnType<typeof feedbackSnapshot>;
  }
}

const startedAt = Date.now();
const names = ['Ana', 'Bo', 'Cleo', 'Dev', 'Elle', 'Finn', 'Gia', 'Hugo'];
const players: InitContext['players'] = names.map((name, index) => ({
  id: `input-seat-${index + 1}`,
  name,
  avatarId: 'cat',
  connected: true,
  canSeeTv: false,
}));
const me = players[0]!;
const initialState = game.init({
  players,
  seed: 2203,
  now: startedAt,
  settings: { powerups: true },
});
const initialView = game.controllerView(initialState, me.id);
const initialOptions: HarnessOptions = {
  active: true,
  connected: true,
  phoneOnly: true,
  phase: 'play',
  round: 1,
};
window.__harnessReady = false;
window.__sentControls = [];
window.__lastControl = null;
window.__feedbackReady = false;
window.__soundRequests = [];
window.__vibrationRequests = [];
window.__clearFeedbackRequests = () => {
  window.__soundRequests.length = 0;
  window.__vibrationRequests.length = 0;
};
window.__clearSentControls = () => {
  window.__sentControls.length = 0;
  window.__lastControl = null;
};
const send = (input: Input): void => {
  const copy = { ...input };
  window.__sentControls.push(copy);
  if (window.__sentControls.length > 500) window.__sentControls.splice(0, 1);
  window.__lastControl = copy;
};

const recordSound: PlayCue = (cue, options) => {
  window.__soundRequests.push({ cue, ...(options ? { options: { ...options } } : {}) });
  if (window.__soundRequests.length > 200) window.__soundRequests.splice(0, 1);
};
let originalVibrate: PropertyDescriptor | undefined;
let recordingVibrate = false;
let originalHaptics = true;
window.__installFeedbackRecorder = () => {
  if (!recordingVibrate) {
    originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
    originalHaptics = hapticsEnabled();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number | number[]) => {
        window.__vibrationRequests.push(Array.isArray(pattern) ? [...pattern] : pattern);
        if (window.__vibrationRequests.length > 200) window.__vibrationRequests.splice(0, 1);
        return true;
      },
    });
    recordingVibrate = true;
  }
  setHapticsEnabled(true);
  return { activated: navigator.userActivation?.hasBeenActive ?? true, haptics: hapticsEnabled() };
};
window.__restoreFeedbackRecorder = () => {
  if (!recordingVibrate) return;
  if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
  else Reflect.deleteProperty(navigator, 'vibrate');
  setHapticsEnabled(originalHaptics);
  recordingVibrate = false;
};

function pendingFeedback(mode: FeedbackMode): State {
  const fresh = game.init({ players, seed: 42, now: Date.now(), settings: { powerups: false } });
  const rival = players[1]!.id;
  const shooter = mode === 'survivor' ? me.id : rival;
  const prepared: State = {
    ...fresh,
    world: {
      ...fresh.world,
      maze: {
        cols: 10,
        rows: 6,
        cell: 16,
        walls: [
          { x1: 0, y1: 0, x2: 160, y2: 0 },
          { x1: 160, y1: 0, x2: 160, y2: 96 },
          { x1: 0, y1: 96, x2: 160, y2: 96 },
          { x1: 0, y1: 0, x2: 0, y2: 96 },
        ],
      },
      tanks: fresh.world.tanks.map((tank) => ({
        ...tank,
        ...(tank.id === me.id ? { x: 24, y: 24, angle: 0 } : {}),
        ...(tank.id === rival ? { x: 48, y: 24, angle: Math.PI } : {}),
        alive: tank.id === me.id || tank.id === rival,
        died: tank.id === me.id || tank.id === rival ? null : 0,
      })),
    },
  };
  const firing = game.reduce(prepared, {
    type: 'input',
    playerId: shooter,
    now: prepared.began + 700,
    input: { type: 'control', drive: 0, turn: 0, fire: true },
  });
  // Real physics creates the 720 ms shell and advances it nineteen samples to the pending hit.
  return game.reduce(firing, {
    type: 'timer',
    phaseId: firing.phase.id,
    startedAt: firing.phase.startedAt,
    now: firing.began + 1080,
  });
}

function feedbackSnapshot(state: State) {
  const hand = game.controllerView(state, me.id);
  return {
    phase: state.phase.id,
    round: state.round,
    checked: state.checked,
    paused: !!state.phase.paused,
    alive: hand.alive,
    participating: hand.participating,
    aliveCount: game.tvView(state).aliveCount,
    left: [...state.left],
    winnerIds: [...state.winnerIds],
    bullets: state.world.bullets.map(({ owner, born, x, y }) => ({ owner, born, x, y })),
  };
}

function Harness(): JSX.Element {
  const [options, setOptions] = useState<HarnessOptions>({ ...initialOptions });
  const [feedbackState, setFeedbackState] = useState<State | null>(null);
  const feedback = useRef<State | null>(null);
  const feedbackMode = useRef<FeedbackMode>('own');
  useEffect(() => {
    const set = (patch: Partial<HarnessOptions>): void => {
      flushSync(() => setOptions((current) => ({ ...current, ...patch })));
    };
    window.__setActive = (active) => set({ active });
    window.__setConnected = (connected) => set({ connected });
    window.__setPhoneOnly = (phoneOnly) => set({ phoneOnly });
    window.__setRound = (round) => set({ round });
    window.__setPhase = (phase) => {
      if (!(PHASES as readonly string[]).includes(phase))
        throw new Error(`Unknown phase: ${phase}`);
      set({ phase });
    };
    window.__resetHarness = () => {
      feedback.current = null;
      flushSync(() => {
        setOptions({ ...initialOptions });
        setFeedbackState(null);
      });
      window.__clearSentControls();
    };
    window.__feedback = (action, mode = 'own') => {
      if (action === 'prepare') {
        feedbackMode.current = mode;
        feedback.current = pendingFeedback(mode);
        flushSync(() => {
          setOptions({ ...initialOptions });
          setFeedbackState(feedback.current);
        });
      } else {
        const state = feedback.current;
        if (!state) throw new Error('Prepare a feedback scenario first.');
        let next = state;
        if (action === 'advance') {
          if (feedbackMode.current === 'paused') {
            next = game.reduce(state, {
              type: 'vip',
              action: 'pause',
              now: state.began + state.checked,
            });
            next = game.reduce(next, {
              type: 'player',
              playerId: me.id,
              connected: false,
              gone: 'left',
              now: state.began + state.checked,
            });
          } else {
            next = game.reduce(state, {
              type: 'timer',
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt,
              now: state.phase.deadline!,
            });
          }
        } else if (action === 'rerender') {
          next = { ...state };
        } else if (action === 'next-round') {
          if (state.phase.id !== 'score') throw new Error('Next-round needs a real Score state.');
          next = game.reduce(state, {
            type: 'timer',
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt,
            now: state.phase.deadline!,
          });
          if (next.phase.id === 'ready')
            next = game.reduce(next, {
              type: 'timer',
              phaseId: next.phase.id,
              startedAt: next.phase.startedAt,
              now: next.phase.deadline!,
            });
        } else if (action === 'resume') {
          next = game.reduce(state, {
            type: 'vip',
            action: 'resume',
            now: (state.phase.paused?.at ?? state.began + state.checked) + 100,
          });
        }
        if (action !== 'snapshot') {
          feedback.current = next;
          flushSync(() => setFeedbackState(next));
        }
      }
      return feedbackSnapshot(feedback.current!);
    };
    window.__feedbackReady = true;
    window.__harnessReady = true;
    return () => {
      window.__harnessReady = false;
      window.__feedbackReady = false;
    };
  }, []);
  window.__getHarnessOptions = () => ({ ...options });
  const view = feedbackState
    ? {
        ...game.controllerView(feedbackState, me.id),
        vip: me.id,
        contentLang: 'en' as const,
      }
    : {
        ...initialView,
        vip: me.id,
        contentLang: 'en' as const,
        phaseId: options.phase,
        round: options.round,
        paused: !options.active,
        ...(options.active ? {} : { clockHeldAt: startedAt }),
        // Keep this real play view usable while the owner dispatches input; no game timers run.
        deadline: startedAt + 3600000,
        players: initialView.players.map((seat) =>
          seat.id === me.id ? { ...seat, connected: options.connected } : seat,
        ),
      };
  const feedbackNow = feedbackState
    ? (feedbackState.phase.paused?.at ??
      (feedbackState.phase.id === 'play'
        ? feedbackState.began + feedbackState.checked
        : feedbackState.phase.startedAt))
    : 0;
  return (
    <SoundProvider play={recordSound}>
      <ServerClockProvider offsetMs={feedbackState ? feedbackNow - Date.now() : 0}>
        <PhoneOnlyProvider value={options.phoneOnly}>
          <main className="evidence-main" aria-label="Offline Tank Trouble controller">
            <Controller view={view} me={me} send={send} />
          </main>
        </PhoneOnlyProvider>
        <div hidden aria-hidden="true">
          <Tv view={{ ...game.tvView(feedbackState ?? initialState), vip: me.id }} />
        </div>
      </ServerClockProvider>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
