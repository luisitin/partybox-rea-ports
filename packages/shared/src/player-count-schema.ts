// ADR-072: optional manifest roster bounds, isolated from the main contract's size budget.
import { z } from 'zod';

const range = z.tuple([z.number().int().min(1).max(16), z.number().int().min(1).max(16)]);
export const playerCountsSchema = z.object({
  setting: z.string(),
  default: range,
  overrides: z.record(z.string(), range),
});

export function validPlayerCounts(m: {
  minPlayers: number;
  maxPlayers: number;
  settings: readonly {
    key: string;
    type: string;
    default: unknown;
    options?: readonly { value: string }[];
  }[];
  playerCounts?: z.infer<typeof playerCountsSchema>;
}): boolean {
  const counts = m.playerCounts;
  if (!counts) return true;
  const spec = m.settings.find((s) => s.key === counts.setting);
  return (
    spec?.type === 'select' &&
    typeof spec.default === 'string' &&
    (!Object.hasOwn(counts.overrides, spec.default) ||
      counts.overrides[spec.default]?.every((n, i) => n === counts.default[i]) === true) &&
    Object.keys(counts.overrides).every((v) => spec.options?.some((o) => o.value === v) === true) &&
    [counts.default, ...Object.values(counts.overrides)].every(
      ([min, max]) => min <= max && min >= m.minPlayers && max <= m.maxPlayers,
    )
  );
}
