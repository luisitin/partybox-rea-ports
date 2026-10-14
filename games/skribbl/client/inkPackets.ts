import { simplifyInkPoints } from '../server/ink';
import type { Point, Stroke } from '../server/types';
import { dropMissingUndoTargets } from './ink';
import type { PendingInk } from './ink';

export const INK_PACKET_MS = 80;
export const INK_PACKET_POINTS = 24;

export interface InkPacketQueue {
  operations: PendingInk[];
  sentAt: number | null;
}

export interface ActiveInkStroke extends Stroke {
  id: number;
  dirty: boolean;
}

/** Snapshot only the dirty fragment; an unchanged flushed endpoint is not another stroke. */
export function activeInkTail(active: ActiveInkStroke): Stroke | undefined {
  if (active.id === -1 || !active.dirty || !active.points.length) return undefined;
  return {
    color: active.color,
    width: active.width,
    gesture: active.gesture,
    points: boundInkPoints([...active.points]),
  };
}

export interface InkPacketSnapshot {
  queue: InkPacketQueue;
  pending: PendingInk[];
  inkRevision: number;
  previousRevision: number;
  paused: boolean;
  wasPaused: boolean;
  tail?: Stroke;
  strokes?: Stroke[];
}

/** Pause retains only packets that have never left this phone, not ambiguous sent operations. */
export function reconcileInkPackets({
  queue,
  pending,
  inkRevision,
  previousRevision,
  paused,
  wasPaused,
  tail,
  strokes = [],
}: InkPacketSnapshot): { queue: InkPacketQueue; pending: PendingInk[]; nextRevision: number } {
  if (inkRevision < previousRevision) {
    queue = clearInkPackets(queue);
    pending = [];
  } else if (paused || wasPaused) {
    let held = [...queue.operations];
    if (paused && !wasPaused && tail?.points.length)
      held.push({
        revision: 0,
        input: { type: 'stroke', stroke: { ...tail, points: boundInkPoints([...tail.points]) } },
      });
    if (!paused) held = dropMissingUndoTargets(strokes, held);
    const operations = held.map((operation, index) => ({
      ...operation,
      revision: inkRevision + index + 1,
    }));
    queue = { ...queue, operations };
    pending = operations;
  } else pending = pending.filter((operation) => operation.revision > inkRevision);
  return {
    queue,
    pending,
    nextRevision: Math.max(inkRevision, pending.at(-1)?.revision ?? inkRevision),
  };
}

export function emptyInkPackets(): InkPacketQueue {
  return { operations: [], sentAt: null };
}

/** Keep edits and strokes distinct: every operation already owns one optimistic revision. */
export function enqueueInkPacket(queue: InkPacketQueue, operation: PendingInk): InkPacketQueue {
  return { ...queue, operations: [...queue.operations, operation] };
}

/** Preserve the last send time across pause/reset so clearing cannot permit a transport burst. */
export function clearInkPackets(queue: InkPacketQueue): InkPacketQueue {
  return { ...queue, operations: [] };
}

export function inkPacketReady(queue: InkPacketQueue, now: number): boolean {
  return Number.isFinite(now) && (queue.sentAt === null || now - queue.sentAt >= INK_PACKET_MS);
}

/** At most one packet per tick; a late tick never catches up by sending several at once. */
export function takeInkPacket(
  queue: InkPacketQueue,
  now: number,
): { queue: InkPacketQueue; operation?: PendingInk } {
  if (!queue.operations.length || !inkPacketReady(queue, now)) return { queue };
  return {
    queue: { operations: queue.operations.slice(1), sentAt: now },
    operation: queue.operations[0]!,
  };
}

/** Bound coalesced samples before enqueueing while retaining endpoints and the strongest bends. */
export function boundInkPoints(points: Point[]): Point[] {
  return simplifyInkPoints(points, INK_PACKET_POINTS);
}
