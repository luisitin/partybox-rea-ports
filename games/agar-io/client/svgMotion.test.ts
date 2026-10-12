import { describe, expect, it } from 'vitest';
import {
  animateSvgPath,
  animateSvgTransform,
  pathFromComputedValue,
  readSvgTransform,
  setSvgTransform,
} from './svgMotion';

interface MockAnimation {
  setAttribute(key: string, value: string): void;
  beginElement(): void;
  remove(): void;
  values: Map<string, string>;
}

function host() {
  const children: MockAnimation[] = [];
  const attributes = new Map<string, string>();
  const css = new Map([
    ['transform', 'scale(99)'],
    ['color', 'pink'],
  ]);
  const begins: number[] = [];
  function animation(): MockAnimation {
    const values = new Map<string, string>();
    const node = {
      setAttribute: (key: string, value: string) => values.set(key, value),
      beginElement: () => begins.push(children.length),
      remove: () => {
        const index = children.indexOf(node);
        if (index >= 0) children.splice(index, 1);
      },
      values,
    };
    return node;
  }
  const element = {
    ownerDocument: { createElementNS: () => animation() },
    style: { removeProperty: (key: string) => css.delete(key) },
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
    appendChild: (node: ReturnType<typeof animation>) => children.push(node),
  } as unknown as SVGGraphicsElement;
  return { element, children, attributes, css, begins };
}

const frames = [
  { offset: 0, transform: 'matrix(10, 0, 0, 10, -605, -250)' },
  { offset: 0.025, transform: 'matrix(9, 0, 0, 9, -561, -241)' },
  { offset: 1, transform: 'matrix(8, 0, 0, 8, -445, -150)' },
];

describe('bounded native SVG transform adapter', () => {
  it('keeps pan in viewport pixels by translating before additive scale', () => {
    const surface = host();
    animateSvgTransform(surface.element, frames, {
      duration: 2000,
      easing: 'linear',
      fill: 'both',
    });
    const [translation, scale] = surface.children;
    expect(translation!.values.get('type')).toBe('translate');
    expect(translation!.values.get('additive')).toBe('replace');
    expect(translation!.values.get('values')).toBe('-605 -250;-561 -241;-445 -150');
    expect(scale!.values.get('type')).toBe('scale');
    expect(scale!.values.get('additive')).toBe('sum');
    expect(scale!.values.get('values')).toBe('10;9;8');
    // The known final camera maps owned (80,50) to viewport centre (195,250).
    const [tx, ty] = translation!.values.get('values')!.split(';').at(-1)!.split(' ').map(Number);
    const zoom = Number(scale!.values.get('values')!.split(';').at(-1));
    expect(80 * zoom + tx!).toBe(195);
    expect(50 * zoom + ty!).toBe(250);
    expect(surface.begins).toEqual([2, 2]);
    for (const node of surface.children) {
      expect(node.values.get('keyTimes')).toBe('0;0.025;1');
      expect(node.values.get('dur')).toBe('2000ms');
      expect(node.values.get('begin')).toBe('indefinite');
      expect(node.values.get('fill')).toBe('freeze');
      expect(node.values.get('calcMode')).toBe('linear');
    }
    expect(surface.css.has('transform')).toBe(false);
    expect(surface.css.get('color')).toBe('pink');
  });

  it('preserves the original 120ms smoothstep spline without a frame callback', () => {
    const surface = host();
    animateSvgTransform(surface.element, [frames[0]!, frames[2]!], {
      duration: 120,
      easing: 'cubic-bezier(0.3333333333, 0, 0.6666666667, 1)',
    });
    for (const node of surface.children) {
      expect(node.values.get('calcMode')).toBe('spline');
      expect(node.values.get('keySplines')).toBe('0.3333333333 0 0.6666666667 1');
      expect(node.values.get('dur')).toBe('120ms');
    }
  });

  it('cancels both effects once and leaves the received target as the base transform', () => {
    const surface = host();
    setSvgTransform(surface.element, frames[2]!.transform);
    const handle = animateSvgTransform(surface.element, frames, { duration: 2000 });
    handle.cancel();
    handle.cancel();
    expect(surface.children).toHaveLength(0);
    expect(surface.attributes.get('transform')).toBe(frames[2]!.transform);
    setSvgTransform(surface.element, '');
    expect(surface.attributes.has('transform')).toBe(false);
  });

  it('does not leave an active partial animation for invalid samples or unsupported timing', () => {
    for (const invalid of [
      [frames[0]!],
      [{ ...frames[0]!, offset: 0.1 }, frames[2]!],
      [frames[0]!, { ...frames[2]!, offset: 0 }],
      [frames[0]!, { ...frames[2]!, transform: 'matrix(8, 1, 0, 8, 0, 0)' }],
      [frames[0]!, { ...frames[2]!, transform: 'matrix(NaN, 0, 0, NaN, 0, 0)' }],
      Array.from({ length: 122 }, (_, index) => ({ ...frames[0]!, offset: index / 121 })),
    ]) {
      const surface = host();
      expect(() => animateSvgTransform(surface.element, invalid, { duration: 2000 })).toThrow(
        RangeError,
      );
      expect(surface.children).toHaveLength(0);
      expect(surface.begins).toHaveLength(0);
    }
    for (const options of [
      { duration: 0 },
      { duration: Infinity },
      { duration: 120, easing: 'ease' },
    ]) {
      const surface = host();
      expect(() => animateSvgTransform(surface.element, frames, options)).toThrow(RangeError);
      expect(surface.children).toHaveLength(0);
    }
  });
});

const ctm = (a: number, b: number, c: number, d: number, e: number, f: number) => ({
  getCTM: () => ({ a, b, c, d, e, f }) as DOMMatrix,
});

describe('public SVG transform sampling', () => {
  it('removes TV viewBox scale and letterbox offsets before reading a camera', () => {
    expect(readSvgTransform(ctm(20, 0, 0, 20, -1160, -480), ctm(2, 0, 0, 2, 50, 20))).toBe(
      'matrix(10, 0, 0, 10, -605, -250)',
    );
  });

  it('reads a surviving cell in world units and a text baseline in its cell units', () => {
    const world = ctm(9, 0, 0, 9, -561, -241);
    const body = ctm(9, 0, 0, 9, 159, 209);
    expect(readSvgTransform(body, world)).toBe('matrix(1, 0, 0, 1, 80, 50)');
    const text = ctm(9, 0, 0, 9, 159, 209.945);
    const sampled = readSvgTransform(text, body)!;
    expect(Number(sampled.slice(7, -1).split(',')[5])).toBeCloseTo(0.105, 10);
  });

  it('normalizes a rotated SVG ancestor without mistaking its angle for cell travel', () => {
    expect(readSvgTransform(ctm(0, 6, -6, 0, 2, 30), ctm(0, 2, -2, 0, 10, 20))).toBe(
      'matrix(3, 0, 0, 3, 5, 4)',
    );
  });

  it('ignores detached, singular, or invalid geometry instead of inventing a pose', () => {
    expect(readSvgTransform({ getCTM: () => null }, ctm(1, 0, 0, 1, 0, 0))).toBeNull();
    expect(readSvgTransform(ctm(1, 0, 0, 1, 0, 0), ctm(0, 0, 0, 0, 0, 0))).toBeNull();
    expect(readSvgTransform(ctm(NaN, 0, 0, 1, 0, 0), ctm(1, 0, 0, 1, 0, 0))).toBeNull();
  });
});

describe('native painted outline motion', () => {
  it('keeps the captured first contour and uses native fixed-topology path interpolation', () => {
    const surface = host();
    const first = 'M3 0 L0 3 L-3 0 L0 -3 Z';
    const last = 'M5 0 L0 5 L-5 0 L0 -5 Z';
    const handle = animateSvgPath(
      surface.element as SVGPathElement,
      [
        { offset: 0, d: first },
        { offset: 1, d: last },
      ],
      { duration: 2000 },
    );
    expect(surface.children).toHaveLength(1);
    const node = surface.children[0]!;
    expect(node.values.get('attributeName')).toBe('d');
    expect(node.values.get('values')).toBe(`${first};${last}`);
    expect(node.values.get('keyTimes')).toBe('0;1');
    expect(node.values.get('calcMode')).toBe('linear');
    expect(surface.begins).toEqual([1]);
    handle.cancel();
    handle.cancel();
    expect(surface.children).toHaveLength(0);
  });

  it('rejects an empty or backward contour plan before starting native motion', () => {
    const surface = host();
    expect(() =>
      animateSvgPath(
        surface.element as SVGPathElement,
        [
          { offset: 0, d: 'M0 0 Z' },
          { offset: 1, d: '' },
        ],
        { duration: 2000 },
      ),
    ).toThrow(RangeError);
    expect(surface.children).toHaveLength(0);
    expect(surface.begins).toHaveLength(0);
  });

  it('reads the public animated CSS path value without querying application state', () => {
    expect(pathFromComputedValue('path("M3 0 L0 3 Z")')).toBe('M3 0 L0 3 Z');
    expect(pathFromComputedValue("path('M4 0 L0 4 Z')")).toBe('M4 0 L0 4 Z');
    expect(pathFromComputedValue('none')).toBeNull();
  });
});
