// What every recap (ADR-035) needs besides its game: the date in its title, the players' names, and
// the frame every recap shares (audit #16): the title, "ended early", then the game's own sections,
// the final scores and the awards. Pure; game servers have no `Date`.
import type { GameAward, GameRecap, GameStateBase, PlayerInfo, RecapFile } from '@partybox/shared';

/**
 * A recap's name for `id`: the room's name for them at the end (`RecapContext.players`, which knows
 * a rename), else the game's, else the id itself.
 */
export function recapName(
  players: readonly PlayerInfo[],
  state: GameStateBase,
  id: string,
): string {
  return players.find((p) => p.id === id)?.name ?? state.players[id]?.name ?? id;
}

/**
 * YYYY-MM-DD (UTC) of an epoch-ms instant, for a recap's title: Howard Hinnant's civil_from_days in
 * integer arithmetic.
 */
export function isoDay(ms: number): string {
  const z = Math.floor(ms / 86_400_000) + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface RecapPlan {
  /** The game's name: the title reads "# <title> · <date>". */
  title: string;
  /** When the game began (epoch ms), for the title's date. */
  at: number;
  /** True when the VIP ended the game (`RecapContext.results` is null). */
  endedEarly: boolean;
  /** The game's own sections, as markdown lines (rounds, questions, the board…). */
  body: readonly string[];
  /** The final scores, rank first; omitted for a game that does not rank. */
  ranking?: readonly { playerId: string; rank: number; score: number }[];
  awards?: readonly GameAward[];
  /** A player's name (usually `recapName(ctx.players, state, id)`). */
  name: (playerId: string) => string;
  files?: RecapFile[];
  /** The frame's own words in another language (a Spanish game's recap, ADR-054). */
  labels?: { endedEarly?: string; scores?: string; awards?: string };
}

/**
 * A recap in the shared frame: "# Title · date", "_The game was ended early._", the body, "## Final
 * scores" ("1. Ana — 5") and "## Awards" ("- Title: Ana (description)"); empty parts are left out.
 */
export function recapMarkdown(plan: RecapPlan): GameRecap {
  const lines = [`# ${plan.title} · ${isoDay(plan.at)}`, ''];
  const label = { endedEarly: '_The game was ended early._', scores: '## Final scores', awards: '## Awards', ...plan.labels }; // prettier-ignore
  if (plan.endedEarly) lines.push(label.endedEarly, '');
  if (plan.body.length > 0) lines.push(...plan.body, '');
  if (plan.ranking && plan.ranking.length > 0) {
    lines.push(label.scores, '');
    for (const r of plan.ranking) lines.push(`${r.rank}. ${plan.name(r.playerId)} — ${r.score}`);
    lines.push('');
  }
  if (plan.awards && plan.awards.length > 0) {
    lines.push(label.awards, '');
    for (const a of plan.awards)
      lines.push(`- ${a.title}: ${plan.name(a.playerId)} (${a.description})`);
    lines.push('');
  }
  // One blank line between parts, however the body's own sections end.
  const tidy = lines.filter((line, i) => line !== '' || lines[i - 1] !== '');
  const markdown = `${tidy.join('\n').trimEnd()}\n`;
  return plan.files && plan.files.length > 0 ? { markdown, files: plan.files } : { markdown };
}
