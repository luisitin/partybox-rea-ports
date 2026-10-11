import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, PointerEvent } from 'react';
import { useT, useThemeColor } from '@partybox/game-sdk/ui';
import type { Input, Point, Stroke } from '../server/types';
import { gestureCount, nextGesture, previewInk } from './ink';
import type { InkOperation, PendingInk } from './ink';
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
  const ink = useThemeColor('--pb-text', '');
  const rose = useThemeColor('--pb-accent', '');
  const gold = useThemeColor('--pb-accent-2', '');
  const mint = useThemeColor('--pb-accent-3', '');
  const sky = useThemeColor('--pb-info', '');
  const violet = useThemeColor('--pb-player-5', '');
  const colors = useMemo(
    () => [ink, rose, gold, mint, sky, violet],
    [ink, rose, gold, mint, sky, violet],
  );
  const previousRevision = useRef(inkRevision);
  const sentRevision = useRef(inkRevision);
  const serial = useRef(0);
  const pending = useRef<PendingInk[]>([]);
  const active = useRef({
    id: -1,
    points: [] as Point[],
    color: 0,
    gesture: 0,
    width: 9 as 4 | 9 | 18,
    sentAt: 0,
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
    const id = active.current.id;
    active.current.id = -1;
    active.current.points = [];
    if (canvas.current?.hasPointerCapture(id)) canvas.current.releasePointerCapture(id);
    pending.current = [];
    sentRevision.current = inkRevision;
    setLocalCount(gestureCount(strokes));
    setLocalFragments(strokes.length);
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, inkRevision]);

  const queue = (input: InkOperation): void => {
    sentRevision.current = Math.max(sentRevision.current, inkRevision) + 1;
    pending.current.push({ revision: sentRevision.current, input });
    send(input);
    const picture = previewInk(strokes, pending.current);
    setLocalCount(gestureCount(picture));
    setLocalFragments(picture.length);
  };

  const flush = (at: number): void => {
    const drag = active.current;
    if (!drag.dirty || disabled) return;
    const stroke: Stroke = {
      color: drag.color,
      width: drag.width,
      gesture: drag.gesture,
      points: [...drag.points],
    };
    queue({ type: 'stroke', stroke });
    drag.points = drag.points.slice(-1);
    drag.sentAt = at;
    drag.dirty = false;
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (active.current.id !== event.pointerId) return;
    flush(event.timeStamp);
    active.current.id = -1;
    active.current.points = [];
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    repaint();
  };
  const pointAt = (x: number, y: number): Point => {
    const rect = canvas.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, ((x - rect.left) / rect.width) * 1000)),
      Math.max(0, Math.min(600, ((y - rect.top) / rect.height) * 600)),
    ];
  };
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
    event.currentTarget.setPointerCapture(event.pointerId);
    serial.current = nextGesture(strokes, pending.current, serial.current);
    active.current = {
      id: event.pointerId,
      points: [pointAt(event.clientX, event.clientY)],
      color,
      gesture: serial.current,
      width,
      sentAt: event.timeStamp,
      dirty: true,
    };
    repaint();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>): void => {
    const drag = active.current;
    if (drag.id !== event.pointerId || disabled) return;
    event.preventDefault();
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of events.length ? events : [event.nativeEvent]) {
      const point = pointAt(sample.clientX, sample.clientY);
      const last = drag.points.at(-1);
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 2) continue;
      drag.points.push(point);
      drag.dirty = true;
      if (drag.points.length >= 24) flush(event.timeStamp);
    }
    // Event time is local only; it controls packet density, never game time or scoring.
    if (event.timeStamp - drag.sentAt >= 80) flush(event.timeStamp);
    repaint();
  };
  const edit = (type: 'clear' | 'undo'): void => {
    const id = active.current.id;
    active.current.id = -1;
    active.current.points = [];
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
        <button type="button" disabled={disabled || localCount === 0} onClick={() => edit('clear')}>
          {L('Clear')}
        </button>
        <span role="status">
          {full ? L('Canvas full — undo or clear to keep drawing.') : L('Pictures, not letters!')}
        </span>
      </div>
    </div>
  );
}
