// Optional browser QA: the real controller receives only supplied public views.
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider, SoundProvider } from '@partybox/game-sdk/ui';
import type { SoundCue } from '@partybox/game-sdk/ui';
import type { HaxballControllerView } from '../../games/haxball/server/index';
import type { Input } from '../../games/haxball/server/types';
import { Controller } from '../../games/haxball/client/Controller';
import '../../design/tokens.css';

type Kind = string | number;
interface Harness {
  setView(kind: Kind): void;
  reset(kind?: Kind): void;
  setClock(serverNow?: number): void;
  dispose(): void;
  clearRecords(): void;
  sent: Input[];
  events: { input: Input; at: number; serverAt: number }[];
  cues: SoundCue[];
  readonly currentView: HaxballControllerView;
  readonly now: number;
  readonly kind: string;
}
declare global {
  interface Window {
    harnessViews: Record<string, HaxballControllerView>;
    harnessPhoneOnly?: boolean;
    harness: Harness;
  }
}

function suppliedView(kind: Kind): { kind: string; view: HaxballControllerView } {
  const names = Object.keys(window.harnessViews ?? {});
  const name = typeof kind === 'number' ? names[kind] : kind;
  if (!name || !Object.hasOwn(window.harnessViews, name))
    throw new Error(`No public harness view named ${String(kind)}.`);
  return { kind: name, view: structuredClone(window.harnessViews[name]!) };
}
const initial = suppliedView(Object.hasOwn(window.harnessViews, 'play') ? 'play' : 0);
const sent: Input[] = [];
const events: { input: Input; at: number; serverAt: number }[] = [];
const cues: SoundCue[] = [];
const recordCue = (cue: SoundCue) => cues.push(cue);
const root = createRoot(document.getElementById('root')!);

function HarnessApp() {
  const [state, setState] = useState(() => ({
    ...initial,
    generation: 0,
    offsetMs: initial.view.phaseAt - Date.now(),
  }));
  const current = useRef(state);
  current.current = state;
  useLayoutEffect(() => {
    window.harness = {
      setView(kind) {
        const next = suppliedView(kind);
        flushSync(() => setState((before) => ({ ...before, ...next })));
      },
      reset(kind = initial.kind) {
        const next = suppliedView(kind);
        sent.length = 0;
        events.length = 0;
        cues.length = 0;
        flushSync(() =>
          setState((before) => ({
            ...next,
            generation: before.generation + 1,
            offsetMs: next.view.phaseAt - Date.now(),
          })),
        );
      },
      setClock(serverNow = current.current.view.phaseAt) {
        if (!Number.isFinite(serverNow)) throw new Error('Harness clock must be finite.');
        flushSync(() => setState((before) => ({ ...before, offsetMs: serverNow - Date.now() })));
      },
      dispose() {
        flushSync(() => root.unmount());
      },
      clearRecords() {
        sent.length = 0;
        events.length = 0;
        cues.length = 0;
      },
      sent,
      events,
      cues,
      get currentView() {
        return current.current.view;
      },
      get now() {
        return Date.now() + current.current.offsetMs;
      },
      get kind() {
        return current.current.kind;
      },
    };
  }, []);
  const lane = state.view.discs.find((candidate) => candidate.id === state.view.me.id);
  return (
    <ServerClockProvider offsetMs={state.offsetMs}>
      <PhoneOnlyProvider value={window.harnessPhoneOnly ?? true}>
        <SoundProvider play={recordCue}>
          <Controller
            key={state.generation}
            view={state.view}
            me={{
              id: state.view.me.id,
              name: lane?.name ?? 'Harness spectator',
              avatarId: 'fox',
              connected: lane?.connected ?? true,
            }}
            send={(input) => {
              const packet = structuredClone(input);
              sent.push(packet);
              events.push({
                input: packet,
                at: performance.now(),
                serverAt: Date.now() + current.current.offsetMs,
              });
            }}
          />
        </SoundProvider>
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}
flushSync(() => root.render(<HarnessApp />));
