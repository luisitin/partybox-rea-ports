// Artists draw original pictograms. Guessers read only public ink, mask and their own history.
import { hasPlayer } from '@partybox/game-sdk';
import type { Rng, BotSkill } from '@partybox/game-sdk';
import { WORDS } from './content';
import { maskedWord } from './phases/draw';
import { BOT_ART } from './pictures';
import type { Input, State, Stroke } from './types';

const GRID = 32;
interface Ink {
  cells: readonly number[];
  distance: readonly number[];
}

/** Public geometry, independent of location, size, brush style and packet boundaries. */
function inkOf(strokes: readonly Stroke[]): Ink | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const [x, y] of stroke.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const span = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(span) || span < 12) return null;
  const ink = Array<boolean>(GRID * GRID).fill(false);
  const mark = (x: number, y: number): void => {
    const col = Math.max(0, Math.min(GRID - 1, Math.round(x)));
    const row = Math.max(0, Math.min(GRID - 1, Math.round(y)));
    ink[row * GRID + col] = true;
  };
  for (const stroke of strokes) {
    let previous: [number, number] | undefined;
    for (const [x, y] of stroke.points) {
      const point: [number, number] = [
        ((x - minX) / span) * (GRID - 1),
        ((y - minY) / span) * (GRID - 1),
      ];
      mark(...point);
      if (previous) {
        const steps = Math.ceil(
          Math.max(Math.abs(point[0] - previous[0]), Math.abs(point[1] - previous[1])) * 2,
        );
        for (let step = 1; step < steps; step++) {
          const fraction = step / steps;
          mark(
            previous[0] + (point[0] - previous[0]) * fraction,
            previous[1] + (point[1] - previous[1]) * fraction,
          );
        }
      }
      previous = point;
    }
  }
  const cells = ink.flatMap((painted, i) => (painted ? [i] : []));
  const distance = ink.map((painted) => (painted ? 0 : GRID * 2));
  // Two passes give Manhattan distance to the nearest painted cell in bounded work.
  for (let i = 0; i < distance.length; i++) {
    if (i % GRID > 0) distance[i] = Math.min(distance[i]!, distance[i - 1]! + 1);
    if (i >= GRID) distance[i] = Math.min(distance[i]!, distance[i - GRID]! + 1);
  }
  for (let i = distance.length - 1; i >= 0; i--) {
    if (i % GRID < GRID - 1) distance[i] = Math.min(distance[i]!, distance[i + 1]! + 1);
    if (i < distance.length - GRID) distance[i] = Math.min(distance[i]!, distance[i + GRID]! + 1);
  }
  return { cells, distance };
}

const PICTURES = Object.entries(BOT_ART).map(([word, strokes]) => ({
  word,
  strokes,
  ink: inkOf(strokes)!,
}));

function samePublicPaths(ink: readonly Stroke[], template: readonly Stroke[]): boolean {
  return ink.every((stroke, index) => {
    const path = template[index]?.points;
    return (
      path?.length === stroke.points.length &&
      stroke.points.every(([x, y], point) => path[point]?.[0] === x && path[point]?.[1] === y)
    );
  });
}

function shapeDistance(a: Ink, b: Ink): number {
  const directed = (from: Ink, to: Ink): number =>
    from.cells.reduce((sum, cell) => sum + to.distance[cell]!, 0) / from.cells.length;
  return (directed(a, b) + directed(b, a)) / (2 * GRID);
}

/** Match only visible ink and public candidate words; an ambiguous drawing stays a guess. */
export function recognizeDrawing(
  strokes: readonly Stroke[],
  candidates: readonly string[],
): string | null {
  const eligible = PICTURES.filter((picture) => candidates.includes(picture.word));
  if (!eligible.length || !strokes.length) return null;
  // Completed bot art is common in simulations. Compare public points without building a grid.
  for (const picture of eligible) {
    if (strokes.length === picture.strokes.length && samePublicPaths(strokes, picture.strokes))
      return picture.word;
  }
  // Exact unfinished public templates need their next strokes, not an expensive speculative match.
  if (
    eligible.some(
      (picture) =>
        strokes.length < picture.strokes.length && samePublicPaths(strokes, picture.strokes),
    )
  )
    return null;
  const ink = inkOf(strokes);
  if (!ink) return null;
  let best: { word: string; distance: number } | null = null;
  let second = Infinity;
  for (const picture of eligible) {
    const distance = shapeDistance(ink, picture.ink);
    if (!best || distance < best.distance) {
      second = best?.distance ?? Infinity;
      best = { word: picture.word, distance };
    } else second = Math.min(second, distance);
  }
  return best && best.distance <= 0.035 && second - best.distance >= 0.008 ? best.word : null;
}
export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    !hasPlayer(state, id) ||
    !state.players[id]?.connected ||
    state.left.includes(id) ||
    state.phase.paused
  )
    return null;
  if (state.phase.id === 'choose' && id === state.drawer) {
    const options = state.choices.map((word, index) => ({
      word,
      index,
      lines: BOT_ART[word]?.length ?? 999,
    }));
    options.sort((a, b) => a.lines - b.lines || a.word.length - b.word.length);
    return { type: 'choose', index: skill === 'easy' ? rng.int(0, 2) : (options[0]?.index ?? 0) };
  }
  if (state.phase.id !== 'draw') return null;
  if (id === state.drawer) {
    const stroke = BOT_ART[state.word]?.[state.strokes.length];
    return stroke ? { type: 'stroke', stroke: structuredClone(stroke) } : null;
  }
  if (Object.hasOwn(state.solved, id)) return null;
  const delay = skill === 'easy' ? 8000 : skill === 'sharp' ? 2000 : 4000;
  if (
    state.clock - state.began < delay ||
    state.clock - (state.lastGuessAt[id] ?? state.began) < delay
  )
    return null;
  const tried = state.guesses[id] ?? [];
  const seen = maskedWord(state)
    .split(' / ')
    .map((part) => part.split(' ').join(''))
    .join(' ');
  const match = new RegExp(`^${seen.replace(/_/g, '[a-z]')}$`);
  const candidates = WORDS.filter((word) => match.test(word) && !tried.includes(word));
  const picture = skill === 'easy' ? null : recognizeDrawing(state.strokes, candidates);
  const text =
    picture && candidates.includes(picture) && (skill === 'sharp' || rng.float() < 0.65)
      ? picture
      : candidates.length
        ? rng.pick(candidates)
        : null;
  return text ? { type: 'guess', text } : null;
}
