import { simplifyInkPoints } from '../server/ink';
import type { Point } from '../server/types';
import type { PendingInk } from './ink';

export const INK_PACKET_MS = 80;
export const INK_PACKET_POINTS = 24;

export interface InkPacketQueue {
  operations: PendingInk[];
  sentAt: number | null;
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
