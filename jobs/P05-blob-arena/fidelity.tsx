// Authored matched moments; this mounts the shipped Arena and its resize camera.
// The original renderer is served separately from OS-temp, never bundled here.
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Arena } from '../../games/agar-io/client/Arena';
import scenes from './fidelity-scenes.json';
import '../../design/tokens.css';

const scene =
  scenes.find((entry) => entry.id === new URLSearchParams(location.search).get('scene')) ??
  scenes[0]!;
const names: Record<string, string> = {
  p1: 'Ana',
  p2: 'Ben',
  p3: 'Cy',
  ...('names' in scene ? scene.names : {}),
};
const players = ['p1', 'p2', 'p3'].map((id) => ({
  id,
  name: names[id] ?? id,
  avatarId: 'fox',
  connected: true,
  status: 'active' as const,
}));
const pellets = Array.from({ length: 96 }, (_, index) => ({
  id: index + 101,
  x: 8 + (index % 12) * 12.6,
  y: 5 + Math.floor(index / 12) * 12.7,
}));
const cells = scene.cells.map((cell) => ({
  ...cell,
  vx: 0,
  vy: 0,
  mergeAt: 0,
  shieldUntil: 0,
}));
function MatchedMoment() {
  const [received, setReceived] = useState(cells);
  useEffect(() => {
    document.body.dataset.ready = 'true';
    Object.assign(window, {
      __oursMove: (next: typeof scene.cells) =>
        flushSync(() =>
          setReceived(
            next.map((cell) => ({
              ...cell,
              vx: 0,
              vy: 0,
              mergeAt: 0,
              shieldUntil: 0,
            })),
          ),
        ),
    });
  }, []);
  return (
    <Arena
      cells={received}
      pellets={pellets}
      players={players}
      slots={{ p1: 0, p2: 1, p3: 2 }}
      checked={12000}
      mine="p1"
      phone
      follow
    />
  );
}
createRoot(document.getElementById('root')!).render(<MatchedMoment />);
