// Who plays with whom and who goes next (Part 00 §6's helpers): two even teams, a vote's winner,
// and a turn that passes around the table. Pure, deterministic from the rng state, and they never
// throw — an empty room gets empty teams, no votes gets `null`, nobody seated gets `null`.
import type { PlayerInfo, RngState } from '@partybox/shared';
import { nextInt, shuffle } from '@partybox/shared';
import { compareCodeUnits } from './compare';

/** The pack's two teams: ▲ Sun and ● Moon (TeamBanner). Ids in the order the players came in. */
export interface Teams {
  sun: string[];
  moon: string[];
}

/**
 * Two teams whose sizes differ by at most one, with the bots spread across them too (their counts
 * differ by at most one), drawn from the rng: people are dealt first, then bots, alternating from a
 * random team. Each team lists its players in the order given (seat order). A repeated id counts once.
 */
export function teamsFromSeed(
  players: readonly Pick<PlayerInfo, 'id' | 'bot'>[],
  rng: RngState,
): [Teams, RngState] {
  const isBot = new Map<string, boolean>();
  for (const p of players) if (!isBot.has(p.id)) isBot.set(p.id, p.bot === true);
  const order = [...isBot.keys()];
  const [people, afterPeople] = shuffle(
    rng,
    order.filter((id) => !isBot.get(id)),
  );
  const [bots, afterBots] = shuffle(
    afterPeople,
    order.filter((id) => isBot.get(id)),
  );
  const [first, next] = nextInt(afterBots, 0, 1);
  const sun = new Set([...people, ...bots].filter((_, i) => i % 2 === first));
  return [
    { sun: order.filter((id) => sun.has(id)), moon: order.filter((id) => !sun.has(id)) },
    next,
  ];
}

/**
 * The choice with the most votes (`votes` maps a voter to their choice; `null` / absent = no vote).
 * A tie is broken by the rng among the tied choices; a clear winner draws nothing. No votes → `null`.
 */
export function majorityPick<T extends string>(
  votes: Readonly<Record<string, T | null | undefined>>,
  rng: RngState,
): [T | null, RngState] {
  const counts = new Map<T, number>();
  for (const choice of Object.values(votes))
    if (typeof choice === 'string') counts.set(choice, (counts.get(choice) ?? 0) + 1);
  if (counts.size === 0) return [null, rng];
  const top = Math.max(...counts.values());
  const tied = [...counts]
    .filter(([, n]) => n === top)
    .map(([choice]) => choice)
    .sort(compareCodeUnits);
  if (tied.length === 1) return [tied[0] as T, rng];
  const [i, next] = nextInt(rng, 0, tied.length - 1);
  return [tied[i] as T, next];
}

/**
 * The choice with strictly the most votes, or `null` for a tie or no votes: the rule when a tie
 * means nothing happens (Tune In's call, Spy Grid's pointing at the deadline). `majorityPick` is
 * the one that breaks a tie by the rng.
 */
export function plurality<T extends string | number>(
  votes: Readonly<Record<string, T | null | undefined>>,
): T | null {
  const counts = new Map<T, number>();
  for (const choice of Object.values(votes))
    if (choice !== null && choice !== undefined) counts.set(choice, (counts.get(choice) ?? 0) + 1);
  let best: T | null = null;
  let top = 0;
  let tied = false;
  for (const [choice, n] of counts) {
    if (n > top) [best, top, tied] = [choice, n, false];
    else if (n === top) tied = true;
  }
  return tied ? null : best;
}

/**
 * Whose turn it is in `round` (0-based) as turns pass around `order`: `order[round mod n]`, or the
 * next one after it that `isIn` accepts (a player who left is skipped). `null` when nobody is.
 */
export function rotation<T>(
  order: readonly T[],
  round: number,
  isIn: (item: T) => boolean = () => true,
): T | null {
  const n = order.length;
  if (n === 0) return null;
  const start = Number.isFinite(round) ? ((Math.floor(round) % n) + n) % n : 0;
  for (let k = 0; k < n; k++) {
    const item = order[(start + k) % n] as T;
    if (isIn(item)) return item;
  }
  return null;
}
