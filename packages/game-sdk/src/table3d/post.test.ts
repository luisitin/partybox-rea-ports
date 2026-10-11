import {
  AddEquation,
  Camera,
  CustomBlending,
  DstAlphaFactor,
  Material,
  OneFactor,
  PerspectiveCamera,
  Scene,
  WebGLRenderTarget,
  ZeroFactor,
} from 'three';
import type { WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehShader } from 'three/examples/jsm/shaders/BokehShader.js';
import { describe, expect, it } from 'vitest';
import { createPostChain } from './post';

describe('post chain: the alpha patch', () => {
  it('still has the line post.ts removes, so a transparent canvas keeps its alpha through depth of field', () => {
    // three writes alpha 1.0 at the end of the bokeh pass; post.ts drops that line. If a three upgrade rewords
    // it the patch silently stops working and a transparent table turns black: update both together.
    expect(BokehShader.fragmentShader).toContain('gl_FragColor = col / 41.0;');
    expect(BokehShader.fragmentShader).toContain('gl_FragColor.a = 1.0;');
  });
});

/** Every render target and material the composer and its passes hold: each one is a GPU object once it is drawn with. */
function gpuHolders(root: object): Set<WebGLRenderTarget | Material> {
  const found = new Set<WebGLRenderTarget | Material>();
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 7) return;
    seen.add(value);
    if (value instanceof WebGLRenderTarget || value instanceof Material) found.add(value);
    if (value instanceof Scene || value instanceof Camera) return; // the world is the table's, not the chain's
    for (const [key, child] of Object.entries(value))
      if (key !== 'renderer') walk(child, depth + 1);
  };
  walk(root, 0);
  return found;
}

const FULL = {
  depthOfField: { aperture: 0.0002, maxBlur: 0.01 },
  bloom: { strength: 0.3 },
  vignette: 0.4,
};
/** A chain on a renderer that is only asked its pixel ratio (nothing is drawn); the composer comes back with it. */
function build(): { chain: ReturnType<typeof createPostChain>; composer: EffectComposer } {
  let composer!: EffectComposer;
  const gl = { getPixelRatio: () => 1 } as unknown as WebGLRenderer;
  const chain = createPostChain(
    gl,
    new Scene(),
    new PerspectiveCamera(),
    FULL,
    960,
    540,
    1,
    (g, target) => (composer = new EffectComposer(g, target)),
  );
  return { chain, composer };
}
/** What is still held after `free` ran. */
function leftAfter(composer: EffectComposer, free: () => void): string[] {
  const alive = gpuHolders(composer);
  for (const holder of alive) holder.addEventListener('dispose', () => alive.delete(holder));
  free();
  return [...alive].map((holder) => holder.constructor.name);
}

describe('post chain: dispose (T-0333 F1: every rebuild leaked its targets)', () => {
  it('holds a lot of GPU objects to begin with: the walk below is not counting an empty chain', () => {
    const { composer } = build();
    // two composer targets, the depth target, the bloom mips (11) and a material or two per pass
    expect(gpuHolders(composer).size).toBeGreaterThan(25);
  });

  it("frees every render target and material, not only the composer's own two", () => {
    const { chain, composer } = build();
    expect(leftAfter(composer, () => chain.dispose())).toEqual([]);
  });

  it('is what the old dispose missed: the composer alone leaves most of the chain alive', () => {
    const { composer } = build();
    const left = leftAfter(composer, () => {
      composer.dispose();
      composer.renderTarget1.dispose();
    });
    expect(left.length).toBeGreaterThan(20);
    expect(left).toContain('WebGLRenderTarget'); // the bloom mips and the depth target
  });

  it('can be called twice', () => {
    const { chain, composer } = build();
    chain.dispose();
    expect(leftAfter(composer, () => chain.dispose())).toEqual([]);
  });
});

describe('post chain: bloom over a transparent canvas (T-0333 F5: a banded glow above the board)', () => {
  it('adds the bloom only where something is drawn, and leaves the alpha alone', () => {
    const { composer } = build();
    const bloom = composer.passes.find((p) => p instanceof UnrealBloomPass) as UnrealBloomPass;
    const blend = bloom.blendMaterial;
    // three's own blend adds the bloom's light and an alpha to every pixel: the empty page around the board glowed.
    expect(blend.blending).toBe(CustomBlending);
    // colour: the bloom times what is already there (alpha 0 in the void: no light), added to it
    expect([blend.blendSrc, blend.blendDst, blend.blendEquation]).toEqual([
      DstAlphaFactor,
      OneFactor,
      AddEquation,
    ]);
    // alpha: what is already there, untouched
    expect([blend.blendSrcAlpha, blend.blendDstAlpha, blend.blendEquationAlpha]).toEqual([
      ZeroFactor,
      OneFactor,
      AddEquation,
    ]);
  });
});
