// The rhythm kit's drawn art (T-0636, owner: no emoji, one asset version): every note, tool and pad is a flat inline SVG on
// a 48 x 48 grid with one ink outline, so a carrot looks the same on every TV and phone, in every game. A glyph is 1em
// square: the screen that shows it sets the size with `font-size`. A game imports only the glyphs it draws.
import type { JSX, ReactNode } from 'react';

export const INK = '#2a2233';

export function Art({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}
