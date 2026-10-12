import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Ball } from '../server/types';
import { Arena } from './Arena';

const ball = (id: string, slot: number, x: number): Ball =>
  ({
    id,
    slot,
    x,
    y: 200,
    vx: 0,
    vy: 0,
    alive: true,
    heavy: true,
    cause: null,
  }) as Ball;

describe('original arena art', () => {
  it('keeps each numbered identity at the same received position as its body and heavy outline', () => {
    const html = renderToStaticMarkup(
      <Arena
        balls={[ball('a', 0, 400), ball('b', 1, 456)]}
        platforms={[]}
        width={960}
        height={540}
        hazard={false}
        animate={true}
      />,
    );
    const groups = [...html.matchAll(/<g\b[^>]*data-pose-seat="([^"]+)"[^>]*>/g)].map((match) => ({
      seat: match[1],
      tag: match[0],
    }));
    for (const [seat, x] of [
      ['1', 400],
      ['2', 456],
    ] as const) {
      const layers = groups.filter((group) => group.seat === seat);
      expect(layers).toHaveLength(2);
      expect(layers.map((layer) => layer.tag.match(/data-pose-layer="([^"]+)"/)?.[1])).toEqual([
        'body',
        'number',
      ]);
      for (const layer of layers) expect(layer.tag).toContain(`transform:translate(${x}px, 200px)`);
    }
    expect(html.indexOf('<text')).toBeGreaterThan(html.lastIndexOf('<circle'));
  });

  it('draws all numbered identities above every heavy ring and preserves a non-colour heavy cue', () => {
    const html = renderToStaticMarkup(
      <Arena
        balls={[ball('a', 0, 400), ball('b', 1, 456)]}
        platforms={[{ id: 'main', x: 100, y: 300, width: 760, height: 20 }]}
        width={960}
        height={540}
        hazard={true}
        me="a"
      />,
    );
    expect(html).toContain('data-seat-number="1"');
    expect(html).toContain('data-seat-number="2"');
    expect(html).toContain('Heavy');
    expect(html).toContain('data-hazard="true"');
    expect(html.indexOf('<text')).toBeGreaterThan(html.lastIndexOf('<circle'));
    expect(html).toContain('width="760"');
    expect(html).not.toContain('<image');
  });

  it('keeps retired seats truthful and does not draw their balls as heavy', () => {
    const retired = { ...ball('a', 0, 400), alive: false, cause: 'left' } as Ball;
    const html = renderToStaticMarkup(
      <Arena balls={[retired]} platforms={[]} width={960} height={540} hazard={false} />,
    );
    expect(html).toContain('Ball 1: Left');
    expect(html).toContain('data-out="true"');
    expect(html).not.toContain('data-heavy="true"');
    expect(html).toContain('0 balls still in');
  });
});
