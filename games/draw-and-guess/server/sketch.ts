// Original category silhouettes for fallback bot artists: no text or hidden codes in the art.
import type { Word } from '../content/schema';
import type { Stroke } from './types';

const SILHOUETTES: Record<string, [number, number][][]> = {
  animal: [
    [
      [300, 400],
      [270, 200],
      [350, 250],
      [450, 200],
      [550, 250],
      [630, 200],
      [600, 400],
      [500, 450],
      [400, 450],
      [300, 400],
    ],
    [
      [370, 330],
      [380, 330],
    ],
    [
      [520, 330],
      [530, 330],
    ],
    [
      [430, 380],
      [480, 380],
    ],
  ],
  food: [
    [
      [300, 250],
      [700, 250],
      [650, 430],
      [350, 430],
      [300, 250],
    ],
    [
      [380, 180],
      [400, 120],
      [420, 180],
    ],
    [
      [500, 180],
      [520, 120],
      [540, 180],
    ],
  ],
  object: [
    [
      [300, 200],
      [650, 200],
      [650, 450],
      [300, 450],
      [300, 200],
    ],
    [
      [350, 200],
      [350, 150],
      [600, 150],
      [600, 200],
    ],
  ],
  nature: [
    [
      [500, 100],
      [300, 300],
      [400, 300],
      [300, 400],
      [450, 400],
      [450, 500],
      [550, 500],
      [550, 400],
      [700, 400],
      [600, 300],
      [700, 300],
      [500, 100],
    ],
  ],
  place: [
    [
      [250, 280],
      [500, 100],
      [750, 280],
    ],
    [
      [300, 250],
      [300, 480],
      [700, 480],
      [700, 250],
    ],
    [
      [450, 480],
      [450, 350],
      [550, 350],
      [550, 480],
    ],
  ],
  activity: [
    [
      [450, 150],
      [500, 100],
      [550, 150],
      [500, 200],
      [450, 150],
    ],
    [
      [500, 200],
      [500, 350],
      [400, 500],
    ],
    [
      [500, 350],
      [600, 480],
    ],
    [
      [350, 250],
      [500, 250],
      [650, 300],
    ],
  ],
};
export function sketchFor(word: Word): [number, number][][] {
  return SILHOUETTES[word.category] ?? SILHOUETTES.object!;
}
export function drawnCategory(strokes: Stroke[]): string | null {
  const first = strokes[0]?.points;
  if (!first) return null;
  return (
    Object.entries(SILHOUETTES).find(
      ([, lines]) => JSON.stringify(lines[0]) === JSON.stringify(first),
    )?.[0] ?? null
  );
}
