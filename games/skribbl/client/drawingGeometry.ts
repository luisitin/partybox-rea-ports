import type { Point } from '../server/types';

export interface DrawingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type CanvasStyle = Pick<
  CSSStyleDeclaration,
  | 'width'
  | 'height'
  | 'borderLeftWidth'
  | 'borderRightWidth'
  | 'borderTopWidth'
  | 'borderBottomWidth'
>;

/** The canvas uses content-box sizing; strokes occupy its bitmap, never its CSS border. */
export function canvasContentRect(rect: DrawingRect, style: CanvasStyle): DrawingRect {
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  const left = parseFloat(style.borderLeftWidth);
  const right = parseFloat(style.borderRightWidth);
  const top = parseFloat(style.borderTopWidth);
  const bottom = parseFloat(style.borderBottomWidth);
  const scaleX = rect.width / (width + left + right);
  const scaleY = rect.height / (height + top + bottom);
  return {
    left: rect.left + left * scaleX,
    top: rect.top + top * scaleY,
    width: width * scaleX,
    height: height * scaleY,
  };
}

export function drawingPoint(x: number, y: number, rect: DrawingRect): Point {
  if (!(rect.width > 0 && rect.height > 0)) return [0, 0];
  return [
    Math.max(0, Math.min(1000, ((x - rect.left) / rect.width) * 1000)),
    Math.max(0, Math.min(600, ((y - rect.top) / rect.height) * 600)),
  ];
}

/** A release can carry the final motion; cancellation coordinates do not describe new ink. */
export function finishDrawingPoints(
  points: Point[],
  eventType: string,
  x: number,
  y: number,
  rect: DrawingRect,
): Point[] {
  if (eventType !== 'pointerup' || !(rect.width > 0 && rect.height > 0)) return points;
  const point = drawingPoint(x, y, rect);
  const last = points.at(-1);
  if (last?.[0] === point[0] && last[1] === point[1]) return points;
  return [...points, point];
}
