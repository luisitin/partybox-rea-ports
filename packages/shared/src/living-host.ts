import { z } from 'zod';

/** Optional TV-only commentary. No game reducer consumes this channel. */
export const livingHostCueSchema = z.object({
  id: z.string().max(100),
  room: z.string().max(16),
  context: z.string().max(200),
  at: z.number().finite(),
  expires: z.number().finite(),
  text: z.string().max(240),
  headline: z.string().max(100).optional(),
  speechText: z.string().max(180).optional(),
  focusIds: z.array(z.string()).max(16).optional(),
  // Complete public names remain available when a spoken group summary is needed.
  focusPlayers: z
    .array(z.object({ id: z.string(), name: z.string(), score: z.number().finite() }))
    .max(16)
    .optional(),
  source: z.enum(['template', 'llm', 'quiet']),
  emotion: z.enum(['delighted', 'astonished', 'sympathetic', 'idle']),
  audio: z
    .string()
    .regex(/^\/api\/living-host\/audio\/[a-f0-9]{24}\.wav$/)
    .optional(),
  ms: z.number().nonnegative().optional(),
  timing: z
    .array(
      z.object({
        phoneme: z.string().max(8),
        start: z.number().nonnegative(),
        end: z.number().nonnegative(),
      }),
    )
    .max(510)
    .optional(),
});
export type LivingHostCue = z.infer<typeof livingHostCueSchema>;
