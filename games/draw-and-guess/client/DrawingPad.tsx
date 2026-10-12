import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, PointerEvent } from 'react';
import { useServerNow, useT, useThemeColor } from '@partybox/game-sdk/ui';
import type { Input, Point, Stroke } from '../server/types';
import { canvasContentRect, drawingPoint, finishDrawingPoints } from './drawingGeometry';
import { gestureCount, nextGesture, previewInk } from './ink';
import type { InkOperation, PendingInk } from './ink';
import {
  boundInkPoints,
  clearInkPackets,
  emptyInkPackets,
  enqueueInkPacket,
  inkPacketReady,
  takeInkPacket,
} from './inkPackets';
import { COLORS, WIDTHS } from './palette';
import { STRINGS } from './strings';
import styles from './DrawingPad.module.css';

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, colors: string[]): void {
  const first = stroke.points[0];
  if (!first) return;
  ctx.strokeStyle = colors[stroke.color] ?? colors[0] ?? '';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(first[0], first[1], stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  stroke.points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.stroke();
}

export function DrawingPad({
  strokes,
  inkRevision,
  disabled,
  send,
}: {
  strokes: Stroke[];
  inkRevision: number;
  disabled: boolean;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState<4 | 9 | 18>(9);
  const [localCount, setLocalCount] = useState(gestureCount(strokes));
  const [localFragments, setLocalFragments] = useState(strokes.length);
  const [clearArmed, setClearArmed] = useState(false);
  const tick = useServerNow(40, disabled);
  const ink = useThemeColor('--pb-text', '');
  const rose = useThemeColor('--pb-accent', '');
  const gold = useThemeColor('--pb-accent-2', '');
  const mint = useThemeColor('--pb-accent-3', '');
  const sky = useThemeColor('--pb-info', '');
  const gray = useThemeColor('--pb-text-muted', '');
  const colors = useMemo(
    () => [ink, rose, gold, mint, sky, gray],
    [ink, rose, gold, mint, sky, gray],
  );
  const previousRevision = useRef(inkRevision);
  const sentRevision = useRef(inkRevision);
  const serial = useRef(0);
  const pending = useRef<PendingInk[]>([]);
  const outgoing = useRef(emptyInkPackets());
  const active = useRef({
    id: -1,
    points: [] as Point[],
    color: 0,
    gesture: 0,
    width: 9 as 4 | 9 | 18,
    dirty: false,
  });
  const full = localFragments >= 240;

  const repaint = (): void => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1000, 600);
    previewInk(strokes, pending.current).forEach((stroke) => paintStroke(ctx, stroke, colors));
    if (active.current.id !== -1 && active.current.dirty) paintStroke(ctx, active.current, colors);
  };

  useEffect(() => {
    // Edits have revisions too: a delayed Clear acknowledgement cannot consume a later stroke.
    if (inkRevision < previousRevision.current)
      outgoing.current = clearInkPackets(outgoing.current);
    pending.current =
      inkRevision < previousRevision.current
        ? []
        : pending.current.filter((operation) => operation.revision > inkRevision);
    previousRevision.current = inkRevision;
    sentRevision.current = Math.max(inkRevision, pending.current.at(-1)?.revision ?? inkRevision);
    const picture = previewInk(strokes, pending.current);
    setLocalCount(gestureCount(picture));
    setLocalFragments(picture.length);
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, inkRevision, colors]);
  useEffect(() => {
    if (!disabled) return;
    setClearArmed(false);
    const id = active.current.id;
    active.current.id = -1;
    active.current.points = [];
    active.current.dirty = false;
    if (canvas.current?.hasPointerCapture(id)) canvas.current.releasePointerCapture(id);
    pending.current = [];
    outgoing.current = clearInkPackets(outgoing.current);
    sentRevision.current = inkRevision;
    setLocalCount(gestureCount(strokes));
    setLocalFragments(strokes.length);
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, inkRevision]);
  useEffect(
    () => () => {
      outgoing.current = clearInkPackets(outgoing.current);
      pending.current = [];
      active.current.id = -1;
      active.current.points = [];
      active.current.dirty = false;
    },
    [],
  );

  const queue = (input: InkOperation): void => {
    sentRevision.current = Math.max(sentRevision.current, inkRevision) + 1;
    const operation = { revision: sentRevision.current, input };
    pending.current.push(operation);
    outgoing.current = enqueueInkPacket(outgoing.current, operation);
    const picture = previewInk(strokes, pending.current);
    setLocalCount(gestureCount(picture));
    setLocalFragments(picture.length);
  };

  const flush = (): void => {
    const drag = active.current;
    if (drag.id === -1 || !drag.dirty || !drag.points.length || disabled) return;
    const stroke: Stroke = {
      color: drag.color,
      width: drag.width,
      gesture: drag.gesture,
      points: boundInkPoints(drag.points),
    };
    queue({ type: 'stroke', stroke });
    drag.points = drag.points.slice(-1);
    drag.dirty = false;
  };
  useEffect(() => {
    if (disabled) return;
    // The SDK tick wakes the sender; only a local monotonic clock controls socket spacing.
    // A server-offset correction or acknowledgement must never accelerate this queue.
    const at = performance.now();
    if (!inkPacketReady(outgoing.current, at)) return;
    if (!outgoing.current.operations.length) flush();
    const packet = takeInkPacket(outgoing.current, at);
    outgoing.current = packet.queue;
    if (packet.operation) send(packet.operation.input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, disabled]);
  const finish = (event: PointerEvent<HTMLCanvasElement>): void => {
    const drag = active.current;
    if (drag.id !== event.pointerId) return;
    if (!disabled) {
      const points = finishDrawingPoints(
        drag.points,
        event.type,
        event.clientX,
        event.clientY,
        paperBounds(),
      );
      if (points !== drag.points) {
        drag.points = boundInkPoints(points);
        drag.dirty = true;
      }
    }
    flush();
    active.current.id = -1;
    active.current.points = [];
    active.current.dirty = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    repaint();
  };
  const paperBounds = (): ReturnType<typeof canvasContentRect> =>
    canvasContentRect(canvas.current!.getBoundingClientRect(), getComputedStyle(canvas.current!));
  const start = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (
      disabled ||
      previewInk(strokes, pending.current).length >= 240 ||
      !event.isPrimary ||
      event.button !== 0 ||
      active.current.id !== -1
    )
      return;
    event.preventDefault();
    setClearArmed(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    serial.current = nextGesture(strokes, pending.current, serial.current);
    active.current = {
      id: event.pointerId,
      points: [drawingPoint(event.clientX, event.clientY, paperBounds())],
      color,
      gesture: serial.current,
      width,
      dirty: true,
    };
    repaint();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>): void => {
    const drag = active.current;
    if (drag.id !== event.pointerId || disabled) return;
    event.preventDefault();
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const rect = paperBounds();
    for (const sample of events.length ? events : [event.nativeEvent]) {
      const point = drawingPoint(sample.clientX, sample.clientY, rect);
      const last = drag.points.at(-1);
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 2) continue;
      drag.points.push(point);
      drag.dirty = true;
    }
    drag.points = boundInkPoints(drag.points);
    repaint();
  };
  const edit = (type: 'clear' | 'undo'): void => {
    if (disabled) return;
    setClearArmed(false);
    flush();
    const id = active.current.id;
    active.current.id = -1;
    active.current.points = [];
    active.current.dirty = false;
    if (canvas.current?.hasPointerCapture(id)) canvas.current.releasePointerCapture(id);
    queue({ type });
    repaint();
  };

  return (
    <div className={styles.pad}>
      <div className={styles.paper}>
        <canvas
          ref={canvas}
          width={1000}
          height={600}
          aria-label={L('Drawing pad. Drag a finger to draw.')}
          role="img"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        >
          {L('Drawing pad. Drag a finger to draw.')}
        </canvas>
      </div>
      <div className={styles.colors} role="group" aria-label={L('Ink color')}>
        {COLORS.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={color === index}
            disabled={disabled}
            onClick={() => setColor(index)}
          >
            <i style={{ background: `var(${item.token})` }} aria-hidden="true" />
            {L(item.name)}
            {color === index ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <div className={styles.sizes} role="group" aria-label={L('Line thickness')}>
        {WIDTHS.map((item) => (
          <button
            key={item.width}
            type="button"
            aria-pressed={width === item.width}
            disabled={disabled}
            onClick={() => setWidth(item.width)}
          >
            {L(item.name)}
            {width === item.width ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <div className={styles.edits}>
        <button type="button" disabled={disabled || localCount === 0} onClick={() => edit('undo')}>
          {L('Undo')}
        </button>
        <button
          type="button"
          disabled={disabled || localCount === 0}
          aria-pressed={clearArmed}
          onClick={() => (clearArmed ? edit('clear') : setClearArmed(true))}
        >
          {clearArmed ? L('Tap again to clear') : L('Clear')}
        </button>
        <span role="status">
          {clearArmed
            ? L('Tap again to clear the whole picture.')
            : full
              ? L('Canvas full — undo or clear to keep drawing.')
              : L('Pictures, not letters!')}
        </span>
      </div>
    </div>
  );
}
