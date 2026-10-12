// Offline input evidence: the production Controller and reducer create the rendered hand.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { InitContext } from '@partybox/game-sdk';
import { Controller } from '../../../games/tank-trouble/client/Controller';
import { game } from '../../../games/tank-trouble/server/index';
import type { Input } from '../../../games/tank-trouble/server/world';
import { PHASES } from '../../../games/tank-trouble/server/types';
import '../../../design/tokens.css';
import './harness.css';

type Phase = (typeof PHASES)[number];
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

function Harness(): JSX.Element {
  const [options, setOptions] = useState<HarnessOptions>({ ...initialOptions });
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
      flushSync(() => setOptions({ ...initialOptions }));
      window.__clearSentControls();
    };
    window.__harnessReady = true;
    return () => {
      window.__harnessReady = false;
    };
  }, []);
  window.__getHarnessOptions = () => ({ ...options });
  const view = {
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
  return (
    <ServerClockProvider offsetMs={0}>
      <PhoneOnlyProvider value={options.phoneOnly}>
        <main className="evidence-main" aria-label="Offline Tank Trouble controller">
          <Controller view={view} me={me} send={send} />
        </main>
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
