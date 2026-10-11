// A game's badge in the minigame frame, drawn (never an emoji, owner rule 10-07): a starburst medallion in the game's own hue
// with its initial. The hue comes from the game id, so a game wears the same colour on the card, the how-to and the report.
import { useId } from 'react';
import type { JSX } from 'react';

/** 0..359, stable per id. */
export function badgeHue(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** The burst's 12 points as one polygon around (50, 50). */
const BURST = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 === 0 ? 49 : 40;
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

export interface GameBadgeProps {
  gameId: string;
  name: string;
  /** Edge in CSS length; the badge is square. */
  size?: string;
}

export function GameBadge({ gameId, name, size = '1em' }: GameBadgeProps): JSX.Element {
  const id = useId();
  const hue = badgeHue(gameId);
  const letter = ([...name.trim()][0] ?? '?').toUpperCase();
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: 'middle', flex: 'none' }}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 85% 66%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 80% 42%)`} />
        </linearGradient>
      </defs>
      <polygon
        points={BURST}
        fill={`hsl(${(hue + 40) % 360} 90% 62%)`}
        stroke="#2a2233"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="33" fill={`url(#${id}-g)`} stroke="#2a2233" strokeWidth="4" />
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />
      <path
        d="M30 40 A24 24 0 0 1 50 26"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.8"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="38"
        fontWeight="900"
        fill="#fff"
        stroke="#2a2233"
        strokeWidth="5"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {letter}
      </text>
    </svg>
  );
}

/** "Tap": a drawn hand pointing at ripples, for a how-to with no keys to list. */
export function TapArt({ size = '1em' }: { size?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      style={{ display: 'inline-block', flex: 'none' }}
    >
      <circle cx="46" cy="30" r="9" fill="none" stroke="#ffc83d" strokeWidth="4" />
      <circle
        cx="46"
        cy="30"
        r="20"
        fill="none"
        stroke="#ffc83d"
        strokeOpacity="0.55"
        strokeWidth="3.5"
      />
      <circle
        cx="46"
        cy="30"
        r="29"
        fill="none"
        stroke="#ffc83d"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M40 32 C40 26 52 26 52 32 L52 52 L66 55 C74 57 78 62 77 71 L75 88 C75 92 72 94 69 94 L46 94 C42 94 40 92 38 89 L26 70 C24 66 28 62 32 64 L40 70 Z"
        fill="#fff"
        stroke="#2a2233"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The coin on a winner's chip: a drawn gold coin with a shine, never the 🪙 emoji (T-0676). */
export function CoinArt({ size = '1em' }: { size?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: 'middle', flex: 'none' }}
    >
      <circle cx="50" cy="50" r="46" fill="#ffc83d" stroke="#2a2233" strokeWidth="5" />
      <circle
        cx="50"
        cy="50"
        r="31"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="5"
      />
      <path
        d="M33 42 A20 20 0 0 1 50 30"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.9"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
