// When the cinematic post chain is made and when it is taken down, apart from React and WebGL so a test can drive
// it. T-0333 F1: the chain was rebuilt (and its GPU targets leaked) whenever the parent handed down a new callback;
// now only a different scene, camera or recipe builds one, and the callback is read when it is needed.
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { PostChain, createPostChain } from './post';
import type { PostSettings } from './types';

/** What a chain is built against: the renderer, the scene it draws and the camera that looks at it. */
export type PostWorld = { gl: WebGLRenderer; scene: Scene; camera: Camera };
/** The CSS size and the backing store's pixel ratio. */
export type PostSize = { width: number; height: number; dpr: number };
type Maker = { createPostChain: typeof createPostChain };

export class PostLife {
  /** The chain that is up, or null (not built yet, still loading, or not wanted). */
  chain: PostChain | null = null;
  /** Called when the chunk would not load: the latest callback given to `listen`. */
  private onFail: () => void;
  private size: PostSize;
  private world: PostWorld | null = null;
  private key = '';
  private stop: (() => void) | null = null;

  constructor(
    private readonly load: () => Promise<Maker>,
    size: PostSize,
    onFail: () => void,
  ) {
    this.size = size;
    this.onFail = onFail;
  }

  /** Swaps the callback for a failed load. Never rebuilds anything: the parent may hand down a new one every render. */
  listen(onFail: () => void): void {
    this.onFail = onFail;
  }

  /** Makes sure the chain for `post` (null: none) stands in `world`. A chain that already does is left alone. */
  sync(world: PostWorld, post: PostSettings | null): void {
    const key = post ? JSON.stringify(post) : '';
    const w = this.world;
    if (
      w &&
      w.gl === world.gl &&
      w.scene === world.scene &&
      w.camera === world.camera &&
      key === this.key
    )
      return;
    this.down();
    this.world = world;
    this.key = key;
    if (!post) return;
    let dead = false;
    let made: PostChain | undefined;
    this.load().then(
      (module) => {
        if (dead) return;
        const { width, height, dpr } = this.size;
        made = module.createPostChain(
          world.gl,
          world.scene,
          world.camera,
          post,
          width,
          height,
          dpr,
        );
        this.chain = made;
      },
      () => {
        if (!dead) this.onFail();
      },
    );
    this.stop = () => {
      dead = true;
      this.chain = null;
      made?.dispose();
    };
  }

  /** The canvas changed size (the ratio is fixed for its life): the chain follows, nothing is rebuilt. */
  resize(size: PostSize): void {
    this.size = size;
    this.chain?.resize(size.width, size.height, size.dpr);
  }

  /** Takes the chain down and frees what it holds. A chain still loading is dropped when it arrives. */
  down(): void {
    this.stop?.();
    this.stop = null;
    this.world = null;
    this.key = '';
  }
}
