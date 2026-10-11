// Vegetables, fruit and seasonings for the rhythm kit's notes (see Art.tsx).
import type { JSX } from 'react';
import { Art } from './Art';

export function Carrot(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(38 24 24)">
        <path d="M24 12 Q15 8 17 1 Q24 3 24 12Z M24 12 Q33 8 31 1 Q24 3 24 12Z" fill="#4caf50" />
        <path d="M16 12 Q24 8 32 12 L26 44 Q24 47 22 44Z" fill="#f28a22" />
        <path d="M20 21h4M24 29h4M22 36h3" strokeWidth="1.6" />
      </g>
    </Art>
  );
}

export function Broccoli(): JSX.Element {
  return (
    <Art>
      <path d="M19 46 L21 29 H27 L29 46Z" fill="#9ccc65" />
      <g fill="#43a047">
        <circle cx="14" cy="26" r="8" />
        <circle cx="34" cy="26" r="8" />
        <circle cx="24" cy="16" r="10" />
        <circle cx="24" cy="27" r="8" />
      </g>
      <path d="M17 15 Q19 11 23 11" fill="none" stroke="#a5d6a7" strokeWidth="2" />
    </Art>
  );
}

export function Tomato(): JSX.Element {
  return (
    <Art>
      <circle cx="24" cy="27" r="16" fill="#e53935" />
      <path d="M24 12 l-6 4 l4 1 l-2 5 l4 -3 l4 3 l-2 -5 l4 -1z" fill="#43a047" />
      <path d="M13 28 Q13 21 19 18" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
    </Art>
  );
}

export function Lettuce(): JSX.Element {
  return (
    <Art>
      <path
        d="M8 30 Q4 18 14 14 Q18 6 26 10 Q36 6 40 16 Q46 24 40 34 Q34 44 24 42 Q12 44 8 30Z"
        fill="#8bc34a"
      />
      <path
        d="M24 40 V20 M24 31 L16 23 M24 31 L32 23"
        fill="none"
        stroke="#558b2f"
        strokeWidth="1.6"
      />
    </Art>
  );
}

export function Strawberry(): JSX.Element {
  return (
    <Art>
      <path
        d="M24 44 Q8 32 8 20 Q8 12 16 12 Q22 12 24 15 Q26 12 32 12 Q40 12 40 20 Q40 32 24 44Z"
        fill="#e53950"
      />
      <g fill="#ffe082" stroke="none">
        <circle cx="17" cy="22" r="1.3" />
        <circle cx="24" cy="24" r="1.3" />
        <circle cx="31" cy="22" r="1.3" />
        <circle cx="20" cy="31" r="1.3" />
        <circle cx="28" cy="31" r="1.3" />
        <circle cx="24" cy="38" r="1.3" />
      </g>
      <path d="M24 15 L17 8 L22 11 L24 5 L26 11 L31 8Z" fill="#43a047" />
    </Art>
  );
}

export function Blueberry(): JSX.Element {
  return (
    <Art>
      <circle cx="24" cy="26" r="16" fill="#5c6bc0" />
      <path d="M19 19 L24 24 L29 19 M24 24 V30" fill="none" stroke="#283593" strokeWidth="1.8" />
      <path d="M13 28 Q13 21 18 17" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
    </Art>
  );
}

export function Cherry(): JSX.Element {
  return (
    <Art>
      <path d="M16 31 Q19 14 31 6 M34 33 Q31 18 31 6" fill="none" />
      <path d="M31 6 Q38 3 42 8 Q36 11 31 6Z" fill="#43a047" />
      <circle cx="16" cy="34" r="8.5" fill="#d32f2f" />
      <circle cx="34" cy="35" r="8.5" fill="#d32f2f" />
      <path
        d="M11 34 Q11 30 14 28 M29 35 Q29 31 32 29"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
    </Art>
  );
}

export function SweetPotato(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(-30 24 24)">
        <path d="M4 24 Q9 11 24 12 Q40 13 45 24 Q40 35 24 36 Q9 37 4 24Z" fill="#b34a6b" />
        <path
          d="M13 20 Q22 16 30 18 M12 29 Q20 31 28 30"
          fill="none"
          stroke="#e8a0b4"
          strokeWidth="1.8"
        />
      </g>
    </Art>
  );
}

export function Potato(): JSX.Element {
  return (
    <Art>
      <path
        d="M7 26 Q5 14 18 11 Q30 7 38 14 Q45 22 40 32 Q34 43 22 41 Q9 41 7 26Z"
        fill="#c8a46a"
      />
      <g fill="#8d6e45" stroke="none">
        <circle cx="17" cy="21" r="1.6" />
        <circle cx="28" cy="17" r="1.6" />
        <circle cx="31" cy="30" r="1.6" />
        <circle cx="19" cy="33" r="1.6" />
      </g>
    </Art>
  );
}

export function Corn(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(35 24 24)">
        <rect x="17" y="3" width="14" height="33" rx="7" fill="#ffd54f" />
        <path
          d="M21 8v24M27 8v24M17 14h14M17 21h14M17 28h14"
          fill="none"
          stroke="#e0a800"
          strokeWidth="1.2"
        />
        <path
          d="M24 46 Q12 38 14 22 Q22 26 24 46Z M24 46 Q36 38 34 22 Q26 26 24 46Z"
          fill="#7cb342"
        />
      </g>
    </Art>
  );
}

export function Chili(): JSX.Element {
  return (
    <Art>
      <path d="M14 15 Q31 10 36 25 Q39 35 34 45 Q24 40 21 31 Q18 22 14 15Z" fill="#e53935" />
      <path d="M12 14 Q14 7 21 9 L21 16 Q15 19 12 14Z" fill="#43a047" />
      <path d="M25 19 Q31 22 32 30" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
    </Art>
  );
}

export function Garlic(): JSX.Element {
  return (
    <Art>
      <path
        d="M24 6 Q22 14 14 20 Q8 28 12 36 Q18 44 24 42 Q30 44 36 36 Q40 28 34 20 Q26 14 24 6Z"
        fill="#f5f0e1"
      />
      <path
        d="M24 14 Q17 27 20 41 M24 14 Q31 27 28 41"
        fill="none"
        stroke="#c9b99a"
        strokeWidth="1.6"
      />
      <path d="M20 44 L22 47 M28 44 L26 47" fill="none" strokeWidth="1.6" />
    </Art>
  );
}

export function Salt(): JSX.Element {
  return (
    <Art>
      <path d="M14 22 H34 L36 42 Q36 44 34 44 H14 Q12 44 12 42Z" fill="#eceff1" />
      <path d="M13 29 H35 V36 H13Z" fill="#e53935" />
      <path d="M15 22 Q15 8 24 8 Q33 8 33 22Z" fill="#90a4ae" />
      <g fill="#37474f" stroke="none">
        <circle cx="21" cy="15" r="1.3" />
        <circle cx="27" cy="15" r="1.3" />
        <circle cx="24" cy="19" r="1.3" />
      </g>
    </Art>
  );
}
