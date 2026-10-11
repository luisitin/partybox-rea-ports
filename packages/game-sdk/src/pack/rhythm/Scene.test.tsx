// T-0642: a game's scene behind the beat track: placed by its centre, answers each hit once, gone on the done screen.
// The kit has no react-dom, so these read the element trees the components return instead of rendering them.
import { Children, isValidElement } from 'react';
import type { JSX, ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Kitchen } from './Kitchen';
import type { KitchenProps } from './Kitchen';
import { SceneArt, SceneItem } from './Scene';
import type { RhythmSceneProps, SceneItemProps } from './Scene';
import type { RhythmSkin } from './types';

type Props = Record<string, unknown> & { children?: ReactNode };

const skin = { hue: 20, scene: { props: [], pile: null } } as unknown as RhythmSkin;

function Probe(_: RhythmSceneProps): JSX.Element {
  return <i />;
}

/** Every element in a returned tree, depth first. */
function elements(node: ReactNode): ReactElement<Props>[] {
  const out: ReactElement<Props>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Props>(child)) return;
    out.push(child, ...elements(child.props.children));
  });
  return out;
}

function item(props: Partial<SceneItemProps>): ReactElement<Props> {
  const outer = SceneItem({ x: 30, y: 60, size: 5, tilt: -10, z: 2, children: null, ...props });
  return outer as ReactElement<Props>;
}

const inner = (outer: ReactElement<Props>): Props =>
  (outer.props.children as ReactElement<Props>).props;

function kitchen(props: Partial<KitchenProps>): ReactElement<Props>[] {
  const view = (Kitchen as unknown as { type: (p: KitchenProps) => ReactElement }).type;
  return elements(view({ skin, tower: 4, ...props }));
}

describe('SceneItem', () => {
  it('is placed by its centre, sized in rem, and stays quiet before the first hit', () => {
    const outer = item({ react: 'pop', n: 0 });
    expect(outer.props.style).toMatchObject({
      left: '30%',
      top: '60%',
      fontSize: '5rem',
      zIndex: 2,
      '--tilt': '-10deg',
    });
    expect(inner(outer)['data-react']).toBeUndefined();
  });

  it('names its reaction once a hit has landed, big for a perfect and small for an ok', () => {
    const perfect = item({ react: 'pop', n: 4, perfect: true });
    const ok = item({ react: 'pop', n: 4, perfect: false });
    expect(inner(perfect)['data-react']).toBe('pop');
    expect(perfect.props.style).toMatchObject({ '--k': 1 });
    expect(inner(ok)['data-react']).toBe('pop');
    expect(ok.props.style).toMatchObject({ '--k': 0.4 });
  });

  it('replays by hit count: the inner element is keyed by n, so each hit restarts the animation', () => {
    const key = (outer: ReactElement<Props>): string | null =>
      (outer.props.children as ReactElement).key;
    expect(key(item({ react: 'pop', n: 4 }))).not.toBe(key(item({ react: 'pop', n: 5 })));
    expect(key(item({ n: 4 }))).toBe(key(item({ n: 5 })));
  });

  it('does not react without a reaction, however many hits there were', () => {
    expect(inner(item({ n: 9, perfect: true }))['data-react']).toBeUndefined();
  });
});

describe('SceneArt', () => {
  it('sizes a shape on the glyph grid: 48 units are 1em, and hides it from readers', () => {
    const svg = SceneArt({ w: 96, h: 24, children: null }) as ReactElement<Props>;
    expect(svg.props).toMatchObject({
      viewBox: '0 0 96 24',
      width: '2em',
      height: '0.5em',
      'aria-hidden': 'true',
    });
  });
});

describe('Kitchen scene', () => {
  it('draws the game scene with the tower and the hit count, and no scene without one', () => {
    const probe = kitchen({ scene: Probe, tower: 4, hits: 2, perfect: true }).find(
      (e) => e.type === Probe,
    );
    expect(probe?.props).toMatchObject({ tower: 4, n: 2, perfect: true });
    expect(kitchen({}).some((e) => e.type === Probe)).toBe(false);
  });

  it('removes the scene on the done screen, where the tower is the trophy', () => {
    expect(kitchen({ scene: Probe, done: true }).some((e) => e.type === Probe)).toBe(false);
  });
});

describe('Kitchen memo', () => {
  const same = (Kitchen as unknown as { compare: (a: KitchenProps, b: KitchenProps) => boolean })
    .compare;

  it('skips a redraw when only a freshly built skin differs, since a Tv builds its skin every render', () => {
    const fresh = { ...skin, scene: { props: [], pile: null } } as RhythmSkin;
    expect(same({ skin, tower: 3, hits: 5 }, { skin: fresh, tower: 3, hits: 5 })).toBe(true);
  });

  it('redraws when the tower, the hits or the done screen change', () => {
    const base = { skin, tower: 3, hits: 5 };
    expect(same(base, { ...base, tower: 4 })).toBe(false);
    expect(same(base, { ...base, hits: 6 })).toBe(false);
    expect(same(base, { ...base, done: true })).toBe(false);
  });
});
