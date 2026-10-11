// Cinematic post-processing for Table3d, a lazy chunk: only a table that sets `post` downloads it.
// Chain: scene (4x MSAA, half-float) -> depth of field -> bloom (only over what is drawn) -> vignette -> output
// (tone mapping + sRGB).
import {
  AddEquation,
  CustomBlending,
  DstAlphaFactor,
  HalfFloatType,
  OneFactor,
  Vector2,
  WebGLRenderTarget,
  ZeroFactor,
} from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { PostSettings } from './types';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 } },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.32, 0.9, d) * amount;
      gl_FragColor = c;
    }`,
};

export interface PostChain {
  /** Draws the frame to the screen. `focusDistance`: how far the in-focus plane is from the camera. */
  render(delta: number, focusDistance: number): void;
  /** CSS size and the backing store's pixel ratio (the ratio is fixed for the canvas's life; the size follows layout). */
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export function createPostChain(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera & { aspect?: number; near?: number; far?: number },
  post: PostSettings,
  width: number,
  height: number,
  dpr: number,
  /** A test takes the composer to count what `dispose` frees. */
  makeComposer: (gl: WebGLRenderer, target: WebGLRenderTarget) => EffectComposer = (g, t) =>
    new EffectComposer(g, t),
): PostChain {
  const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
  const composer = makeComposer(gl, target);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh: BokehPass | undefined;
  let focusUniforms: Record<string, { value: number }> | undefined;
  if (post.depthOfField) {
    bokeh = new BokehPass(scene, camera, {
      focus: 1000,
      aperture: post.depthOfField.aperture,
      maxblur: post.depthOfField.maxBlur,
    });
    // three's bokeh writes alpha 1.0 everywhere, which would turn a transparent canvas black: keep the blurred alpha.
    bokeh.materialBokeh.fragmentShader = bokeh.materialBokeh.fragmentShader.replace(
      'gl_FragColor.a = 1.0;',
      '',
    );
    bokeh.materialBokeh.needsUpdate = true;
    focusUniforms = bokeh.uniforms as Record<string, { value: number }>;
    composer.addPass(bokeh);
  }
  let bloom: UnrealBloomPass | undefined;
  if (post.bloom) {
    bloom = new UnrealBloomPass(
      new Vector2(width * dpr, height * dpr),
      post.bloom.strength,
      post.bloom.radius ?? 0.6,
      post.bloom.threshold ?? 0.96,
    );
    // three adds the bloom's light, and an alpha to carry it, to every pixel. Over a transparent canvas that lights the
    // empty page around the board: a banded dome above its far edge (T-0333 F5). Add it only where something is
    // drawn (the destination's alpha) and leave the alpha alone: on the board it adds exactly what it did.
    const blend = bloom.blendMaterial;
    blend.blending = CustomBlending;
    blend.blendEquation = blend.blendEquationAlpha = AddEquation;
    blend.blendSrc = DstAlphaFactor;
    blend.blendDst = OneFactor;
    blend.blendSrcAlpha = ZeroFactor;
    blend.blendDstAlpha = OneFactor;
    composer.addPass(bloom);
  }
  if (post.vignette) {
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.amount!.value = post.vignette;
    composer.addPass(vignette);
  }
  composer.addPass(new OutputPass());
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  return {
    render(delta, focusDistance) {
      if (focusUniforms) {
        focusUniforms.focus!.value = focusDistance;
        focusUniforms.aspect!.value = camera.aspect ?? 1;
        focusUniforms.nearClip!.value = camera.near ?? 0.1;
        focusUniforms.farClip!.value = camera.far ?? 4000;
      }
      composer.render(delta);
    },
    resize(w, h, ratio) {
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
    },
    dispose() {
      // The composer frees only its own two targets and its copy pass: each pass holds the rest (the depth
      // target, the bloom mips, every material and quad), and a chain that is rebuilt leaked all of it (T-0333 F1).
      for (const pass of composer.passes) pass.dispose();
      bloom?.materialHighPassFilter.dispose(); // the one material three's own bloom dispose forgets
      composer.dispose();
      target.dispose();
    },
  };
}
