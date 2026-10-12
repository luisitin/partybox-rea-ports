// Render checks cover identity without color, protected homes and direction at reconnect boundaries.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Direction } from '../server/types';
import { Map, trailMarkerCells, trailOwnerMarkers } from './Map';
import type { MapProps } from './Map';
import { headingTriangle, markerGeometry } from './markerGeometry';
import { homeLabelPositions } from './homeLabels';
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
  it.each([false, true])(
    'keeps an empty home’s owner distinct from a foreign head crossing it (compact=%s)',
    (compact) => {
      const props = board();
      props.runners = props.runners.slice(0, 2);
      const home = props.runners[1]!.home;
      props.runners[1]!.alive = false;
      props.runners[0]!.cell = home;
      const labels = homeLabelPositions(props.runners, 40, 28, []);
      const label = labels.get('player-1')!;
      const [hx, hy] = [(home % 40) + 0.5, Math.floor(home / 40) + 0.5];
      expect(Math.hypot(label[0] - hx, label[1] - hy)).toBeGreaterThanOrEqual(2);
      const html = renderToStaticMarkup(<Map {...props} compact={compact} />);
      expect(html).toContain('data-home-link="2"');
      expect(html).toMatch(/data-marker="home"[^>]*>2<\/text>/);
      expect(html).toMatch(/data-marker="runner"[^>]*>1<\/text>/);
      expect(html).not.toMatch(/data-marker="runner"[^>]*>2<\/text>/);
      // Vacating the rival home restores its centred number without a connector.
      props.runners[0]!.cell = home + 4;
      const clear = renderToStaticMarkup(<Map {...props} compact={compact} />);
      expect(clear).not.toContain('data-home-link="2"');
    },
  );

  it.each([false, true])(
    'shows two adjacent runners without a third home digit and restores an empty home (compact=%s)',
    (compact) => {
      const props = board();
      props.runners = props.runners.slice(0, 2);
      const home = props.runners[1]!.home;
      props.runners[0]!.cell = home - 2;
      props.runners[1]!.cell = home - 1;
      let html = renderToStaticMarkup(<Map {...props} compact={compact} />);
      expect(html.match(/data-marker="runner"/g)).toHaveLength(2);
      expect(html).not.toMatch(/data-marker="home"[^>]*>2<\/text>/);
      // The protected square remains even while its label yields to live heads.
      expect(html.match(/width="3" height="3"/g)).toHaveLength(2);
      props.runners[0]!.alive = false;
      props.runners[1]!.cell = home + 3;
      html = renderToStaticMarkup(<Map {...props} compact={compact} />);
      expect(html).toMatch(/data-marker="home"[^>]*>2<\/text>/);
      expect(html.match(/data-marker="runner"/g)).toHaveLength(1);
    },
  );

  it.each([false, true])(
    'keeps both adjacent live identities above every opaque disc (compact=%s)',
    (compact) => {
      const props = board();
      props.runners = props.runners.slice(0, 2).map((runner, slot) => ({
        ...runner,
        cell: 10 * 40 + 10 + slot,
        dir: 3,
        movingDir: 3,
      }));
      const html = renderToStaticMarkup(<Map {...props} compact={compact} meId="player-0" />);
      expect(html.match(/data-head-layer="background"/g)).toHaveLength(2);
      expect(html.match(/data-head-layer="heading"/g)).toHaveLength(2);
      expect(html.match(/data-head-layer="label"/g)).toHaveLength(2);
      const lastCircle = html.lastIndexOf('<circle');
      const firstHeading = html.indexOf('data-head-layer="heading"');
      const lastHeading = html.lastIndexOf('data-head-layer="heading"');
      const firstLabel = html.indexOf('data-head-layer="label"');
      expect(lastCircle).toBeLessThan(firstHeading);
      expect(lastHeading).toBeLessThan(firstLabel);
      for (let seat = 1; seat <= 2; seat++) {
        const label = html.match(
          new RegExp(
            `<g[^>]*data-head-layer="label"[^>]*data-head-owner="${seat}"[^>]*>(.*?)<\\/g>`,
          ),
        )?.[1];
        expect(label).toContain(`>${seat}</text>`);
        expect(label).toContain('stroke="var(--pb-bg)"');
        expect(label).toContain('paint-order="stroke"');
        expect(label).not.toContain('<circle');
        expect(label).not.toContain('data-heading=');
      }
      expect(html).toContain('data-head-layer="highlight" data-head-owner="1"');
    },
  );

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

describe('identifiable vulnerable trails', () => {
  it('leaves visible gaps after round caps on both ordinary and stronger local trails', () => {
    const css = readFileSync(new URL('./Map.module.css', import.meta.url), 'utf8');
    const ordinary = Number(css.match(/\.trail\s*\{[^}]*stroke-width: ([\d.]+)/)?.[1]);
    const local = Number(css.match(/\.trail\[data-mine\]\s*\{[^}]*stroke-width: ([\d.]+)/)?.[1]);
    const dash = css.match(/\.trail\s*\{[^}]*stroke-dasharray: ([\d.]+) ([\d.]+)/);
    const gap = Number(dash?.[2]);
    // Two round end caps consume one full stroke width across each blank gap.
    expect((gap - ordinary) * (727.5 / 30.5)).toBeGreaterThanOrEqual(8);
    expect((gap - local) * (250 / 30.5)).toBeGreaterThanOrEqual(2);
  });

  it('staggers adjacent parallel trail owners and reserves space around every live head', () => {
    const props = board();
    props.runners = props.runners.slice(0, 2).map((runner, slot) => ({
      ...runner,
      cell: (10 + slot) * 40 + 25,
      trail: Array.from({ length: 24 }, (_, index) => (10 + slot) * 40 + 2 + index),
    }));
    const pins = trailOwnerMarkers(props.runners, 40);
    expect(pins.filter((pin) => pin.slot === 0).map((pin) => pin.cell % 40)).toEqual([2, 10, 18]);
    expect(pins.filter((pin) => pin.slot === 1).map((pin) => pin.cell % 40)).toEqual([5, 13, 21]);
    const distance = (a: number, b: number): number =>
      Math.hypot((a % 40) - (b % 40), Math.floor(a / 40) - Math.floor(b / 40));
    for (const pin of pins) {
      for (const other of pins.filter((candidate) => candidate !== pin)) {
        expect(distance(pin.cell, other.cell)).toBeGreaterThanOrEqual(2.5);
      }
      for (const head of props.runners) {
        expect(distance(pin.cell, head.cell)).toBeGreaterThanOrEqual(2.5);
      }
    }
    // Stable seat order makes ownership clarity independent of runner array ordering.
    expect(trailOwnerMarkers([...props.runners].reverse(), 40)).toEqual(pins);
    const html = renderToStaticMarkup(<Map {...props} compact />);
    expect(html.match(/data-trail-owner="1"/g)).toHaveLength(3);
    expect(html.match(/data-trail-owner="2"/g)).toHaveLength(3);
  });

  it('finds an offset pin instead of covering a rival head on an adjacent cell', () => {
    const props = board();
    props.runners = props.runners.slice(0, 2);
    props.runners[0]!.cell = 10 * 40 + 25;
    props.runners[0]!.trail = Array.from({ length: 24 }, (_, index) => 10 * 40 + 2 + index);
    props.runners[1]!.cell = 11 * 40 + 2;
    const pins = trailOwnerMarkers(props.runners, 40);
    expect(pins.filter((pin) => pin.slot === 0).map((pin) => pin.cell % 40)).toEqual([5, 13, 21]);
    expect(pins.some((pin) => pin.cell === 10 * 40 + 2)).toBe(false);
  });

  it('adds legible ownership numbers for all eight seats independently of player color', () => {
    const props = board();
    props.runners = props.runners.map((runner, slot) => {
      const start = (2 + slot * 3) * props.width + 2;
      return {
        ...runner,
        cell: start + 23,
        trail: Array.from({ length: 24 }, (_, index) => start + index),
      };
    });
    const html = renderToStaticMarkup(<Map {...props} compact meId="player-0" />);
    expect(html.match(/data-marker="trail"/g)).toHaveLength(24);
    for (const runner of props.runners) {
      const markers = [
        ...html.matchAll(
          new RegExp(`<g[^>]*data-trail-owner="${runner.slot + 1}"[^>]*>(.*?)<\\/g>`, 'g'),
        ),
      ];
      expect(markers).toHaveLength(3);
      for (const marker of markers) {
        expect(marker[0]).not.toMatch(/--pb-player-/);
        expect(marker[0]).toContain('data-trail-shape="diamond"');
        expect(marker[0]).toContain('points="0,-0.72 0.72,0 0,0.72 -0.72,0"');
        expect(marker[0]).not.toContain('<circle');
        expect(marker[0]).not.toContain('data-heading=');
        expect(marker[0]).toMatch(
          new RegExp(`data-marker="trail"[^>]*>${runner.slot + 1}<\\/text>`),
        );
      }
      expect(html).toContain(`data-trail="${runner.slot + 1}"`);
    }
    expect(html.match(/data-trail-outline=/g)).toHaveLength(1);
    expect(html.match(/data-heading=/g)).toHaveLength(8);
    expect(html).toContain('data-trail-outline="1"');
    expect(html).toMatch(/data-mine="true" data-trail="1"/);
    // Heads remain above all owner pins, avoiding hidden opponents at trail intersections.
    expect(html.lastIndexOf('data-marker="trail"')).toBeLessThan(
      html.indexOf('data-marker="runner"'),
    );
  });

  it('limits coverage on long folded trails and leaves space around the numbered head', () => {
    const width = 40;
    const trail = Array.from({ length: 1000 }, (_, index) => {
      const row = Math.floor(index / width);
      return row * width + (row % 2 === 0 ? index % width : width - 1 - (index % width));
    });
    const head = trail[trail.length - 1]!;
    const markers = trailMarkerCells(trail, head, width);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.length).toBeLessThanOrEqual(8);
    const center = (cell: number): [number, number] => [cell % width, Math.floor(cell / width)];
    const distance = (a: number, b: number): number => {
      const [ax, ay] = center(a);
      const [bx, by] = center(b);
      return Math.hypot(ax - bx, ay - by);
    };
    for (const marker of markers) {
      expect(trail).toContain(marker);
      expect(distance(marker, head)).toBeGreaterThanOrEqual(2.5);
      for (const other of markers.filter((cell) => cell !== marker)) {
        expect(distance(marker, other)).toBeGreaterThanOrEqual(2.5);
      }
    }
    expect(trailMarkerCells([0, 1, 2], 2, width)).toEqual([]);
    expect(trailMarkerCells([], 0, width)).toEqual([]);
    expect(trailMarkerCells(trail, head, 0)).toEqual([]);
  });

  it('places owner pins on their exact cells and draws a stronger local trail over contrasting ink', () => {
    const props = board();
    props.runners = [
      { ...props.runners[0]!, cell: 63, trail: Array.from({ length: 24 }, (_, i) => 40 + i) },
    ];
    expect(trailMarkerCells(props.runners[0]!.trail, 63, 40)).toEqual([40, 48, 56]);
    const html = renderToStaticMarkup(<Map {...props} meId="player-0" />);
    for (const [cell, x] of [
      [40, 0.5],
      [48, 8.5],
      [56, 16.5],
    ] as const) {
      expect(html).toMatch(
        new RegExp(
          `transform="translate\\(${x} 1.5\\)" data-trail-owner="1" data-trail-cell="${cell}"`,
        ),
      );
    }
    const css = readFileSync(new URL('./Map.module.css', import.meta.url), 'utf8');
    const ordinary = Number(css.match(/\.trail\s*\{[^}]*stroke-width: ([\d.]+)/)?.[1]);
    const local = Number(css.match(/\.trail\[data-mine\]\s*\{[^}]*stroke-width: ([\d.]+)/)?.[1]);
    const outline = Number(css.match(/\.trailUnder\s*\{[^}]*stroke-width: ([\d.]+)/)?.[1]);
    expect(local / ordinary).toBeGreaterThanOrEqual(1.6);
    expect(outline).toBeGreaterThan(local);
    expect(css).toMatch(/\.trail\[data-mine\]\s*\{[^}]*stroke: var\(--pb-text\)/);
    expect(css).toMatch(/\.trailUnder\s*\{[^}]*stroke: var\(--pb-bg\)/);
  });
});
