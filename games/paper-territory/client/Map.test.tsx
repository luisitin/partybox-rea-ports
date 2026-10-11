// Render checks cover identity without color, protected homes and direction at reconnect boundaries.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Direction } from '../server/types';
import { Map } from './Map';
import type { MapProps } from './Map';
import { headingTriangle, markerGeometry } from './markerGeometry';
import { SeatBadge } from './SeatBadge';
import { OWNERSHIP_TEXTURES } from './textures';

function board(): MapProps {
  return {
    width: 40,
    height: 28,
    label: 'Map with eight seats',
    owners: Array.from({ length: 1120 }, (_, cell) => Math.floor((cell % 40) / 5)),
    runners: Array.from({ length: 8 }, (_, slot) => ({
      id: `player-${slot}`,
      slot,
      home: 82 + slot * 5,
      cell: 162 + slot * 5,
      trail: [],
      alive: true,
      dir: (slot % 4) as Direction,
    })),
  };
}

describe('color-independent map identity', () => {
  it('uses eight different monochrome geometries, all keyed to the ownership region', () => {
    const props = board();
    const html = renderToStaticMarkup(<Map {...props} />);
    const patterns = [
      ...html.matchAll(/<pattern[^>]*data-texture="([^"]+)"[^>]*>(.*?)<\/pattern>/g),
    ];
    expect(patterns).toHaveLength(8);
    expect(new Set(patterns.map((match) => match[1])).size).toBe(8);
    // Ignore generated CSS classes: geometry alone must identify the eight seats.
    expect(new Set(patterns.map((match) => match[2]?.replace(/ class="[^"]*"/g, ''))).size).toBe(8);
    for (let slot = 0; slot < 8; slot++) {
      const region = html.match(new RegExp(`<path[^>]*data-owner="${slot + 1}"[^>]*>`))?.[0];
      expect(region).toContain(`data-texture="${OWNERSHIP_TEXTURES[slot]?.name}"`);
      expect(region).toContain(`-owner-${slot})`);
      const badge = renderToStaticMarkup(<SeatBadge slot={slot} className="seat" />);
      expect(badge).toContain(`data-texture="${OWNERSHIP_TEXTURES[slot]?.name}"`);
    }
    const textureCss = readFileSync(
      new URL('./OwnershipPattern.module.css', import.meta.url),
      'utf8',
    );
    expect(textureCss).toContain('stroke: var(--pb-text)');
    expect(textureCss).toContain('fill: var(--pb-text)');
    expect(textureCss).not.toMatch(/--pb-player-/);
  });

  it('keeps a crashed seat’s protected home and removes only its moving head', () => {
    const props = board();
    props.runners[3]!.alive = false;
    const html = renderToStaticMarkup(<Map {...props} />);
    expect(html.match(/data-marker="home"/g)).toHaveLength(8);
    expect(html.match(/data-marker="runner"/g)).toHaveLength(7);
    expect(html).toMatch(/data-marker="home"[^>]*>4<\/text>/);
    expect(html).not.toMatch(/data-marker="runner"[^>]*>4<\/text>/);
    expect(html).toContain('data-owner="4"');
  });
});

describe('readable player heads', () => {
  it('uses compact geometry for phones and leaves room around edge cells for every heading', () => {
    const props = board();
    props.runners[0]!.cell = 0;
    props.runners[0]!.dir = 0;
    const html = renderToStaticMarkup(<Map {...props} compact meId="player-0" />);
    expect(html).toContain('data-compact="true"');
    expect(html).toContain('viewBox="-1.25 -1.25 42.5 30.5"');
    expect(html).toContain('r="0.95"');
    expect(html).toContain('r="1.2"');
    const [tipX, tipY] = headingTriangle(0, markerGeometry(true).radius)
      .split(' ')[1]!
      .split(',')
      .map(Number);
    expect(tipX).toBe(0);
    expect(0.5 + tipY!).toBeGreaterThan(-1.25);
    // Your disc is painted last, remaining visible when other enlarged heads overlap it.
    expect([...html.matchAll(/data-marker="runner"[^>]*>(\d)<\/text>/g)].at(-1)?.[1]).toBe('1');
  });

  it('derives readable physical glyph sizes from the phone and TV typography tokens', () => {
    const css = readFileSync(new URL('./Map.module.css', import.meta.url), 'utf8');
    const ordinary = Number(
      css.match(/\.number\s*\{\s*font-size: calc\(var\(--pb-font-body\) \* ([\d.]+)\)/)?.[1],
    );
    const compact = Number(
      css.match(
        /\.map\[data-compact\] \.homeNumber\s*\{\s*font-size: calc\(var\(--pb-font-body\) \* ([\d.]+)\)/,
      )?.[1],
    );
    // Captured minimum board scales with 160px reserved for the phone shell.
    const phoneGlyph = 18 * compact * (250 / 30.5);
    const tvGlyph = 36 * ordinary * (727.5 / 30.5);
    expect(phoneGlyph).toBeGreaterThanOrEqual(14);
    expect(phoneGlyph).toBeLessThanOrEqual(16);
    expect(tvGlyph).toBeGreaterThanOrEqual(32);
  });

  it('prefers the actual movement heading when available and falls back on older views', () => {
    const props = board();
    props.runners = [{ ...props.runners[0]!, dir: 1, movingDir: 2 }];
    const current = renderToStaticMarkup(<Map {...props} />);
    expect(current).toContain('data-heading="2"');
    expect(current).not.toContain('data-heading="1"');
    delete props.runners[0]!.movingDir;
    expect(renderToStaticMarkup(<Map {...props} />)).toContain('data-heading="1"');
  });

  it.each([
    [0, 0, -1],
    [1, 1, 0],
    [2, 0, 1],
    [3, -1, 0],
  ] as const)('points direction %i along the absolute board axis', (dir, dx, dy) => {
    const vertices = headingTriangle(dir, 0.95)
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    const tip = vertices[1]!;
    expect(Math.sign(tip[0]!)).toBe(dx);
    expect(Math.sign(tip[1]!)).toBe(dy);
    expect(Math.hypot(...(tip as [number, number]))).toBeCloseTo(1.67);
  });
});
