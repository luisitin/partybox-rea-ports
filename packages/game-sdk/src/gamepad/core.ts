// T-0602 / ADR-090: the pure half of gamepad play (no React, no DOM): the button names, which
// physical button is which, and what kind of pad it is. Small enough for the join page; the edge/repeat tracker is tracker.ts.

/** Indices of the W3C "standard" mapping (what iOS/Safari reports for a DualSense). */
export const PAD = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  create: 8,
  options: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  ps: 16,
} as const;

/**
 * Buttons a game asks for, named like the Switch Jamboree layout and mapped BY POSITION (owner
 * 10-06): A is the right-hand button of the diamond (Circle), B the bottom one (Cross), X the top
 * (Triangle), Y the left (Square). `plus` / `minus` are Options / Create.
 */
export type PadButton =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'l'
  | 'r'
  | 'zl'
  | 'zr'
  | 'plus'
  | 'minus'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

export const PAD_BUTTONS: readonly PadButton[] = [
  'a',
  'b',
  'x',
  'y',
  'l',
  'r',
  'zl',
  'zr',
  'plus',
  'minus',
  'up',
  'down',
  'left',
  'right',
];

/** Standard-mapping index of each named button. */
export const BUTTON_INDEX: Record<PadButton, number> = {
  a: PAD.circle,
  b: PAD.cross,
  x: PAD.triangle,
  y: PAD.square,
  l: PAD.l1,
  r: PAD.r1,
  zl: PAD.l2,
  zr: PAD.r2,
  plus: PAD.options,
  minus: PAD.create,
  up: PAD.up,
  down: PAD.down,
  left: PAD.left,
  right: PAD.right,
};

export type PadKind = 'dualsense' | 'dualshock' | 'xbox' | 'generic';

/** What kind of pad `Gamepad.id` names (Safari: "DualSense Wireless Controller (STANDARD GAMEPAD
 *  Vendor: 054c Product: 0ce6)"). Decides the glyphs only; the mapping is the standard one. */
export function padKind(id: string): PadKind {
  const s = id.toLowerCase();
  if (s.includes('xbox') || s.includes('xinput') || s.includes('045e')) return 'xbox';
  if (s.includes('dualsense') || /054c.*(0ce6|0df2)|(0ce6|0df2).*054c/.test(s)) return 'dualsense';
  // Chrome on a DS4 and old Safari say just "Wireless Controller"; Xbox was ruled out above.
  if (s.includes('dualshock') || s.includes('wireless controller') || s.includes('054c'))
    return 'dualshock';
  return 'generic';
}

/** The printed label of a button on a given pad: PlayStation shapes on a Sony pad, the Switch
 *  letters otherwise (they are what the Party World rules text says). */
export function glyph(button: PadButton, kind: PadKind): string {
  if (kind === 'dualsense' || kind === 'dualshock') {
    const sony: Record<PadButton, string> = {
      a: '○',
      b: '✕',
      x: '△',
      y: '□',
      l: 'L1',
      r: 'R1',
      zl: 'L2',
      zr: 'R2',
      plus: 'Options',
      minus: 'Create',
      up: '↑',
      down: '↓',
      left: '←',
      right: '→',
    };
    return sony[button];
  }
  if (kind === 'xbox') {
    // Position-equivalent Xbox letters: right = B, bottom = A, top = Y, left = X.
    const xb: Partial<Record<PadButton, string>> = {
      a: 'B',
      b: 'A',
      x: 'Y',
      y: 'X',
      l: 'LB',
      r: 'RB',
      zl: 'LT',
      zr: 'RT',
      plus: 'Menu',
      minus: 'View',
    };
    return xb[button] ?? glyph(button, 'dualsense');
  }
  const sw: Partial<Record<PadButton, string>> = {
    a: 'A',
    b: 'B',
    x: 'X',
    y: 'Y',
    l: 'L',
    r: 'R',
    zl: 'ZL',
    zr: 'ZR',
    plus: '+',
    minus: '−',
  };
  return sw[button] ?? glyph(button, 'dualsense');
}
