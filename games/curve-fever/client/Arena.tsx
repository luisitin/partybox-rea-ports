// The arena, drawn by the TV: every worm's trail and head on one canvas, from the server's steering history (the closed form in
// server/world.ts), so the heads move smoothly between updates. Dumb: nothing here decides a crash. A worm that died stops at its
// time of death; the others are drawn up to `now` (or, when the round is not running, up to what was judged).
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useServerNow } from '@partybox/game-sdk/ui';
import { H, ROUND_MS, STEP_MS, W, inGap, posAt, segAt, segPos } from '../server/world';
import type { Worm } from '../server/world';
import { hueOf } from './timing';

export interface ArenaProps {
  worms: Worm[];
  /** Server time the worms were let go. */
  began: number;
  /** The round is not running: draw to what has been judged (`checked`), heads still. */
  frozen: boolean;
  /** Everything up to here (ms after `began`) has been judged. */
  checked: number;
  /** Names by worm id, for the labels at the start. */
  names: Record<string, string>;
  /** Waiting at the start spots: heads get an arrow and a name. */
  showStart: boolean;
}

const SCALE = 8;

function drawWorm(
  ctx: CanvasRenderingContext2D,
  worm: Worm,
  slot: number,
  t: number,
  showStart: boolean,
  name: string,
): void {
  const hue = hueOf(slot);
  const upTo = worm.died === null ? t : Math.min(t, worm.died);
  ctx.strokeStyle = `hsl(${hue} 85% 58%)`;
  ctx.lineWidth = 1.6 * SCALE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let open = false;
  ctx.beginPath();
  for (let k = 0; k * STEP_MS <= upTo; k++) {
    const tk = k * STEP_MS;
    if (inGap(worm, tk)) {
      open = false;
      continue;
    }
    const p = posAt(worm, tk);
    if (open) ctx.lineTo(p.x * SCALE, p.y * SCALE);
    else {
      ctx.moveTo(p.x * SCALE, p.y * SCALE);
      ctx.lineTo(p.x * SCALE + 0.01, p.y * SCALE);
      open = true;
    }
  }
  ctx.stroke();
  const head = segPos(segAt(worm, upTo), upTo);
  const hx = head.x * SCALE;
  const hy = head.y * SCALE;
  if (worm.died !== null && upTo >= worm.died) {
    // The crash: a cross where the worm stopped.
    ctx.strokeStyle = 'hsl(0 0% 100% / 0.9)';
    ctx.lineWidth = 0.5 * SCALE;
    ctx.beginPath();
    ctx.moveTo(hx - 1.8 * SCALE, hy - 1.8 * SCALE);
    ctx.lineTo(hx + 1.8 * SCALE, hy + 1.8 * SCALE);
    ctx.moveTo(hx + 1.8 * SCALE, hy - 1.8 * SCALE);
    ctx.lineTo(hx - 1.8 * SCALE, hy + 1.8 * SCALE);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = 'hsl(0 0% 100%)';
  ctx.beginPath();
  ctx.arc(hx, hy, 1.15 * SCALE, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue} 90% 50%)`;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.8 * SCALE, 0, Math.PI * 2);
  ctx.fill();
  if (showStart) {
    // An arrow ahead of the head and the name behind it, so everyone finds their worm before it moves.
    const ax = hx + Math.cos(head.a) * 6 * SCALE;
    const ay = hy + Math.sin(head.a) * 6 * SCALE;
    ctx.strokeStyle = `hsl(${hue} 85% 70%)`;
    ctx.lineWidth = 0.7 * SCALE;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(head.a) * 2.2 * SCALE, hy + Math.sin(head.a) * 2.2 * SCALE);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax - Math.cos(head.a - 0.6) * 2 * SCALE, ay - Math.sin(head.a - 0.6) * 2 * SCALE);
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(head.a + 0.6) * 2 * SCALE, ay - Math.sin(head.a + 0.6) * 2 * SCALE);
    ctx.stroke();
    ctx.fillStyle = 'hsl(0 0% 100%)';
    ctx.font = `800 ${3.4 * SCALE}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      name,
      hx - Math.cos(head.a) * 6 * SCALE,
      hy - Math.sin(head.a) * 6 * SCALE + 1.2 * SCALE,
    );
  }
}

export function Arena({
  worms,
  began,
  frozen,
  checked,
  names,
  showStart,
}: ArenaProps): JSX.Element {
  const now = useServerNow(33);
  const ref = useRef<HTMLCanvasElement>(null);
  // Historical preview fixtures have a rebased deadline but keep their original arena clock.
  const elapsed = Math.max(0, now - began);
  const t = frozen || elapsed > ROUND_MS ? checked : elapsed;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W * SCALE, H * SCALE);
    worms.forEach((worm, slot) => drawWorm(ctx, worm, slot, t, showStart, names[worm.id] ?? ''));
  }, [worms, t, names, showStart]);
  return (
    <canvas
      ref={ref}
      width={W * SCALE}
      height={H * SCALE}
      role="img"
      aria-label={`${worms.filter((w) => w.died === null).length} / ${worms.length}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
