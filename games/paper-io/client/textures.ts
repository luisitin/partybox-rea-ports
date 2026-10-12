// Every seat keeps a different shape, even when all player colors look identical.
export const OWNERSHIP_TEXTURES = [
  { name: 'Horizontal lines', path: 'M0 1H2', dots: false },
  { name: 'Vertical lines', path: 'M1 0V2', dots: false },
  { name: 'Rising stripes', path: 'M-0.5 0.5L0.5 -0.5M0 2L2 0M1.5 2.5L2.5 1.5', dots: false },
  { name: 'Falling stripes', path: 'M-0.5 1.5L0.5 2.5M0 0L2 2M1.5 -0.5L2.5 0.5', dots: false },
  { name: 'Dots', path: '', dots: true },
  { name: 'Crosses', path: 'M0.65 1H1.35M1 0.65V1.35', dots: false },
  { name: 'Grid', path: 'M0 1H2M1 0V2', dots: false },
  { name: 'Diamonds', path: 'M1 0.45L1.55 1L1 1.55L0.45 1Z', dots: false },
] as const;

export function ownershipTexture(slot: number): (typeof OWNERSHIP_TEXTURES)[number] {
  return OWNERSHIP_TEXTURES[slot] ?? OWNERSHIP_TEXTURES[0];
}
