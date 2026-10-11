// The phone-only stage's roster (no React: __tests__/phone-only.test.tsx pins it): who is in the match, in worm-colour order, with the
// round's points and the totals. The same rows the TV lists beside the arena.

export interface StandingRow {
  id: string;
  /** The worm's colour slot. */
  slot: number;
  name: string;
  total: number;
  gained: number;
  /** Crashed this round. */
  out: boolean;
  me: boolean;
}

interface RowSource {
  players: { id: string; name: string }[];
  /** The arena, when this phone was sent it: its order is the colour slots. */
  worms?: { id: string; died: number | null }[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

/** One row per worm (per player when the phone has no arena), best first when `ranked`. */
export function standingsRows(view: RowSource, meId: string, ranked: boolean): StandingRow[] {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const order = view.worms ?? view.players.map((p) => ({ id: p.id, died: null }));
  const rows = order.map((w, slot): StandingRow => ({
    id: w.id,
    slot,
    name: names.get(w.id) ?? '',
    total: view.scores[w.id] ?? 0,
    gained: view.lastPoints[w.id] ?? 0,
    out: w.died !== null,
    me: w.id === meId,
  }));
  return ranked ? [...rows].sort((a, b) => b.total - a.total) : rows;
}
