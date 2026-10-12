// Mounted real components driven by the actual reducer. Authored setup is labelled in history.
// No sockets, external assets, client physics, or public-view patches.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/agar-io/client/Controller';
import { Tv } from '../../games/agar-io/client/Tv';
import { game } from '../../games/agar-io/server/index';
import type { Input, State } from '../../games/agar-io/server/types';
import play from '../../games/agar-io/fixtures/play.json';
import score from '../../games/agar-io/fixtures/score.json';
import scoreLast from '../../games/agar-io/fixtures/score-last.json';
import done from '../../games/agar-io/fixtures/done.json';
import '../../design/tokens.css';

type Event = Parameters<typeof game.reduce>[1];
type Surface =
  'tv' | 'phone' | 'phone-only' | 'phone-remote' | 'phone-spectator' | 'phone-only-spectator';
interface Source {
  state: State;
  surface: Surface;
  viewer: string;
  scenario: string;
  provenance: string;
  authoredStress: boolean;
}
interface Status {
  ready: boolean;
  scenario: string;
  surface: Surface;
  playerId: string;
  phase: string;
  paused: boolean;
  mass: number;
  canSplit: boolean;
  inputs: number;
  events: number;
  now: number;
  checked: number;
  cells: number;
  controls: State['world']['controls'];
  scores: State['scores'];
  error: string | null;
}
declare global {
  interface Window {
    __blobReady: boolean;
    __blobInputs: Input[];
    __blobHistory: unknown[];
    __blobStatus: Status;
    __blobState: State;
    __blobAdvance: (ms: number) => void;
    __blobDispatch: (event: Event) => void;
    __blobSetIdentity: (id: string) => void;
    __blobSetFixture: (name: keyof typeof fixtures) => void;
    __blobSetup: (name: 'eligible-split' | 'low-clock') => void;
    __blobClearInputs: () => void;
  }
}
const query = new URLSearchParams(location.search);
const fixtures = { play, score, 'score-last': scoreLast, done };
const payload = document.getElementById('p05-source');
const fixtureName = (query.get('fixture') ?? 'play') as keyof typeof fixtures;
const surface = (query.get('surface') ??
  (query.get('phoneonly') === '0' ? 'phone' : 'phone-only')) as Surface;
const source: Source = payload
  ? JSON.parse(payload.textContent ?? '')
  : {
      state: structuredClone(fixtures[fixtureName] ?? play),
      surface,
      viewer: query.get('player') ?? 'p1',
      scenario: fixtureName,
      provenance: 'seeded reducer fixture mounted in local shell',
      authoredStress: false,
    };
const phoneOnly = source.surface.startsWith('phone-only');
const isTv = source.surface === 'tv';
// The owner's VIP phone header is four pixels taller than the ordinary shell.
if (!isTv && query.get('vip') === '1') document.body.style.setProperty('--capture-top', '87.6px');
let clock = Date.now() + 1000;
Date.now = () => clock;
const rebase = (snapshot: State): State => {
  for (const player of Object.values(snapshot.players)) player.canSeeTv = true;
  if (source.surface === 'phone-remote' && snapshot.players.p1)
    snapshot.players.p1.canSeeTv = false;
  if (phoneOnly) snapshot.phoneOnly = true;
  else delete snapshot.phoneOnly;
  const delta = clock - (snapshot.began + snapshot.world.time);
  snapshot.began += delta;
  snapshot.endsAt += delta;
  snapshot.phase.startedAt += delta;
  if (snapshot.phase.deadline !== null) snapshot.phase.deadline += delta;
  if (snapshot.phase.paused) snapshot.phase.paused.at += delta;
  return snapshot;
};
const initial = rebase(structuredClone(source.state));
const rootElement = document.getElementById('root')!;
window.__blobReady = false;
window.__blobInputs = [];
window.__blobHistory = [
  { type: 'setup', provenance: source.provenance, authoredStress: source.authoredStress },
];
window.__blobState = initial;
window.__blobStatus = {
  ready: false,
  scenario: source.scenario,
  surface: source.surface,
  playerId: source.viewer,
  phase: initial.phase.id,
  paused: !!initial.phase.paused,
  mass: 0,
  canSplit: false,
  inputs: 0,
  events: 0,
  now: clock,
  checked: initial.world.time,
  cells: initial.world.cells.length,
  controls: initial.world.controls,
  scores: initial.scores,
  error: null,
};
window.__blobClearInputs = () => {
  window.__blobInputs.length = 0;
};
window.addEventListener('error', (event) => {
  window.__blobStatus.error = event.message;
});
window.addEventListener('unhandledrejection', (event) => {
  window.__blobStatus.error = String(event.reason);
});

function Preview() {
  const [state, setState] = useState(initial);
  const [viewer, setViewer] = useState(source.viewer);
  const current = useRef(state);
  const identity = useRef(viewer);
  current.current = state;
  identity.current = viewer;
  const dispatch = useCallback((event: Event) => {
    const before = current.current;
    const next = game.reduce(before, event);
    current.current = next;
    window.__blobState = next;
    window.__blobHistory.push({
      event: structuredClone(event),
      phaseBefore: before.phase.id,
      phaseAfter: next.phase.id,
      worldBefore: before.world.time,
      worldAfter: next.world.time,
    });
    setState(next);
  }, []);
  const send = useCallback(
    (input: Input) => {
      window.__blobInputs.push(structuredClone(input));
      dispatch({ type: 'input', playerId: identity.current, input, now: clock });
    },
    [dispatch],
  );
  const view = isTv ? game.tvView(state) : game.controllerView(state, viewer);
  useEffect(() => {
    window.__blobDispatch = dispatch;
    window.__blobAdvance = (ms) => {
      if (!Number.isFinite(ms) || ms < 0)
        throw new Error('Advance requires nonnegative milliseconds');
      clock += ms;
      const latest = current.current;
      dispatch({
        type: 'timer',
        now: clock,
        phaseId: latest.phase.id,
        startedAt: latest.phase.startedAt,
      });
    };
    window.__blobSetIdentity = (id) => {
      identity.current = id;
      setViewer(id);
    };
    window.__blobSetFixture = (name) => {
      const snapshot = rebase(structuredClone(fixtures[name]) as unknown as State);
      current.current = snapshot;
      window.__blobState = snapshot;
      window.__blobHistory.push({ type: 'fixture', name, provenance: 'seeded reducer fixture' });
      setState(snapshot);
    };
    window.__blobSetup = (name) => {
      const snapshot = structuredClone(current.current);
      if (name === 'eligible-split') {
        const own = snapshot.world.cells.find((cell) => cell.owner === identity.current);
        if (!own) throw new Error('Eligible split setup requires a live piece');
        snapshot.world.cells = snapshot.world.cells.filter(
          (cell) => cell.owner !== identity.current || cell.id === own.id,
        );
        Object.assign(own, { mass: 120, shieldUntil: 0, mergeAt: 0, vx: 0, vy: 0 });
        Object.assign(snapshot.world.controls[identity.current], {
          x: 1,
          y: 0,
          splitAt: snapshot.world.time - 2000,
        });
      } else if (name === 'low-clock') {
        snapshot.endsAt = clock + 1000;
      }
      current.current = snapshot;
      window.__blobState = snapshot;
      window.__blobHistory.push({
        type: 'authored-setup',
        name,
        provenance: 'explicit capture-only precondition; subsequent events use actual reducer',
      });
      setState(snapshot);
    };
    const controller = game.controllerView(state, viewer);
    Object.assign(window.__blobStatus, {
      ready: true,
      playerId: viewer,
      phase: state.phase.id,
      paused: !!state.phase.paused,
      mass: controller.mass,
      canSplit: controller.canSplit,
      inputs: window.__blobInputs.length,
      events: window.__blobHistory.length - 1,
      now: clock,
      checked: state.world.time,
      cells: state.world.cells.length,
      controls: structuredClone(state.world.controls),
      scores: { ...state.scores },
    });
    window.__blobReady = true;
    rootElement.dataset.ready = 'true';
    rootElement.dataset.phase = state.phase.id;
    if (isTv) {
      document.body.style.setProperty(
        '--capture-top',
        game.tvView(state).deadline === null ? '145.2px' : '167.2px',
      );
    }
    const pausedHost = !isTv && Boolean(state.phase.paused);
    rootElement.dataset.hostPaused = String(pausedHost);
    rootElement.inert = pausedHost;
    const banner = document.getElementById('p05-owner-banner');
    if (banner) {
      const vipName =
        query.get('vipname') ??
        Object.values(state.players).find((player) => player.isVip)?.name ??
        'VIP';
      banner.hidden = !pausedHost;
      banner.textContent =
        query.get('vip') === '1'
          ? 'Paused — open ★ VIP and tap Resume'
          : `Paused — ${vipName} will resume the game`;
    }
  }, [state, viewer, dispatch]);
  const me = state.players[viewer] ?? { id: viewer, name: 'Spectator', avatarId: 'fox' };
  return (
    <ServerClockProvider offsetMs={0}>
      <PhoneOnlyProvider value={phoneOnly}>
        {isTv ? (
          <Tv view={{ ...view, vip: null } as ReturnType<typeof game.tvView> & { vip: null }} />
        ) : (
          <Controller
            view={{ ...game.controllerView(state, viewer), vip: null }}
            me={me}
            send={send}
          />
        )}
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}
createRoot(rootElement).render(<Preview />);
