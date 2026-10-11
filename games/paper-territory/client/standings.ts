// Stable seat numbers follow the map; equal areas share a rank without ordering by a player's name.
interface Source {
  players: { id: string; name: string }[];
  scores: Record<string, number>;
  runners: {
    id: string;
    slot: number;
    alive: boolean;
    trail: number[];
    deaths: number;
    area: number;
  }[];
}

export interface StandingRow {
  id: string;
  name: string;
  slot: number;
  area: number;
  rank: number;
  alive: boolean;
  exposed: boolean;
  deaths: number;
}

export function standings(view: Source, ranked: boolean): StandingRow[] {
  const names = new Map(view.players.map((player) => [player.id, player.name]));
  const rows = view.runners.map((runner) => ({
    id: runner.id,
    name: names.get(runner.id) ?? '',
    slot: runner.slot,
    area: view.scores[runner.id] ?? runner.area,
    rank: 1,
    alive: runner.alive,
    exposed: runner.trail.length > 0,
    deaths: runner.deaths,
  }));
  for (const row of rows) row.rank = 1 + rows.filter((other) => other.area > row.area).length;
  return rows.sort((a, b) => (ranked ? b.area - a.area || a.slot - b.slot : a.slot - b.slot));
}
