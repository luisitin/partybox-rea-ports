// How many pixels of the page the on-screen keyboard covers (I-795 I). iOS Safari and Chrome on
// Android leave the layout viewport alone when the keyboard opens and shrink only the visual one,
// so a sticky footer and a field near the bottom end up under the keys; a screen that pads its
// bottom by this much lays itself out in the part that is still visible. 0 with no keyboard, with
// no visualViewport, and while the page is pinch-zoomed (the visual viewport is small then too).
import { useEffect, useState } from 'react';

export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!active || !vv) return undefined;
    const update = (): void => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.abs(vv.scale - 1) > 0.01 ? 0 : Math.max(0, Math.round(covered)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return inset;
}
