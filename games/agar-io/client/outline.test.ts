import { describe, expect, it } from 'vitest';
import {
  OUTLINE_MAX_FRAMES,
  OUTLINE_VERTEX_COUNT,
  outlineFrames,
  outlinePath,
  outlineVertices,
} from './outline';
import type { OutlineContact, OutlinePose } from './outline';

const growth: OutlinePose = { id: 1, x: 91, y: 48, radius: Math.sqrt(192) * 0.55 };
const shoulder: OutlineContact = { kind: 'food', id: 144, x: 96.2, y: 43.1, radius: 0.6 };
const radial = (point: { x: number; y: number }): number => Math.hypot(point.x, point.y);

describe('public painted outline', () => {
  it('reproduces a material contact shoulder without changing the supplied envelope', () => {
    const untouched = { ...growth };
    const smooth = outlineVertices(growth, [], 12_000);
    const touched = outlineVertices(growth, [shoulder], 12_000);
    // 315 degrees covers the independently observed upper-right growth indentation.
    const shoulderIndex = (315 / 360) * OUTLINE_VERTEX_COUNT;
    const indentation = radial(smooth[shoulderIndex]!) - radial(touched[shoulderIndex]!);
    expect(indentation * 7.766267386349764).toBeGreaterThan(4.5);
    expect(indentation * 7.766267386349764).toBeLessThan(5.1);
    // The opposite side and logical input stay intact, rather than shrinking the whole cell.
    expect(radial(smooth[18]!) - radial(touched[18]!)).toBeLessThan(0.001);
    expect(growth).toEqual(untouched);
  });

  it('keeps an exterior grazing snack shallow and nearby sibling contacts visible', () => {
    const split: OutlinePose = { id: 1, x: 80, y: 48, radius: Math.sqrt(96) * 0.55 };
    const grazing: OutlineContact = { ...shoulder, x: 83.6, y: 43.1 };
    const base = outlineVertices(split, [], 12_000);
    const touch = outlineVertices(split, [grazing], 12_000);
    const depth = Math.max(...base.map((point, i) => radial(point) - radial(touch[i]!)));
    expect(depth * 7.121698422865434).toBeGreaterThan(0.5);
    expect(depth * 7.121698422865434).toBeLessThan(1.5);
    const sibling = { kind: 'cell' as const, id: 4, x: 90.6, y: 48, radius: split.radius };
    expect(outlinePath(split, [sibling], 12_000)).not.toBe(outlinePath(split, [], 12_000));
    expect(outlinePath(split, [{ ...sibling, id: split.id }], 12_000)).toBe(
      outlinePath(split, [], 12_000),
    );
    // A pellet far inside the cell is not touching its rim and cannot pull a notch inward.
    expect(outlinePath(split, [{ ...grazing, x: split.x, y: split.y }], 12_000)).toBe(
      outlinePath(split, [], 12_000),
    );
    const overlapping = { id: 1, x: 0, y: 0, radius: 4 };
    const rival = { kind: 'cell' as const, id: 2, x: 4, y: 0, radius: 4 };
    const clear = outlineVertices(overlapping, [], 0);
    const crossed = outlineVertices(overlapping, [rival], 0);
    // These rims cross at +/-60 degrees, away from the centerline through the rival's interior.
    expect(radial(clear[8]!) - radial(crossed[8]!)).toBeGreaterThan(0.4);
    expect(radial(clear[40]!) - radial(crossed[40]!)).toBeGreaterThan(0.4);
    expect(radial(clear[0]!) - radial(crossed[0]!)).toBeLessThan(0.01);
  });

  it('replays public contacts independently of storage order, with no input mutation', () => {
    const contacts = Object.freeze([
      Object.freeze(shoulder),
      Object.freeze({ kind: 'cell' as const, id: 2, x: 106, y: 48, radius: 7.5 }),
      Object.freeze({ kind: 'food' as const, id: 1, x: 83.8, y: 48, radius: 0.6 }),
    ]);
    const before = JSON.stringify(contacts);
    const first = outlinePath(Object.freeze({ ...growth }), contacts, 12_000, 250);
    expect(first).toBe(outlinePath(growth, [...contacts].reverse(), 12_000, 250));
    expect(first).toBe(outlinePath(growth, contacts, 12_000, 250));
    expect(first).not.toBe(outlinePath({ ...growth, id: 7 }, contacts, 12_000, 250));
    expect(JSON.stringify(contacts)).toBe(before);
  });

  it('bounds crowded contacts and tiny radii without stacking or non-finite geometry', () => {
    for (const radius of [0.01, 0.6, 2.7, 7.6, 24]) {
      const pose = { id: 1, x: 80, y: 50, radius };
      const contacts: OutlineContact[] = Array.from({ length: 96 }, (_, id) => ({
        kind: 'food',
        id,
        x: pose.x + radius * Math.cos((id * Math.PI) / 48),
        y: pose.y + radius * Math.sin((id * Math.PI) / 48),
        radius: Math.min(0.6, radius),
      }));
      const points = outlineVertices(pose, contacts, 0, 2000);
      expect(points).toHaveLength(OUTLINE_VERTEX_COUNT);
      expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
        true,
      );
      expect(Math.min(...points.map(radial))).toBeGreaterThanOrEqual(radius * 0.86 - 1e-9);
      expect(Math.max(...points.map(radial))).toBeLessThanOrEqual(radius * 1.02 + 1e-9);
    }
  });

  it('uses received painted poses with fixed native topology and a bounded frame budget', () => {
    const samples = [
      { id: 1, x: 80, y: 50, radius: 2.7, offset: 0 },
      { id: 1, x: 82, y: 50, radius: 3.3, offset: 0.05 },
      { id: 1, x: 84, y: 50, radius: 5.4, offset: 1 },
    ];
    const frames = outlineFrames(samples, [], 12_000);
    expect(frames.map((frame) => frame.offset)).toEqual([0, 0.05, 1]);
    expect(
      frames.every((frame) => (frame.d.match(/[ML]/g) ?? []).length === OUTLINE_VERTEX_COUNT),
    ).toBe(true);
    expect(frames[0]!.d).toBe(outlinePath(samples[0]!, [], 12_000, 0));
    expect(frames[1]!.d).toBe(outlinePath(samples[1]!, [], 12_000, 100));
    expect(frames[2]!.d).toBe(outlinePath(samples[2]!, [], 12_000, 2000));
    expect(() => outlineFrames(Array(OUTLINE_MAX_FRAMES + 1).fill(samples[0]), [], 0)).toThrow(
      /budget/,
    );
    expect(() => outlineFrames(samples, [], 0, 2001)).toThrow(/budget/);
    expect(() => outlineFrames([samples[2]!, samples[0]!], [], 0)).toThrow(/offset/);
  });
});
