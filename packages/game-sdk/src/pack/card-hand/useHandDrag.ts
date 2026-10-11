// Press-and-drag for CardHand (docs/sdk/card-hand.md): a card lifts after a small move or a short
// hold (press.ts), rides above the finger (fixed, so no scroll box clips it), opens a gap in the fan
// under it, and is pulled in by a target that takes it. Pointer moves only record the finger; one
// frame loop places the cards, and React renders only when the gap or the target under it changes.
import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { buzz } from '../../ui/haptics';
import type { TableStore } from './CardTable';
import { cardEls, shake } from './handDom';
import type { CardPose, HandGeo } from './handDom';
import { fanLayout, nearestSlot, nearestTarget } from './handMath';
import type { TargetRect } from './handMath';
import { createPress } from './press';
import type { PressAt, Pressed } from './press';

/** A dragged card rides this far above the finger, a little bigger: your thumb never hides it. */
const RISE = 14;
const SCALE = 1.08;

interface Drag {
  ids: string[];
  grab: { x: number; y: number };
  w: number;
  h: number;
  x: number;
  y: number;
  lastX: number;
  tilt: number;
  pos: { x: number; y: number; r: number }[];
  origin: { x: number; y: number };
  fan: DOMRect;
  targets: TargetRect[];
  els: Map<string, HTMLElement>;
  over: string | null;
  gap: number | null;
  frame: number;
}

export interface HandDragDeps {
  fan: RefObject<HTMLDivElement | null>;
  /** A zero-size fixed span in the fan: where `position: fixed` puts (0, 0). */
  probe: RefObject<HTMLSpanElement | null>;
  store: TableStore;
  geo: RefObject<HandGeo>;
  still: RefObject<boolean>;
  /** Dropped into the fan: put `ids` at gap `gap` of the resting cards; false if nothing moved. */
  onMove: (ids: readonly string[], gap: number) => boolean;
  /** A slow tap (held still past the lift, never moved): pick the card as a tap does. */
  onTap: (id: string, now: number) => void;
  /** The drop that a target took starts its glide from here. */
  landing: RefObject<Map<string, CardPose> | null>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function useHandDrag({
  fan,
  probe,
  store,
  geo,
  still,
  onMove,
  onTap,
  landing,
}: HandDragDeps): {
  gap: number | null;
  /** True once for the click that follows a lift, wherever it lands (it must not pick). */
  swallowClick: () => boolean;
  /** Any press in the hand (capture phase): an old lift's guard no longer applies. */
  onPressCapture: () => void;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
  };
} {
  const [gap, setGap] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  // The hand's latest move and pick, for the press made on the first render.
  const latest = useRef({ onMove, onTap });
  useLayoutEffect(() => {
    latest.current = { onMove, onTap };
  });
  const home = useRef<{ from: Map<string, CardPose>; shake: boolean } | null>(null);

  // Only the transform, each frame: a custom property set here (it inherits) re-styled the card's
  // whole face every frame, most of a slow phone's frame (T-0342 review), so the grab is set at lift.
  const place = (d: Drag): void => {
    d.ids.forEach((id, k) => {
      const el = d.els.get(id);
      const p = d.pos[k];
      if (!el || !p) return;
      el.style.transform = `translate3d(${p.x - d.origin.x}px, ${p.y - d.origin.y}px, 0) rotate(${p.r}deg) scale(${SCALE})`;
    });
  };

  const step = (): void => {
    const d = drag.current;
    if (!d) return;
    const g = geo.current;
    const reduced = still.current;
    // Where the card is, not the finger: a sliver is grabbed by its edge, the gap opens under it.
    const cx = d.x - d.grab.x + d.w / 2,
      cy = d.y - d.grab.y - RISE + d.h / 2;
    const over = nearestTarget(d.targets, cx, cy);
    const entry = over === null ? undefined : store.targets.get(over);
    const takes = !!entry && !entry.disabled && entry.accepts(d.ids);
    let next: number | null = null;
    if (over === null && cy > d.fan.top + g.top - d.h * 0.2) {
      const rest = g.shown.filter((id) => !d.ids.includes(id)).length;
      const layout = fanLayout(rest + 1, g.w, g.h, g.options);
      next = nearestSlot(layout, cx - d.fan.left, cy - d.fan.top);
    }
    if (over !== d.over) {
      d.over = over;
      store.hover(over);
      if (over !== null) buzz(takes ? 8 : [12, 30, 12]);
    }
    if (next !== d.gap) {
      d.gap = next;
      setGap(next);
      if (next !== null) buzz(4);
    }
    let px = d.x - d.grab.x,
      py = d.y - d.grab.y - RISE;
    const rect = takes ? d.targets.find((t) => t.id === over) : undefined;
    if (rect) {
      // The magnet: a target that takes the cards pulls them toward its middle.
      px += (rect.left + rect.width / 2 - d.w / 2 - px) * 0.35;
      py += (rect.top + rect.height / 2 - d.h / 2 - py) * 0.35;
    }
    const vx = d.x - d.lastX;
    d.lastX = d.x;
    d.tilt = reduced ? 0 : d.tilt + (clamp(vx * 1.4, -14, 14) - d.tilt) * 0.25;
    d.pos.forEach((p, k) => {
      const f = k === 0 || reduced ? 1 : 0.38;
      p.x += (px + k * 7 - p.x) * f;
      p.y += (py + k * 4 - p.y) * f;
      p.r += (d.tilt + k * 5 - p.r) * f;
    });
    place(d);
    d.frame = requestAnimationFrame(step);
  };

  const lift = (p: Readonly<Pressed>): boolean => {
    const fanEl = fan.current;
    if (!fanEl || drag.current) return false;
    const g = geo.current;
    const slot = g.slots.get(p.id);
    if (!slot) return false;
    const selected = store.get().selected;
    const group =
      selected.includes(p.id) && selected.length > 1
        ? g.shown.filter((id) => selected.includes(id) && g.slots.has(id))
        : [p.id];
    const ids = [p.id, ...group.filter((id) => id !== p.id)];
    const fr = fanEl.getBoundingClientRect();
    const at = (id: string): { x: number; y: number; r: number } => {
      const s = g.slots.get(id) ?? slot;
      return { x: fr.left + s.x, y: fr.top + s.y, r: s.rotate };
    };
    const start = at(p.id);
    const origin = probe.current?.getBoundingClientRect();
    const rest = g.shown.filter((id) => !ids.includes(id));
    const before = g.shown.slice(0, g.shown.indexOf(p.id));
    const d: Drag = {
      ids,
      grab: { x: clamp(p.x0 - start.x, 0, g.cardW), y: clamp(p.y0 - start.y, 0, g.cardH) },
      w: g.cardW,
      h: g.cardH,
      x: p.x,
      y: p.y,
      lastX: p.x,
      tilt: 0,
      pos: ids.map(at),
      origin: { x: origin?.left ?? 0, y: origin?.top ?? 0 },
      fan: fr,
      targets: [...store.targets]
        .filter(([, t]) => t.el && !t.disabled)
        .map(([id, t]) => {
          const r = t.el!.getBoundingClientRect();
          return { id, left: r.left, top: r.top, width: r.width, height: r.height };
        }),
      els: cardEls(fanEl),
      over: null,
      gap: rest.filter((id) => before.includes(id)).length,
      frame: 0,
    };
    for (const id of ids) {
      d.els.get(id)?.style.setProperty('--grab-x', `${d.grab.x}px`);
      d.els.get(id)?.style.setProperty('--grab-y', `${d.grab.y}px`);
    }
    drag.current = d;
    setGap(d.gap);
    store.drag(ids);
    buzz(10);
    d.frame = requestAnimationFrame(step);
    return true;
  };

  const drop = (d: Drag, cancel: boolean): void => {
    cancelAnimationFrame(d.frame);
    drag.current = null;
    const over = cancel ? null : d.over;
    const from = new Map<string, CardPose>(
      d.ids.map((id, k) => {
        const p = d.pos[k]!;
        return [id, { x: p.x, y: p.y, r: p.r, scale: SCALE, grab: d.grab }];
      }),
    );
    setGap(null);
    if (over !== null) {
      // A target that does not take them refuses them (and its onRefuse says why).
      landing.current = from;
      if (store.drop(over, d.ids, performance.now())) {
        buzz(15);
        return;
      }
      landing.current = null;
    }
    home.current = { from, shake: over !== null };
    if (over !== null) buzz([25, 40, 25]);
    // Back in the gap it came from (or no gap): nothing moved, nothing to say.
    else if (!cancel && d.gap !== null && latest.current.onMove(d.ids, d.gap)) buzz(8);
    store.drag(null);
  };

  // While dragging, the render leaves the transform to the frame loop: put the cards back on it
  // before paint. After a drop that went nowhere (or home), the cards spring from where they were.
  useLayoutEffect(() => {
    const d = drag.current;
    if (d) {
      place(d);
      return;
    }
    const back = home.current;
    const fanEl = fan.current;
    if (!back || !fanEl || store.get().dragging) return;
    home.current = null;
    const els = cardEls(fanEl);
    for (const [id, pose] of back.from) {
      const el = els.get(id);
      if (!el) continue;
      const final = el.style.transform;
      const now = el.getBoundingClientRect();
      const g = geo.current;
      const dx = pose.x + (g.cardW * pose.scale) / 2 - (now.left + now.width / 2);
      const dy = pose.y + (g.cardH * pose.scale) / 2 - (now.top + now.height / 2);
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px) ${final}`;
      void el.offsetWidth;
      el.style.transition = '';
      el.style.transform = final;
      if (back.shake) shake(el, still.current);
    }
  });

  // Made once: its hooks reach the latest render through refs (drag, geo, latest).
  const [press] = useState(() =>
    createPress({
      lift,
      follow: (x, y) => {
        const d = drag.current;
        if (d) {
          d.x = x;
          d.y = y;
        }
      },
      land: (back) => {
        const d = drag.current;
        if (d) drop(d, back);
      },
      tap: (id, now) => latest.current.onTap(id, now),
    }),
  );
  // The same handlers on every render, so the memoised cards keep them (CardButton).
  const [handlers] = useState(() => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || press.busy() || drag.current) return;
      const id = e.currentTarget.dataset['card'];
      if (!id || !geo.current.slots.has(id)) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a synthetic event: no capture, the gesture still works on this element */
      }
      press.down(id, at(e));
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => press.move(at(e)),
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => press.end(at(e), false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => press.end(at(e), true),
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => press.end(at(e), true),
  }));

  return { gap, swallowClick: press.swallow, onPressCapture: press.reset, handlers };
}

const at = (e: ReactPointerEvent<HTMLElement>): PressAt => ({
  pointerId: e.pointerId,
  x: e.clientX,
  y: e.clientY,
  t: e.timeStamp,
});
