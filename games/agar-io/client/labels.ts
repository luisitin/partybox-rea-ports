export interface LabelPoint {
  id: number;
  x: number;
  y: number;
}
export interface LabelBox extends LabelPoint {
  width: number;
  height: number;
}

export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 0.4 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 0.4
  );
}

/** Labels may move with a leader; the public cell's collision pose never changes. */
export function placeLabels(
  points: LabelPoint[],
  width: number,
  height: number,
  blocked: LabelBox[] = [],
): LabelBox[] {
  const placed: LabelBox[] = [];
  const clamp = (value: number, half: number, limit: number): number =>
    Math.max(half, Math.min(limit - half, value));
  for (const point of [...points].sort((a, b) => a.id - b.id)) {
    const preferred = {
      ...point,
      x: clamp(point.x, width / 2, 160),
      y: clamp(point.y, height / 2, 100),
      width,
      height,
    };
    const candidates = [preferred];
    for (let y = height / 2; y <= 100 - height / 2; y += height + 0.8) {
      for (let x = width / 2; x <= 160 - width / 2; x += width + 0.8)
        candidates.push({ ...preferred, x, y });
    }
    candidates.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    );
    placed.push(
      candidates.find(
        (candidate) => ![...blocked, ...placed].some((other) => boxesOverlap(candidate, other)),
      ) ?? preferred,
    );
  }
  return placed;
}
