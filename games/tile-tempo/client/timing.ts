// Pure presentation helpers also cover previews whose clocks have already expired.

export function secondsLeft(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function clockText(seconds: number): string {
  return `0:${String(seconds).padStart(2, '0')}`;
}

/** Current note is last visually, nearest the thumb; original indices remain the row identity. */
export function visibleNotes(
  notes: readonly (number | null)[],
): { column: number | null; ahead: number }[] {
  return notes.map((column, ahead) => ({ column, ahead })).reverse();
}
