// Content pack schemas. `packs` maps content/<name>.json → its zod schema; the contract suite
// validates every pack with it. Games with several pack shapes list one schema per pack.
import { z } from '@partybox/game-sdk';

export const wordsPackSchema = z.object({
  prompt: z.string().min(1).max(120),
  words: z.array(z.string().min(1).max(24)).min(10),
});
export type WordsPack = z.infer<typeof wordsPackSchema>;

export const packs = { words: wordsPackSchema } as const;
