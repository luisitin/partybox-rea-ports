import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { botInput, recognizeDrawing } from '../server/bot';
import { BOT_ART } from '../server/pictures';
import type { Point, Stroke } from '../server/types';
import { deepFreeze, drawing, guesser } from './helpers';

const words = Object.keys(BOT_ART);
const pictures = Object.entries(BOT_ART);
function transformed(
  picture: readonly Stroke[],
  scale: number,
  dx: number,
  dy: number,
  seed = 0,
): Stroke[] {
  const rng = createRng(seed);
  return picture.map((stroke) => ({
    ...stroke,
    color: 4,
    width: 18,
    points: stroke.points.map(([x, y]): Point => [
      Math.round(x * scale + dx + (seed ? rng.float() * 8 - 4 : 0)),
      Math.round(y * scale + dy + (seed ? rng.float() * 8 - 4 : 0)),
    ]),
  }));
}

function oldRecognized(strokes: readonly Stroke[]): string | null {
  for (const [word, picture] of pictures) {
    if (
      picture.length === strokes.length &&
      picture.every(
        (stroke, i) => JSON.stringify(stroke.points) === JSON.stringify(strokes[i]?.points),
      )
    )
      return word;
  }
  return null;
}

describe('public drawing recognition', () => {
  it('retains exact pictograms and recognizes translated, resized and jittered ink', () => {
    const variants = [
      ['translated', (picture: readonly Stroke[]) => transformed(picture, 1, 48, 12)],
      ['scaled', (picture: readonly Stroke[]) => transformed(picture, 0.6, 180, 80)],
      ['jittered', (picture: readonly Stroke[]) => transformed(picture, 1, 0, 0, 123)],
      ['combined', (picture: readonly Stroke[]) => transformed(picture, 0.6, 180, 80, 456)],
    ] as const;
    for (const [word, picture] of pictures) {
      expect(recognizeDrawing(picture, words), word).toBe(word);
    }
    const metrics = variants.map(([name, transform]) => {
      let before = 0;
      let after = 0;
      for (const [word, picture] of pictures) {
        const ink = transform(picture);
        if (oldRecognized(ink) === word) before++;
        if (recognizeDrawing(ink, words) === word) after++;
        expect(recognizeDrawing(ink, words), `${name}: ${word}`).toBe(word);
      }
      return { variant: name, before, after, total: pictures.length };
    });
    console.info('Public recognition before/after:', JSON.stringify(metrics));
  });

  it('recognizes reordered and reversed paths, and the same picture sent in chunks', () => {
    for (const [word, picture] of pictures) {
      const reordered = transformed(picture, 0.6, 180, 80)
        .reverse()
        .map((stroke) => ({
          ...stroke,
          points: stroke.points.slice().reverse(),
        }));
      expect(recognizeDrawing(reordered, words), `reordered: ${word}`).toBe(word);
      const chunks = reordered.flatMap((stroke, gesture) => {
        const result: Stroke[] = [];
        for (let start = 0; start < stroke.points.length - 1; start += 2)
          result.push({ ...stroke, gesture, points: stroke.points.slice(start, start + 3) });
        return result.length ? result : [{ ...stroke, gesture }];
      });
      expect(recognizeDrawing(chunks, words), `chunked: ${word}`).toBe(word);
    }
  });

  it('rejects empty, dot, isolated-line and unrelated scribble drawings', () => {
    expect(recognizeDrawing([], words)).toBeNull();
    const points: Point[][] = [
      [[300, 200]],
      [
        [100, 100],
        [900, 500],
      ],
      [
        [100, 100],
        [900, 100],
        [900, 500],
        [100, 500],
        [100, 100],
      ],
    ];
    for (const path of points)
      expect(recognizeDrawing([{ points: path, color: 0, width: 9 }], words)).toBeNull();
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed);
      const scribble: Stroke[] = Array.from({ length: 6 }, () => ({
        color: 0,
        width: 9,
        points: Array.from({ length: 8 }, (): Point => [rng.int(100, 900), rng.int(50, 550)]),
      }));
      expect(recognizeDrawing(scribble, words), `scribble ${seed}`).toBeNull();
    }
  });

  it('obeys visible candidate words and never mutates public strokes', () => {
    const ink = deepFreeze(transformed(BOT_ART.house!, 0.7, 80, 40, 5));
    const before = JSON.stringify(ink);
    expect(recognizeDrawing(ink, ['house'])).toBe('house');
    expect(recognizeDrawing(ink, [])).toBeNull();
    expect(recognizeDrawing(ink, ['cat', 'sun'])).toBeNull();
    expect(JSON.stringify(ink)).toBe(before);
  });

  it('sharp bots use transformed public pictures while hidden words and choices cannot change any strength', () => {
    const base = drawing();
    const id = guesser(base);
    const state = deepFreeze({
      ...base,
      word: 'house',
      clock: base.began + 8000,
      strokes: transformed(BOT_ART.house!, 0.6, 180, 80, 42),
      hintCount: 0,
      guesses: {},
      lastGuessAt: {},
    });
    expect(botInput(state, id, createRng(77), 'sharp')).toEqual({ type: 'guess', text: 'house' });
    const hiddenChanged = { ...state, word: 'xxxxx', choices: ['private', 'secret', 'unused'] };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (let seed = 1; seed <= 20; seed++)
        expect(botInput(hiddenChanged, id, createRng(seed), skill)).toEqual(
          botInput(state, id, createRng(seed), skill),
        );
    }
  });
});
