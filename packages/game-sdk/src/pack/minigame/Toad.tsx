// The instruction screen's host (bible S15): a red-capped Toad who says the two how-to lines. Drawn in SVG so it
// ships with the SDK at a few hundred bytes; swap the art here when the owner's model arrives.
import type { JSX } from 'react';
import { useT } from '../../ui/lang';
import { STRINGS } from './strings';

export function Toad({ size }: { size: number }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 120 138"
      role="img"
      aria-label={L('Toad')}
      focusable="false"
    >
      <path d="M26 138 Q26 100 60 100 Q94 100 94 138Z" fill="#f4f1ea" />
      <path d="M32 138 L38 104 Q60 114 82 104 L88 138Z" fill="#3a5bd9" />
      <ellipse cx="60" cy="82" rx="30" ry="26" fill="#f8d9b0" />
      <ellipse cx="49" cy="80" rx="4" ry="7" fill="#2a1c14" />
      <ellipse cx="71" cy="80" rx="4" ry="7" fill="#2a1c14" />
      <path
        d="M50 94 Q60 102 70 94"
        fill="none"
        stroke="#2a1c14"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M4 76 Q4 6 60 6 Q116 6 116 76 Q60 60 4 76Z" fill="#e3232c" />
      <circle cx="60" cy="24" r="15" fill="#fff" />
      <ellipse cx="22" cy="50" rx="12" ry="14" fill="#fff" />
      <ellipse cx="98" cy="50" rx="12" ry="14" fill="#fff" />
    </svg>
  );
}
