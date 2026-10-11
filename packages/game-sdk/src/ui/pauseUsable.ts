// A pause freezes the phone: the shell makes its screen inert, so no tap reaches the game. A surface the game
// holds open through a pause (a caller's own card sheet, whose close the server takes during one: T-0774) stays
// tappable. It calls `usePauseUsable(open)` while it is open; the shell counts the holds it provides.
import { createContext, useContext, useEffect } from 'react';

/** The shell's side: each hold makes the phone tappable through a pause; its release comes back with it. */
export interface PauseUsableHolds {
  hold: () => () => void;
}

export const PauseUsableContext = createContext<PauseUsableHolds | null>(null);

/** While `active`, the phone stays tappable through a VIP pause. Outside a shell that provides holds, it does nothing. */
export function usePauseUsable(active: boolean): void {
  const holds = useContext(PauseUsableContext);
  useEffect(() => {
    if (!active || !holds) return;
    return holds.hold();
  }, [active, holds]);
}
