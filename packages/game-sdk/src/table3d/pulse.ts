/** Where a `Pulse3d` stands `seconds` into its loop: 0 to 1 and back every `period`; held at the middle when still. */
export function pulseWave(seconds: number, period: number, still: boolean): number {
  return still ? 0.5 : 0.5 + 0.5 * Math.sin((2 * Math.PI * seconds) / period);
}
