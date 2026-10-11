import { describe, expect, it } from 'vitest';
import { canvasContentRect, drawingPoint } from './drawingGeometry';

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
