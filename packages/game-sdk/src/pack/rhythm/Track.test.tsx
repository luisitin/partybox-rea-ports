// T-0923: a note past the marker fades out on its way to the track's left edge, so none is cropped there. The kit has no
// react-dom, so these call Track and read the note elements it returns.
import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Chart } from '../../rhythm/chart';
import { Track } from './Track';
import styles from './Track.module.css';
import type { RhythmSkin } from './types';

type Props = Record<string, unknown> & { children?: ReactNode; style?: Record<string, unknown> };

const skin = {
  title: 'Test',
  hue: 20,
  hit: null,
  kinds: [null],
  scene: { props: [], pile: null },
} as unknown as RhythmSkin;
const NOTE = { t: 1000, lane: 0, kind: 0 };
const chart = { notes: [NOTE], beats: [] } as unknown as Chart;

/** Every note element in a returned tree, depth first. */
function notes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(notes);
  if (!isValidElement<Props>(node)) return [];
  const own = node.props.className === styles.note ? [node] : [];
  return [...own, ...notes(node.props.children)];
}

/** The fade the track gives the one note, `past` ms after it was due (negative: before). */
function fadeAfter(past: number): number {
  const [note] = notes(Track({ chart, t: NOTE.t + past, skin }));
  return Number(note?.props.style?.['--fade']);
}

describe('a note on the beat track', () => {
  it('is whole until it reaches the marker', () => {
    expect(fadeAfter(-500)).toBe(1);
    expect(fadeAfter(0)).toBe(1);
  });

  it('fades out as it slides past the marker', () => {
    expect(fadeAfter(150)).toBeGreaterThan(0);
    expect(fadeAfter(150)).toBeLessThan(1);
    expect(fadeAfter(150)).toBeLessThan(fadeAfter(50));
  });

  it('is gone before the left edge, so it is never cropped there', () => {
    expect(fadeAfter(300)).toBe(0);
    expect(fadeAfter(360)).toBe(0);
  });
});
