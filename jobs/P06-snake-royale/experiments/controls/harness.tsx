// Bundled only for the offline live-input audit; the production hook and controls are imported unchanged.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Controls } from '../../../../games/slither-io/client/Controls';
import type { Input } from '../../../../games/slither-io/server/types';
import '../../../../design/tokens.css';

declare global {
  interface Window {
    controlsAudit: {
      inputs: Input[];
      reset: () => void;
      enabled: (value: boolean) => void;
      mass: (value: number) => void;
    };
  }
}

const inputs: Input[] = [];

function Harness() {
  const [round, setRound] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [mass, setMass] = useState(14);
  window.controlsAudit = {
    inputs,
    reset: () => {
      inputs.length = 0;
      setEnabled(true);
      setMass(14);
      setRound((value) => value + 1);
    },
    enabled: setEnabled,
    mass: setMass,
  };
  return (
    <main style={{ padding: 12, color: 'var(--pb-text)', background: 'var(--pb-bg)' }}>
      <div style={{ '--snake-color': 'var(--pb-player-1)' } as CSSProperties}>
        <Controls
          key={round}
          angle={0}
          mass={mass}
          enabled={enabled}
          send={(input) => inputs.push(input)}
        />
      </div>
      <input aria-label="Text focus target" style={{ marginTop: 24 }} />
      <div id="focus-target" tabIndex={0}>
        Other focus target
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
