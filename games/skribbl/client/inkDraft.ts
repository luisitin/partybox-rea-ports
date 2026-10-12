import { z } from '@partybox/game-sdk';
import { pointSchema, strokeSchema } from '../server/types';
import type { Stroke } from '../server/types';
import { dropMissingUndoTargets } from './ink';
import type { PendingInk } from './ink';
import type { InkPacketQueue } from './inkPackets';

export const INK_DRAFT_MAX_CHARS = 64_000;
export const INK_DRAFT_MAX_OPERATIONS = 256;
export type InkBrush = Pick<Stroke, 'color' | 'width'>;
export const DEFAULT_INK_BRUSH: InkBrush = { color: 0, width: 9 };
const brushSchema = strokeSchema.pick({ color: true, width: true }).strict();

const inkInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stroke'), stroke: strokeSchema.strict() }).strict(),
  z.object({ type: z.literal('clear') }).strict(),
  z.object({ type: z.literal('undo') }).strict(),
]);
const legacyTarget = strokeSchema
  .omit({ gesture: true })
  .extend({ points: z.array(pointSchema).min(1).max(3500) })
  .strict();
const operation = z
  .object({
    input: inkInput,
    undoTarget: z
      .union([
        z.object({ gesture: z.number().int().min(0).max(1_000_000_000) }).strict(),
        z.object({ empty: z.literal(true) }).strict(),
        z.object({ stroke: legacyTarget }).strict(),
      ])
      .optional(),
  })
  .strict()
  .refine((value) => value.undoTarget === undefined || value.input.type === 'undo');
const snapshot = z
  .object({
    version: z.literal(1),
    inkRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    operations: z.array(operation).max(INK_DRAFT_MAX_OPERATIONS),
    brush: brushSchema.optional(),
  })
  .strict()
  .refine((value) => value.operations.length > 0 || value.brush !== undefined);

/** Save only packets still in the FIFO, plus one dirty tail; sent pending ink never belongs here. */
export function saveInkDraft(
  queue: InkPacketQueue,
  tail: Stroke | undefined,
  inkRevision: number,
  brush?: InkBrush,
): string {
  if (queue.operations.length + (tail ? 1 : 0) > INK_DRAFT_MAX_OPERATIONS) return '';
  const operations = queue.operations.map(({ input, undoTarget }) => ({
    input,
    ...(undoTarget === undefined ? {} : { undoTarget }),
  }));
  if (tail) operations.push({ input: { type: 'stroke', stroke: tail } });
  if (!operations.length && brush === undefined) return '';
  const valid = snapshot.safeParse({ version: 1, inkRevision, operations, brush });
  if (!valid.success) return '';
  const saved = JSON.stringify(valid.data);
  return saved.length <= INK_DRAFT_MAX_CHARS ? saved : '';
}

export interface RestoredInkDraft {
  queue: InkPacketQueue;
  pending: PendingInk[];
  nextRevision: number;
  brush: InkBrush;
}

/** The scoped slot/key selects this artist turn; the first send waits a full local mount interval. */
export function restoreInkDraft(
  saved: string,
  strokes: Stroke[],
  inkRevision: number,
  mountedAt: number,
  paused = false,
): RestoredInkDraft {
  const empty: RestoredInkDraft = {
    queue: { operations: [], sentAt: mountedAt },
    pending: [],
    nextRevision: inkRevision,
    brush: { ...DEFAULT_INK_BRUSH },
  };
  if (!saved || saved.length > INK_DRAFT_MAX_CHARS) return empty;
  try {
    const parsed = snapshot.safeParse(JSON.parse(saved) as unknown);
    if (!parsed.success || parsed.data.inkRevision > inkRevision) return empty;
    let pending: PendingInk[] = parsed.data.operations.map((value) => ({ ...value, revision: 0 }));
    // A paused view can precede a held acknowledgement; only resume knows the final Undo target.
    if (!paused) pending = dropMissingUndoTargets(strokes, pending);
    if (inkRevision > Number.MAX_SAFE_INTEGER - pending.length) return empty;
    pending = pending.map((value, index) => ({ ...value, revision: inkRevision + index + 1 }));
    return {
      queue: { operations: pending, sentAt: mountedAt },
      pending,
      nextRevision: inkRevision + pending.length,
      brush: parsed.data.brush ?? { ...DEFAULT_INK_BRUSH },
    };
  } catch {
    return empty;
  }
}
