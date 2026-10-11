// Pointer capture belongs to the phone; the testable stream owns gestures, quotas and wire ACKs.
import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Input, Stroke } from '../server/types';
import { StrokeStream } from './StrokeStream';

interface DrawingSource {
  strokes: Stroke[];
  nextSeq: number;
  nextStroke: number;
  paused?: boolean;
}

interface DrawingControls {
  color: number;
  setColor: (color: number) => void;
  size: Stroke['size'];
  setSize: (size: Stroke['size']) => void;
  strokes: Stroke[];
  full: boolean;
  inkCount: number;
  down: (event: PointerEvent<SVGSVGElement>) => void;
  move: (event: PointerEvent<SVGSVGElement>) => void;
  up: (event: PointerEvent<SVGSVGElement>) => void;
  edit: (type: 'undo' | 'clear') => void;
}

function pointAt(event: PointerEvent<SVGSVGElement>): [number, number] {
  const svg = event.currentTarget;
  const inverse = svg.getScreenCTM()?.inverse();
  if (inverse) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(inverse);
    return [
      Math.round(Math.max(0, Math.min(1000, mapped.x))),
      Math.round(Math.max(0, Math.min(600, mapped.y))),
    ];
  }
  return [0, 0];
}

export function useDrawing(view: DrawingSource, send: (input: Input) => void): DrawingControls {
  const [color, setColor] = useState(0);
  const [size, setSize] = useState<Stroke['size']>(5);
  const [, repaint] = useState(0);
  const held = useRef<number | null>(null);
  const latestSend = useRef(send);
  latestSend.current = send;
  const streamRef = useRef<StrokeStream | null>(null);
  if (!streamRef.current)
    streamRef.current = new StrokeStream(view, (input) => latestSend.current(input));
  const stream = streamRef.current;
  stream.sync(view);
  if (view.paused) held.current = null;
  const paint = (): void => repaint((version) => version + 1);
  const down = (event: PointerEvent<SVGSVGElement>): void => {
    if (held.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!stream.begin(pointAt(event), color, size)) return;
    held.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    paint();
  };
  const move = (event: PointerEvent<SVGSVGElement>): void => {
    if (held.current !== event.pointerId) return;
    stream.move(pointAt(event));
    paint();
  };
  const up = (event: PointerEvent<SVGSVGElement>): void => {
    if (held.current !== event.pointerId) return;
    stream.end();
    held.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    paint();
  };
  const edit = (type: 'undo' | 'clear'): void => {
    held.current = null;
    stream.edit(type);
    paint();
  };
  const strokes = stream.strokes;
  return {
    color,
    setColor,
    size,
    setSize,
    strokes,
    full: stream.full,
    inkCount: strokes.length,
    down,
    move,
    up,
    edit,
  };
}
