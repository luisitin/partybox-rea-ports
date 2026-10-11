// The tools at the hit marker and on the pads of the rhythm kit (see Art.tsx).
import type { JSX } from 'react';
import { Art } from './Art';

export function Knife(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(-35 24 24)">
        <path d="M3 30 Q3 15 20 15 H34 V30Z" fill="#dfe6ea" />
        <rect x="34" y="17" width="12" height="9" rx="3" fill="#6d4c41" />
        <path d="M8 19 Q14 17 22 18" fill="none" stroke="#fff" strokeWidth="1.6" />
      </g>
    </Art>
  );
}

export function Spoon({ wood = false }: { wood?: boolean }): JSX.Element {
  return (
    <Art>
      <g transform="rotate(38 24 24)">
        <rect x="21.5" y="18" width="5" height="27" rx="2.5" fill={wood ? '#c58f55' : '#b0bec5'} />
        <ellipse cx="24" cy="12" rx="8.5" ry="10" fill={wood ? '#d9a366' : '#dfe6ea'} />
      </g>
    </Art>
  );
}

export function Bowl(): JSX.Element {
  return (
    <Art>
      <path d="M28 20 L36 4 M34 18 L40 6" fill="none" stroke="#b0bec5" strokeWidth="2" />
      <path d="M6 22 H42 Q42 43 24 43 Q6 43 6 22Z" fill="#90caf9" />
      <ellipse cx="24" cy="22" rx="18" ry="4.5" fill="#fff8e1" />
      <path d="M14 22 Q24 26 34 22" fill="none" strokeWidth="1.6" />
    </Art>
  );
}

export function Pan(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(-20 24 24)">
        <rect x="30" y="22" width="16" height="6" rx="3" fill="#6d4c41" />
        <ellipse cx="19" cy="25" rx="16" ry="13" fill="#546e7a" />
        <ellipse cx="19" cy="25" rx="11.5" ry="8.5" fill="#37474f" />
        <ellipse cx="17" cy="23" rx="3" ry="2" fill="#78909c" stroke="none" />
      </g>
    </Art>
  );
}

export function Flame(): JSX.Element {
  return (
    <Art>
      <path
        d="M24 4 Q30 14 36 22 Q42 32 36 40 Q30 46 24 46 Q16 46 12 40 Q6 32 14 22 Q16 28 20 28 Q18 16 24 4Z"
        fill="#ff7043"
      />
      <path d="M24 25 Q30 32 28 38 Q26 42 24 42 Q20 42 20 36 Q20 30 24 25Z" fill="#ffd54f" />
    </Art>
  );
}

export function Drum(): JSX.Element {
  return (
    <Art>
      <path d="M6 16 V34 Q6 42 24 42 Q42 42 42 34 V16Z" fill="#e53935" />
      <ellipse cx="24" cy="16" rx="18" ry="7" fill="#f1e3c2" />
      <path d="M6 26 L15 35 L24 26 L33 35 L42 26" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M10 3 L28 17 M38 3 L20 17" fill="none" stroke="#d7b98a" strokeWidth="3.4" />
    </Art>
  );
}
