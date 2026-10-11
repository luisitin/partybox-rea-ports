// Stored strokes carry colour indexes; every device resolves them through its own theme.
export const COLORS = [
  { name: 'Ink', token: '--pb-text' },
  { name: 'Rose', token: '--pb-accent' },
  { name: 'Gold', token: '--pb-accent-2' },
  { name: 'Mint', token: '--pb-accent-3' },
  { name: 'Sky', token: '--pb-info' },
  { name: 'Violet', token: '--pb-player-5' },
] as const;

export const WIDTHS = [
  { name: 'Thin', width: 4 },
  { name: 'Medium', width: 9 },
  { name: 'Thick', width: 18 },
] as const;
