import type { CSSProperties } from 'react';

/** Seat numbers stay fixed through retries, rankings and reconnects. */
export function seatStyle(slot: number): CSSProperties {
  return { ['--tower-ink' as string]: `var(--pb-player-${(slot % 8) + 1})` };
}

/** Network dictionaries can contain adversarial ids; inherited properties are never seats. */
export function slotOf(slots: Record<string, number>, id: string): number {
  return Object.hasOwn(slots, id) ? (slots[id] ?? 0) : 0;
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(seconds).padStart(2, '0')}`;
}

export function feedbackKey(feedback: string): string {
  switch (feedback) {
    case 'perfect':
      return '✓ Perfect alignment';
    case 'grow':
      return '↑ Perfect! Block restored';
    case 'trim':
      return '↘ Overhang trimmed';
    case 'miss':
      return '✕ Missed — your best is safe';
    default:
      return 'Align the moving block with the outline';
  }
}
