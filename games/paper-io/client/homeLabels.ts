// Protected homes retain an owner number when an opponent occupies their centre.
import { cellCenter } from './mapMath';

type Point = readonly [number, number];
interface Seat {
  id: string;
  home: number;
  cell: number;
  alive: boolean;
}

export function homeLabelPositions(
  runners: readonly Seat[],
  width: number,
  height: number,
  trailPins: readonly number[],
): Map<string, Point> {
  const heads = runners.filter((runner) => runner.alive);
  const occupied = [...heads.map((runner) => runner.cell), ...trailPins].map((cell) =>
    cellCenter(cell, width),
  );
  const labels = new Map<string, Point>();
  for (const runner of runners) {
    const home = cellCenter(runner.home, width);
    const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (runner.alive && distance(home, cellCenter(runner.cell, width)) < 2) continue;
    const positions: Point[] = [
      home,
      [home[0], home[1] - 2.5],
      [home[0] + 2.5, home[1]],
      [home[0], home[1] + 2.5],
      [home[0] - 2.5, home[1]],
      [home[0] - 2.5, home[1] - 2.5],
      [home[0] + 2.5, home[1] - 2.5],
      [home[0] + 2.5, home[1] + 2.5],
      [home[0] - 2.5, home[1] + 2.5],
    ];
    const candidates = positions.filter(
      ([x, y]) => x >= 1 && y >= 1 && x < width - 1 && y < height - 1,
    );
    const clearance = (point: Point): number =>
      Math.min(...[...occupied, ...labels.values()].map((other) => distance(point, other)));
    const label =
      candidates.find((point) => clearance(point) >= 2) ??
      [...candidates].sort((a, b) => clearance(b) - clearance(a))[0] ??
      home;
    labels.set(runner.id, label);
  }
  return labels;
}
