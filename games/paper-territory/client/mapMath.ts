// Pure drawing helpers batch territory into paths instead of a DOM node for every square.
export function territoryPaths(
  owners: readonly number[],
  width: number,
  height: number,
): Map<number, string> {
  const paths = new Map<number, string>();
  if (width < 1 || height < 1) return paths;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const owner = owners[y * width + x] ?? -1;
      const start = x++;
      while (x < width && owners[y * width + x] === owner) x++;
      if (owner < 0) continue;
      const length = x - start;
      paths.set(owner, `${paths.get(owner) ?? ''}M${start} ${y}h${length}v1h-${length}z`);
    }
  }
  return paths;
}

export function cellCenter(cell: number, width: number): [number, number] {
  return [(cell % width) + 0.5, Math.floor(cell / width) + 0.5];
}

export function trailPath(cells: readonly number[], width: number): string {
  if (width < 1) return '';
  return cells
    .map((cell, index) => `${index === 0 ? 'M' : 'L'}${cellCenter(cell, width).join(' ')}`)
    .join('');
}

export function areaPercent(area: number, cells: number): string {
  if (cells < 1) return '0.0';
  return ((Math.max(0, area) * 100) / cells).toFixed(1);
}

export function playerInk(slot: number): string {
  return slot >= 0 && slot < 8 ? `var(--pb-player-${slot + 1})` : 'var(--pb-text-muted)';
}
