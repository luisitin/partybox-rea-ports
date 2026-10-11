// Awards (audit #9): each game hands out a few, one per stat, skipped when nobody earned it. What
// differs is the tie policy, so that is the one thing a game picks: every holder shares it (maybe
// up to a cap), a tie gives it to nobody, or one holder wins by the game's own order (optionally
// preferring someone without an award yet, I-474). Pure.
import type { GameAward } from '@partybox/shared';

export interface AwardRule {
  id: string;
  title: string;
  /** The line under the title: fixed, or built from the winning value and the holder. */
  description: string | ((best: number, playerId: string) => string);
  /** A player's value for this award; `null` = not in the running. */
  value: (playerId: string) => number | null;
  /** The value it takes to earn it at all (default: anything above 0). */
  min?: number;
  /** The lowest value wins (a fastest time, fewest votes) instead of the highest. */
  lowest?: boolean;
}

export type TiePolicy =
  /** Every holder gets it; skipped when more than `max` share it, or more than `fraction` of the
   *  candidates (a whole table reading it right singles nobody out). */
  | { kind: 'share'; max?: number; fraction?: number }
  /** Only a sole holder gets it: a tie gives nobody the award. */
  | { kind: 'none' }
  /** One holder: the first by `order` (default: candidate order); with `spread`, someone who has
   *  no award yet comes first (I-474). */
  | { kind: 'one'; order?: (a: string, b: string) => number; spread?: boolean };

export interface AwardOptions {
  /** Who can win, in the order ties list them. */
  candidates: readonly string[];
  ties: TiePolicy;
  /** An award's id for a holder (the results screens key by it); default: the rule's id. */
  idFor?: (rule: AwardRule, playerId: string, index: number) => string;
  /** Who already holds an award (`spread`): pass one set to several calls, and give it the holders
   *  of awards a game hands out by itself. Every holder picked here is added to it. */
  won?: Set<string>;
}

function earns(rule: AwardRule, v: number | null): v is number {
  if (v === null || !Number.isFinite(v)) return false;
  return rule.min === undefined ? rule.lowest === true || v > 0 : v >= rule.min;
}

/** The awards `rules` hand out, in rule order (holders in candidate order). */
export function pickAwards(rules: readonly AwardRule[], options: AwardOptions): GameAward[] {
  const out: GameAward[] = [];
  const won = options.won ?? new Set<string>();
  const { candidates, ties } = options;
  for (const rule of rules) {
    const scored = candidates
      .map((id) => ({ id, v: rule.value(id) }))
      .filter((x): x is { id: string; v: number } => earns(rule, x.v));
    if (scored.length === 0) continue;
    const best = rule.lowest
      ? Math.min(...scored.map((x) => x.v))
      : Math.max(...scored.map((x) => x.v));
    let holders = scored.filter((x) => x.v === best).map((x) => x.id);
    if (ties.kind === 'none' && holders.length > 1) continue;
    if (ties.kind === 'share') {
      if (ties.max !== undefined && holders.length > ties.max) continue;
      if (ties.fraction !== undefined && holders.length > ties.fraction * candidates.length)
        continue;
    }
    if (ties.kind === 'one') {
      const order = ties.order ?? ((): number => 0);
      const spread = ties.spread === true;
      holders = [...holders]
        .sort((a, b) => (spread ? Number(won.has(a)) - Number(won.has(b)) : 0) || order(a, b))
        .slice(0, 1);
    }
    holders.forEach((playerId, i) => {
      won.add(playerId);
      const description =
        typeof rule.description === 'function'
          ? rule.description(best, playerId)
          : rule.description;
      const id = options.idFor ? options.idFor(rule, playerId, i) : rule.id;
      out.push({ id, title: rule.title, description, playerId });
    });
  }
  return out;
}
