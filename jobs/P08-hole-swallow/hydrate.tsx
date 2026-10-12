// Verification host only. Mounts the real components and records their actual input events.
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/hole-io/client/Controller';
import { Tv } from '../../games/hole-io/client/Tv';
import type { HoleControllerView, HoleTvView, Input } from '../../games/hole-io/server/types';

interface Payload {
  tv: boolean;
  phoneOnly: boolean;
  now: number;
  view: HoleControllerView | HoleTvView;
  me: { id: string; name: string; avatarId: string };
}
declare global {
  interface Window {
    p08Inputs: Input[];
    p08Switch: (payload: Payload) => void;
    p08Ready: boolean;
  }
}
const host = document.getElementById('stage');
if (!host) throw new Error('P08 capture stage missing');
const root = createRoot(host);
window.p08Inputs = [];
window.p08Switch = (payload) => {
  root.render(
    <ServerClockProvider offsetMs={payload.now - Date.now()}>
      {payload.tv ? (
        <Tv view={{ ...(payload.view as HoleTvView), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={payload.phoneOnly}>
          <Controller
            view={{ ...(payload.view as HoleControllerView), vip: null }}
            me={payload.me}
            send={(input) => window.p08Inputs.push(input)}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
  window.p08Ready = true;
};
window.p08Switch(JSON.parse(document.getElementById('p08-payload')!.textContent!));
