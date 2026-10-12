// Native SVG transforms keep vector geometry in the SVG renderer. This adapter
// consumes bounded presentation samples; it never advances physics or runs a frame loop.
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_TRANSFORM_FRAMES = 121;

export interface SvgTransformFrame {
  offset: number;
  transform: string;
}

interface TransformValues {
  offset: number;
  x: number;
  y: number;
  scale: number;
}

export interface SvgMotionHandle {
  cancel(): void;
}

export interface SvgPathFrame {
  offset: number;
  d: string;
}

function transformValues(frames: readonly SvgTransformFrame[]): TransformValues[] {
  if (frames.length < 2 || frames.length > MAX_TRANSFORM_FRAMES)
    throw new RangeError('SVG transform motion requires 2 to 121 samples.');
  let previous = -1;
  return frames.map(({ offset, transform }, index) => {
    const values = /^matrix\(([^)]+)\)$/.exec(transform)?.[1]?.split(',').map(Number);
    if (
      !Number.isFinite(offset) ||
      offset <= previous ||
      (index === 0 && offset !== 0) ||
      (index === frames.length - 1 && offset !== 1) ||
      !values ||
      values.length !== 6 ||
      !values.every(Number.isFinite)
    )
      throw new RangeError('SVG transform samples require finite, ordered offsets from 0 to 1.');
    previous = offset;
    const [a, b, c, d, x, y] = values as [number, number, number, number, number, number];
    if (a <= 0 || a !== d || b !== 0 || c !== 0)
      throw new RangeError('SVG camera motion requires a positive uniform scale and translation.');
    return { offset, x, y, scale: a };
  });
}

function timing(options: KeyframeAnimationOptions): { duration: number; spline: string | null } {
  if (
    typeof options.duration !== 'number' ||
    !Number.isFinite(options.duration) ||
    options.duration <= 0
  )
    throw new RangeError('SVG transform motion requires a positive finite duration.');
  const easing = options.easing ?? 'linear';
  const spline = /^cubic-bezier\(([^)]+)\)$/.exec(easing)?.[1]?.split(',').map(Number);
  if (
    easing !== 'linear' &&
    (!spline ||
      spline.length !== 4 ||
      !spline.every(Number.isFinite) ||
      spline[0]! < 0 ||
      spline[0]! > 1 ||
      spline[2]! < 0 ||
      spline[2]! > 1)
  )
    throw new RangeError('SVG transform motion supports linear or cubic-bezier timing.');
  return { duration: options.duration, spline: spline ? spline.join(' ') : null };
}

// The SVG spec post-multiplies additive animateTransform effects. Translate
// (replace), then scale (sum), therefore produces T*S: matrix(s,0,0,s,x,y).
// https://www.w3.org/TR/SVG11/animate.html#AnimateTransformElement
export function animateSvgTransform(
  element: SVGGraphicsElement,
  frames: readonly SvgTransformFrame[],
  options: KeyframeAnimationOptions,
): SvgMotionHandle {
  const values = transformValues(frames);
  const { duration, spline } = timing(options);
  const nodes = (['translate', 'scale'] as const).map((type) => {
    const node = element.ownerDocument.createElementNS(SVG_NAMESPACE, 'animateTransform');
    node.setAttribute('attributeName', 'transform');
    node.setAttribute('type', type);
    node.setAttribute('additive', type === 'translate' ? 'replace' : 'sum');
    node.setAttribute('begin', 'indefinite');
    node.setAttribute('dur', `${duration}ms`);
    node.setAttribute('fill', 'freeze');
    node.setAttribute('calcMode', spline ? 'spline' : 'linear');
    node.setAttribute('keyTimes', values.map((value) => value.offset).join(';'));
    node.setAttribute(
      'values',
      values
        .map((value) => (type === 'translate' ? `${value.x} ${value.y}` : `${value.scale}`))
        .join(';'),
    );
    if (spline)
      node.setAttribute(
        'keySplines',
        values
          .slice(1)
          .map(() => spline)
          .join(';'),
      );
    return node;
  });
  // A CSS transform would override the SVG presentation attribute animation.
  element.style.removeProperty('transform');
  for (const node of nodes) element.appendChild(node);
  // Begin only after both effects exist, on the same SVG presentation timeline.
  for (const node of nodes) node.beginElement();
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      for (const node of nodes) node.remove();
    },
  };
}

export function setSvgTransform(element: SVGGraphicsElement, transform: string): void {
  element.style.removeProperty('transform');
  if (transform) element.setAttribute('transform', transform);
  else element.removeAttribute('transform');
}

export function animateSvgPath(
  element: SVGPathElement,
  frames: readonly SvgPathFrame[],
  options: KeyframeAnimationOptions,
): SvgMotionHandle {
  const { duration, spline } = timing(options);
  if (frames.length < 2 || frames.length > MAX_TRANSFORM_FRAMES)
    throw new RangeError('SVG path motion requires 2 to 121 samples.');
  let previous = -1;
  for (const [index, frame] of frames.entries()) {
    if (
      !Number.isFinite(frame.offset) ||
      frame.offset <= previous ||
      (index === 0 && frame.offset !== 0) ||
      (index === frames.length - 1 && frame.offset !== 1) ||
      !frame.d.trim()
    )
      throw new RangeError('SVG paths require nonempty, ordered samples from 0 to 1.');
    previous = frame.offset;
  }
  const node = element.ownerDocument.createElementNS(SVG_NAMESPACE, 'animate');
  node.setAttribute('attributeName', 'd');
  node.setAttribute('begin', 'indefinite');
  node.setAttribute('dur', `${duration}ms`);
  node.setAttribute('fill', 'freeze');
  node.setAttribute('calcMode', spline ? 'spline' : 'linear');
  node.setAttribute('keyTimes', frames.map((frame) => frame.offset).join(';'));
  node.setAttribute('values', frames.map((frame) => frame.d).join(';'));
  if (spline)
    node.setAttribute(
      'keySplines',
      frames
        .slice(1)
        .map(() => spline)
        .join(';'),
    );
  element.appendChild(node);
  node.beginElement();
  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      node.remove();
    },
  };
}

export function pathFromComputedValue(value: string): string | null {
  return /^path\((["'])(.*)\1\)$/.exec(value.trim())?.[2] ?? null;
}

export function readSvgPath(element: SVGPathElement): string | null {
  return (
    pathFromComputedValue(getComputedStyle(element).getPropertyValue('d')) ??
    element.getAttribute('d')
  );
}

// getCTM includes SVG viewBox projection. Remove the chosen ancestor's matrix
// before sampling camera, cell pose, or text baseline, including TV letterboxing.
export function readSvgTransform(
  element: Pick<SVGGraphicsElement, 'getCTM'>,
  reference: Pick<SVGGraphicsElement, 'getCTM'>,
): string | null {
  const matrix = element.getCTM();
  const ancestor = reference.getCTM();
  if (!matrix || !ancestor) return null;
  const denominator = ancestor.a * ancestor.d - ancestor.b * ancestor.c;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < Number.EPSILON) return null;
  const x = matrix.e - ancestor.e;
  const y = matrix.f - ancestor.f;
  const values = [
    (ancestor.d * matrix.a - ancestor.c * matrix.b) / denominator,
    (ancestor.a * matrix.b - ancestor.b * matrix.a) / denominator,
    (ancestor.d * matrix.c - ancestor.c * matrix.d) / denominator,
    (ancestor.a * matrix.d - ancestor.b * matrix.c) / denominator,
    (ancestor.d * x - ancestor.c * y) / denominator,
    (ancestor.a * y - ancestor.b * x) / denominator,
  ];
  return values.every(Number.isFinite) ? `matrix(${values.join(', ')})` : null;
}
