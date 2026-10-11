// One stable roster for the TV and the compact phone reveal; equal totals share a rank.
interface StandingSource {
  players: { id: string; name: string }[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  drawerId: string;
  solvedIds: string[];
}

export interface StandingRow {
  id: string;
  name: string;
  score: number;
  gain: number;
  rank: number;
  drawer: boolean;
  solved: boolean;
}

export function standings(view: StandingSource, ranked: boolean): StandingRow[] {
  const ordered = [...view.players].sort(
    (a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0),
  );
  const ranks = new Map(
    ordered.map((player) => [
      player.id,
      1 +
        ordered.filter((other) => (view.scores[other.id] ?? 0) > (view.scores[player.id] ?? 0))
          .length,
    ]),
  );
  return (ranked ? ordered : view.players).map((player) => ({
    id: player.id,
    name: player.name,
    score: view.scores[player.id] ?? 0,
    gain: view.lastPoints[player.id] ?? 0,
    rank: ranks.get(player.id) ?? 1,
    drawer: player.id === view.drawerId,
    solved: view.solvedIds.includes(player.id),
  }));
}
