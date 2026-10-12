// A real mounted Controller and its actual CSS, with observable inputs and public view patches.
// This is a local test harness: it never opens a socket to a game room or loads external assets.
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Controller } from '../../games/agar-io/client/Controller';
import { game } from '../../games/agar-io/server/index';
import type { BlobArenaControllerView } from '../../games/agar-io/server/index';
import type { Input, State } from '../../games/agar-io/server/types';
import play from '../../games/agar-io/fixtures/play.json';
import score from '../../games/agar-io/fixtures/score.json';
import scoreLast from '../../games/agar-io/fixtures/score-last.json';
import done from '../../games/agar-io/fixtures/done.json';
import '../../design/tokens.css';

type PreviewView = BlobArenaControllerView & { vip: null };
interface PreviewStatus {
  ready: boolean;
  fixture: string;
  phoneOnly: boolean;
  playerId: string;
  phase: string;
  paused: boolean;
  mass: number;
  canSplit: boolean;
  inputs: number;
  error: string | null;
}
declare global {
  interface Window {
    __blobReady: boolean;
    __blobInputs: Input[];
    __blobView: PreviewView;
    __blobStatus: PreviewStatus;
    __blobSetView: (patch: Partial<PreviewView>) => void;
    __blobSetIdentity: (playerId: string) => void;
    __blobSetFixture: (name: keyof typeof fixtures) => void;
    __blobClearInputs: () => void;
  }
}

const query = new URLSearchParams(location.search);
const fixtureName = query.get('fixture') ?? 'play';
const phoneOnly = query.get('phoneonly') !== '0';
const playerId = query.get('player') ?? 'p1';
const fixtures = { play, score, 'score-last': scoreLast, done };
const source = fixtures[fixtureName as keyof typeof fixtures] ?? play;
const state = structuredClone(source) as unknown as State;
// Only this isolated harness freezes Date.now; the production game and physics are unchanged.
const frozenWall = Date.now();
Date.now = () => frozenWall;
for (const p of Object.values(state.players)) p.canSeeTv = true;
if (phoneOnly) state.phoneOnly = true;
else delete state.phoneOnly;
// Rebase only absolute display clocks. The seeded world and all relative physics times stay fixed.
const shift = frozenWall - (state.began + state.world.time);
state.began += shift;
state.endsAt += shift;
state.phase.startedAt += shift;
if (state.phase.deadline !== null) state.phase.deadline += shift;
if (state.phase.paused) state.phase.paused.at += shift;
const initialView: PreviewView = { ...game.controllerView(state, playerId), vip: null };
const me = state.players[playerId] ?? { id: playerId, name: 'Spectator', avatarId: 'fox' };
const rootElement = document.getElementById('root')!;
window.__blobReady = false;
window.__blobInputs = [];
window.__blobView = initialView;
window.__blobStatus = {
  ready: false,
  fixture: fixtureName,
  phoneOnly,
  playerId,
  phase: initialView.phaseId,
  paused: initialView.paused,
  mass: initialView.mass,
  canSplit: initialView.canSplit,
  inputs: 0,
  error: null,
};
window.__blobClearInputs = () => {
  window.__blobInputs.length = 0;
  window.__blobStatus.inputs = 0;
};
window.addEventListener('error', (event) => {
  window.__blobStatus.error = event.message;
});
window.addEventListener('unhandledrejection', (event) => {
  window.__blobStatus.error = String(event.reason);
});

function Preview() {
  const [view, setView] = useState(initialView);
  const [currentMe, setCurrentMe] = useState(me);
  const send = useCallback((input: Input) => {
    window.__blobInputs.push(structuredClone(input));
    window.__blobStatus.inputs = window.__blobInputs.length;
  }, []);
  useEffect(() => {
    window.__blobView = view;
    window.__blobSetView = (patch) => setView((current) => ({ ...current, ...patch }));
    window.__blobSetIdentity = (id) => {
      setCurrentMe(state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox' });
      setView({ ...game.controllerView(state, id), vip: null });
    };
    window.__blobSetFixture = (name) => {
      const snapshot = structuredClone(fixtures[name]) as unknown as State;
      for (const player of Object.values(snapshot.players)) player.canSeeTv = true;
      if (phoneOnly) snapshot.phoneOnly = true;
      else delete snapshot.phoneOnly;
      const delta = frozenWall - (snapshot.began + snapshot.world.time);
      snapshot.began += delta;
      snapshot.endsAt += delta;
      snapshot.phase.startedAt += delta;
      if (snapshot.phase.deadline !== null) snapshot.phase.deadline += delta;
      if (snapshot.phase.paused) snapshot.phase.paused.at += delta;
      setView({ ...game.controllerView(snapshot, currentMe.id), vip: null });
      window.__blobStatus.fixture = name;
    };
    Object.assign(window.__blobStatus, {
      ready: true,
      playerId: currentMe.id,
      phase: view.phaseId,
      paused: view.paused,
      mass: view.mass,
      canSplit: view.canSplit,
    });
    window.__blobReady = true;
    rootElement.dataset.ready = 'true';
    rootElement.dataset.phase = view.phaseId;
    const header = document.getElementById('preview-header');
    if (header) header.textContent = `PB · AGAR PREVIEW · ${currentMe.name}`;
  }, [view, currentMe]);
  return (
    <ServerClockProvider offsetMs={0}>
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller view={view} me={currentMe} send={send} />
      </PhoneOnlyProvider>
    </ServerClockProvider>
  );
}

createRoot(rootElement).render(<Preview />);
