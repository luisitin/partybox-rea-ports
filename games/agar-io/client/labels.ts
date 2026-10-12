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
    const ownBody = blocked.find((other) => other.id === point.id);
    const near = [preferred];
    if (ownBody) {
      const dx = (ownBody.width + width) / 2 + 0.8;
      const dy = (ownBody.height + height) / 2 + 0.8;
      const bays: [number, number][] = [
        [ownBody.x + dx, ownBody.y],
        [ownBody.x - dx, ownBody.y],
        [ownBody.x, ownBody.y - dy],
        [ownBody.x, ownBody.y + dy],
      ];
      for (const [x, y] of bays) {
        if (x >= width / 2 && x <= 160 - width / 2 && y >= height / 2 && y <= 100 - height / 2)
          near.push({ ...preferred, x, y });
      }
    }
    near.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    );
    const candidates = [] as LabelBox[];
    for (let y = height / 2; y <= 100 - height / 2; y += height + 0.8) {
      for (let x = width / 2; x <= 160 - width / 2; x += width + 0.8)
        candidates.push({ ...preferred, x, y });
    }
    candidates.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    );
    const free = (candidate: LabelBox): boolean =>
      ![...blocked, ...placed].some((other) => boxesOverlap(candidate, other));
    const available = [...near, ...candidates].filter(
      (candidate) => !placed.some((other) => boxesOverlap(candidate, other)),
    );
    const obstruction = (candidate: LabelBox): number =>
      blocked.reduce((area, other) => {
        const overlapX = Math.max(
          0,
          Math.min(candidate.x + candidate.width / 2, other.x + other.width / 2) -
            Math.max(candidate.x - candidate.width / 2, other.x - other.width / 2),
        );
        const overlapY = Math.max(
          0,
          Math.min(candidate.y + candidate.height / 2, other.y + other.height / 2) -
            Math.max(candidate.y - candidate.height / 2, other.y - other.height / 2),
        );
        return area + overlapX * overlapY;
      }, 0);
    // If bodies fill every bay, retain distinct IDs in the least obstructed available bay.
    placed.push(
      near.find(free) ??
        candidates.find(free) ??
        available.sort((a, b) => obstruction(a) - obstruction(b))[0] ??
        preferred,
    );
  }
  return placed;
}
