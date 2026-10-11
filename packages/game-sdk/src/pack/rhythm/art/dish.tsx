// Dairy, meat, bread and plates for the rhythm kit's notes (see Art.tsx).
import type { JSX } from 'react';
import { Art } from './Art';

export function Butter(): JSX.Element {
  return (
    <Art>
      <path d="M8 21 L16 12 H42 L34 21Z" fill="#fff3a0" />
      <path d="M8 21 H34 V38 H8Z" fill="#ffe066" />
      <path d="M34 21 L42 12 V29 L34 38Z" fill="#f4c430" />
    </Art>
  );
}

export function Bread(): JSX.Element {
  return (
    <Art>
      <path d="M10 41 V24 Q4 22 6 14 Q8 6 18 8 H30 Q40 6 42 14 Q44 22 38 24 V41Z" fill="#d9a05b" />
      <path
        d="M14 37 V22 Q9 21 10.5 16 Q12 11.5 18.5 12.5 H29.5 Q36 11.5 37.5 16 Q39 21 34 22 V37Z"
        fill="#fbe5b0"
        stroke="none"
      />
    </Art>
  );
}

export function Milk(): JSX.Element {
  return (
    <Art>
      <path d="M14 18 L18 7 H30 L34 18Z" fill="#4aa3df" />
      <path d="M14 18 H34 V42 H14Z" fill="#fff" />
      <path d="M14 26 H34 V36 H14Z" fill="#4aa3df" />
      <path d="M24 28 Q28 32 24 34 Q20 32 24 28Z" fill="#fff" stroke="none" />
    </Art>
  );
}

export function Cream(): JSX.Element {
  return (
    <Art>
      <path d="M31 19 Q42 19 40 29 Q38 36 31 35" fill="none" />
      <path d="M9 11 L14 16 H32 L31 42 Q31 44 29 44 H15 Q13 44 13 42Z" fill="#fff8e1" />
      <path d="M13.5 26 H31.5 V34 H13.5Z" fill="#f4a6c0" />
    </Art>
  );
}

export function Cheese(): JSX.Element {
  return (
    <Art>
      <path d="M5 27 L39 14 Q44 13 44 19 V39 H5Z" fill="#ffc933" />
      <g fill="#f2a900" strokeWidth="1.6">
        <circle cx="15" cy="32" r="3.2" />
        <circle cx="29" cy="28" r="2.6" />
        <circle cx="35" cy="34" r="3.2" />
      </g>
    </Art>
  );
}

export function Patty(): JSX.Element {
  return (
    <Art>
      <path d="M5 24 V30 Q5 41 24 41 Q43 41 43 30 V24Z" fill="#4e2f22" />
      <ellipse cx="24" cy="24" rx="19" ry="10" fill="#7a4a35" />
      <path
        d="M13 22 l6 3 M23 19 l6 3 M31 24 l5 2"
        fill="none"
        stroke="#3b2218"
        strokeWidth="1.8"
      />
    </Art>
  );
}

/** A stack of `n` pancakes (1-3), butter on the top one. */
export function Pancakes({ n }: { n: number }): JSX.Element {
  const top = 34 - 8 * (n - 1);
  return (
    <Art>
      <g>
        {Array.from({ length: n }, (_, i) => {
          const y = 34 - 8 * i;
          return (
            <g key={i}>
              <path
                d={
                  'M6 ' +
                  y +
                  ' V' +
                  (y + 5) +
                  ' Q6 ' +
                  (y + 10) +
                  ' 24 ' +
                  (y + 10) +
                  ' Q42 ' +
                  (y + 10) +
                  ' 42 ' +
                  (y + 5) +
                  ' V' +
                  y +
                  'Z'
                }
                fill="#e8b86a"
              />
              <ellipse cx="24" cy={y} rx="18" ry="6" fill="#f3cf86" />
            </g>
          );
        })}
        <rect x="19" y={top - 4} width="10" height="6" rx="1.5" fill="#ffe066" />
      </g>
    </Art>
  );
}

export function Drumstick(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(-40 24 24)">
        <path
          d="M22 28 V41 Q17 41 17 46 Q22 46 24 44 Q26 46 31 46 Q31 41 26 41 V28Z"
          fill="#fffdf5"
        />
        <path d="M24 3 Q41 3 39 19 Q37 32 24 30 Q11 32 9 19 Q7 3 24 3Z" fill="#c26a2e" />
        <path d="M16 9 Q20 6 25 7" fill="none" stroke="#f0a060" strokeWidth="2" />
      </g>
    </Art>
  );
}

export function Skewer(): JSX.Element {
  return (
    <Art>
      <g transform="rotate(-35 24 24)">
        <path d="M1 24 H47" fill="none" stroke="#c9a066" strokeWidth="3" />
        <rect x="8" y="15" width="11" height="18" rx="4" fill="#a8542a" />
        <rect x="20" y="15" width="8" height="18" rx="3" fill="#66bb6a" />
        <rect x="29" y="15" width="11" height="18" rx="4" fill="#c0632c" />
      </g>
    </Art>
  );
}

export function Hotdog(): JSX.Element {
  return (
    <Art>
      <rect x="3" y="13" width="42" height="15" rx="7.5" fill="#c8472b" />
      <path
        d="M8 17 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4"
        fill="none"
        stroke="#ffd600"
        strokeWidth="2.2"
      />
      <path d="M4 25 H44 Q46 41 34 41 H14 Q2 41 4 25Z" fill="#f0c27a" />
    </Art>
  );
}

export function Bun(): JSX.Element {
  return (
    <Art>
      <path d="M6 33 Q4 11 24 9 Q44 11 42 33Z" fill="#e0993e" />
      <path d="M6 33 H42 Q42 40 35 40 H13 Q6 40 6 33Z" fill="#cf8a30" />
      <g fill="#fff3d0" stroke="none">
        <ellipse cx="17" cy="19" rx="2.4" ry="1.4" />
        <ellipse cx="26" cy="15" rx="2.4" ry="1.4" />
        <ellipse cx="31" cy="23" rx="2.4" ry="1.4" />
        <ellipse cx="22" cy="26" rx="2.4" ry="1.4" />
      </g>
    </Art>
  );
}

export function Burger(): JSX.Element {
  return (
    <Art>
      <path d="M8 36 H40 Q40 43 34 43 H14 Q8 43 8 36Z" fill="#e0993e" />
      <rect x="6" y="29" width="36" height="8" rx="4" fill="#6d4030" />
      <path d="M6 26 q3 -4 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 V30 H6Z" fill="#8bc34a" />
      <path d="M7 26 Q6 8 24 8 Q42 8 41 26Z" fill="#e0993e" />
      <g fill="#fff3d0" stroke="none">
        <ellipse cx="18" cy="15" rx="2.2" ry="1.3" />
        <ellipse cx="27" cy="13" rx="2.2" ry="1.3" />
        <ellipse cx="31" cy="20" rx="2.2" ry="1.3" />
      </g>
    </Art>
  );
}

export function Curry(): JSX.Element {
  return (
    <Art>
      <path
        d="M17 18 Q13 12 17 6 M25 18 Q21 12 25 6 M33 18 Q29 12 33 6"
        fill="none"
        stroke="#b0bec5"
      />
      <path d="M5 27 H43 Q43 43 24 43 Q5 43 5 27Z" fill="#f5f5f5" />
      <ellipse cx="24" cy="27" rx="19" ry="5.5" fill="#e69a1a" />
      <circle cx="18" cy="26" r="1.8" fill="#8d6e1a" stroke="none" />
      <circle cx="29" cy="28" r="1.8" fill="#8d6e1a" stroke="none" />
    </Art>
  );
}
