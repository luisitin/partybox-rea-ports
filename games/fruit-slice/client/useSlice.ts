// A stroke is one input: freeze its geometry and preserve all fruit for the combo judgement.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Input, Point, SliceControllerView, Target } from '../server/types';

interface Stroke {
  pointer: number;
  wave: number;
  frame: number;
  until: number;
  targets: Target[];
  points: Point[];
}

export function normalizePoint(clientX: number, clientY: number, rect: DOMRect): Point {
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / Math.max(1, rect.width)) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / Math.max(1, rect.height)) * 100)),
  };
}

export function useSlice(view: SliceControllerView, send: (input: Input) => void, now: number) {
  const current = useRef({ view, send });
  const stroke = useRef<Stroke | null>(null);
  const sequence = useRef(view.lastSeq);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [hint, setHint] = useState('');
  const enabled =
    view.phaseId === 'play' && view.me.role === 'player' && !view.bombed && !view.paused;

  useEffect(() => {
    current.current = { view, send };
  }, [view, send]);

  const submit = useCallback((wave: number, frame: number, points: Point[]): void => {
    const latest = current.current;
    if (
      latest.view.phaseId !== 'play' ||
      latest.view.me.role !== 'player' ||
      latest.view.paused ||
      latest.view.bombed
    )
      return;
    if (wave !== latest.view.wave) return;
    sequence.current = Math.max(sequence.current + 1, latest.view.lastSeq + 1);
    latest.send({ type: 'slice', wave, frame, seq: sequence.current, points });
  }, []);

  const cancel = useCallback((): void => {
    stroke.current = null;
    setDrawing(null);
  }, []);

  const finish = useCallback((): void => {
    const active = stroke.current;
    if (!active) return;
    stroke.current = null;
    setDrawing(null);
    if (active.wave !== current.current.view.wave) {
      setHint('That wave passed — try a quick swipe');
      return;
    }
    const points = [...active.points];
    // A tap is a tiny stroke, never a client-supplied hit.
    if (points.length === 1) points.push({ ...points[0]!, x: Math.min(100, points[0]!.x + 0.25) });
    submit(active.wave, active.frame, points);
  }, [submit]);

  // The SDK clock owns the only ticker. Long holds submit before the sample expires.
  useEffect(() => {
    if (!enabled) cancel();
    else if (stroke.current && (now >= stroke.current.until || view.wave !== stroke.current.wave))
      finish();
  }, [enabled, now, view.wave, cancel, finish]);

  const append = (event: PointerEvent<HTMLDivElement>): void => {
    const active = stroke.current;
    if (!active || active.pointer !== event.pointerId) return;
    const rect =
      event.currentTarget.querySelector('svg')?.getBoundingClientRect() ??
      event.currentTarget.getBoundingClientRect();
    const point = normalizePoint(event.clientX, event.clientY, rect);
    const last = active.points[active.points.length - 1]!;
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.4) return;
    // Keep both ends and the entire stroke's shape within the protocol's 32-point budget.
    const points =
      active.points.length >= 32
        ? active.points.filter((_, i) => i % 2 === 0 || i === active.points.length - 1)
        : active.points;
    active.points = [...points, point];
    setDrawing({ ...active });
  };

  return {
    drawing: enabled && drawing?.wave === view.wave ? drawing : null,
    hint,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
        if (!enabled || stroke.current || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect =
          event.currentTarget.querySelector('svg')?.getBoundingClientRect() ??
          event.currentTarget.getBoundingClientRect();
        const active: Stroke = {
          pointer: event.pointerId,
          wave: view.wave,
          frame: view.frame,
          until: now + Math.max(50, Math.min(800, (view.wave + 1) * 2000 - view.frame - 350)),
          targets: view.targets,
          points: [normalizePoint(event.clientX, event.clientY, rect)],
        };
        stroke.current = active;
        setDrawing({ ...active });
        setHint('');
      },
      onPointerMove: append,
      onPointerUp: (event: PointerEvent<HTMLDivElement>): void => {
        if (stroke.current?.pointer !== event.pointerId) return;
        append(event);
        finish();
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    },
    tap: (target: Target): void => {
      if (!enabled) return;
      cancel();
      submit(view.wave, view.frame, [
        { x: Math.max(0, target.x - 1), y: target.y },
        { x: Math.min(100, target.x + 1), y: target.y },
      ]);
    },
  };
}
