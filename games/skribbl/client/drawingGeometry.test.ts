import { describe, expect, it } from 'vitest';
import { canvasContentRect, drawingPoint, finishDrawingPoints } from './drawingGeometry';
import type { Point } from '../server/types';

describe('drawing coordinates follow the visible bitmap', () => {
  it.each([
    { name: 'normal phone', width: 350, height: 210, scale: 1 },
    { name: 'short phone', width: 150, height: 90, scale: 1 },
    { name: 'scaled phone', width: 350, height: 210, scale: 1.25 },
  ])(
    'keeps corners and interior strokes under the pointer on a $name',
    ({ width, height, scale }) => {
      const border = 4;
      const outer = {
        left: 12,
        top: 80,
        width: (width + border * 2) * scale,
        height: (height + border * 2) * scale,
      };
      const content = canvasContentRect(outer, {
        width: `${width}px`,
        height: `${height}px`,
        borderLeftWidth: `${border}px`,
        borderRightWidth: `${border}px`,
        borderTopWidth: `${border}px`,
        borderBottomWidth: `${border}px`,
      });
      for (const x of [0, 0.05, 0.5, 0.95, 1]) {
        for (const y of [0, 0.05, 0.5, 0.95, 1]) {
          const point = drawingPoint(
            outer.left + border * scale + width * scale * x,
            outer.top + border * scale + height * scale * y,
            content,
          );
          expect(point[0]).toBeCloseTo(x * 1000, 8);
          expect(point[1]).toBeCloseTo(y * 600, 8);
        }
      }
    },
  );

  it('clamps a captured pointer that leaves the bitmap, including its border', () => {
    const rect = { left: 16, top: 84, width: 350, height: 210 };
    expect(drawingPoint(12, 80, rect)).toEqual([0, 0]);
    expect(drawingPoint(370, 298, rect)).toEqual([1000, 600]);
  });

  it('never emits invalid coordinates while a canvas is temporarily collapsed', () => {
    expect(drawingPoint(20, 30, { left: 0, top: 0, width: 0, height: 0 })).toEqual([0, 0]);
  });
});

describe('finger release preserves the complete stroke', () => {
  const rect = { left: 16, top: 84, width: 350, height: 210 };

  it('keeps motion delivered only with pointerup after the last pointermove', () => {
    const points: Point[] = [drawingPoint(51, 105, rect), drawingPoint(191, 189, rect)];
    const finished = finishDrawingPoints(points, 'pointerup', 331, 273, rect);
    expect(finished).toEqual([
      [100, 60],
      [500, 300],
      [900, 540],
    ]);
    expect(points).toHaveLength(2);
  });

  it('keeps a flick delivered entirely at release and clamps a release outside the bitmap', () => {
    const points: Point[] = [[100, 60]];
    expect(finishDrawingPoints(points, 'pointerup', 366, 294, rect)).toEqual([
      [100, 60],
      [1000, 600],
    ]);
    expect(finishDrawingPoints(points, 'pointerup', 600, 500, rect)).toEqual([
      [100, 60],
      [1000, 600],
    ]);
  });

  it('leaves a tap as one dot and avoids resending an unchanged flushed endpoint', () => {
    const points: Point[] = [[100, 60]];
    expect(finishDrawingPoints(points, 'pointerup', 51, 105, rect)).toBe(points);
    const flushedTail: Point[] = [[500, 300]];
    expect(finishDrawingPoints(flushedTail, 'pointerup', 191, 189, rect)).toBe(flushedTail);
  });

  it('keeps a tiny final segment after the normal move distance filter', () => {
    const points: Point[] = [[500, 300]];
    const finished = finishDrawingPoints(points, 'pointerup', 191.35, 189, rect);
    expect(finished).not.toBe(points);
    expect(finished[1]?.[0]).toBeCloseTo(501, 8);
    expect(finished[1]?.[1]).toBe(300);
  });

  it.each(['pointercancel', 'lostpointercapture'])(
    'flushes existing points on %s without inventing ink from its coordinates',
    (eventType) => {
      const points: Point[] = [
        [100, 60],
        [500, 300],
      ];
      expect(finishDrawingPoints(points, eventType, 0, 0, rect)).toBe(points);
      expect(finishDrawingPoints(points, eventType, 366, 294, rect)).toBe(points);
    },
  );

  it('does not invent an origin when the bitmap collapses before release', () => {
    const points: Point[] = [[500, 300]];
    expect(finishDrawingPoints(points, 'pointerup', 20, 30, { ...rect, width: 0, height: 0 })).toBe(
      points,
    );
  });
});
