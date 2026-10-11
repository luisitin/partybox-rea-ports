// Players by name (audit #5): one lookup for the server and the screens, and "Ana, Ben and Cy" in
// the English the server writes (recaps, the reader's lines; a screen's own language is the UI's
// joinNamesIn). Pure and dependency-free: both entries export playerName.

/** A roster: a state's `players` (by id) or a view's `players` (a list). */
export type Roster =
  Readonly<Record<string, { name: string }>> | readonly { id: string; name: string }[];

/** The name of player `id` in `players`, or `fallback` for an id it lacks ("constructor" included). */
export function playerName(players: Roster, id: string | null | undefined, fallback = '?'): string {
  if (id === null || id === undefined) return fallback;
  if (Array.isArray(players)) return players.find((p) => p.id === id)?.name ?? fallback;
  const byId = players as Readonly<Record<string, { name: string }>>;
  return Object.hasOwn(byId, id) ? (byId[id]?.name ?? fallback) : fallback;
}

/** "Ana", "Ana and Ben", "Ana, Ben and Cy" (no serial comma); '' for none. */
export function joinNames(names: readonly string[], and = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1) as string}`;
}
