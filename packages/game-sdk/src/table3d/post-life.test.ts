import type { Camera, Scene, WebGLRenderer } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { PostChain } from './post';
import { PostLife } from './post-life';
import type { PostWorld } from './post-life';
import type { PostSettings } from './types';

const world = (): PostWorld => ({
  gl: {} as WebGLRenderer,
  scene: {} as Scene,
  camera: {} as Camera,
});
const POST: PostSettings = { bloom: { strength: 0.3 }, vignette: 0.4 };
const SIZE = { width: 960, height: 540, dpr: 2 };

/** A chain maker whose chains record being disposed, and a loader the test opens by hand. */
function rig(failLoad = false) {
  const made: { chain: PostChain; disposed: boolean; args: unknown[] }[] = [];
  const createPostChain = vi.fn((...args: unknown[]) => {
    const entry = {
      args,
      disposed: false,
      chain: {
        render: vi.fn(),
        resize: vi.fn(),
        dispose: () => {
          entry.disposed = true;
        },
      } as PostChain,
    };
    made.push(entry);
    return entry.chain;
  });
  const onFail = vi.fn();
  const life = new PostLife(
    () =>
      failLoad ? Promise.reject(new Error('chunk')) : Promise.resolve({ createPostChain } as never),
    SIZE,
    onFail,
  );
  return { life, made, createPostChain, onFail };
}
const loaded = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

describe('PostLife (T-0333 F1: the chain was rebuilt, and leaked, on every render)', () => {
  it('builds the chain once however often the parent renders with a new callback', async () => {
    const { life, createPostChain, made } = rig();
    const w = world();
    for (let render = 0; render < 50; render++) {
      life.listen(vi.fn()); // a parent that hands down a fresh function each render
      life.sync(w, POST); // and the effect running again
    }
    await loaded();
    expect(createPostChain).toHaveBeenCalledTimes(1);
    expect(made[0]!.disposed).toBe(false);
    expect(life.chain).toBe(made[0]!.chain);
  });

  it('builds against the size it knows when the chunk lands, and the chain follows a resize', async () => {
    const { life, made } = rig();
    life.sync(world(), POST);
    life.resize({ width: 1280, height: 720, dpr: 2 });
    await loaded();
    expect(made[0]!.args.slice(4)).toEqual([1280, 720, 2]);
    life.resize({ width: 1920, height: 1080, dpr: 2 });
    expect(made[0]!.chain.resize).toHaveBeenCalledWith(1920, 1080, 2);
    expect(made).toHaveLength(1);
  });

  it('frees the old chain and builds a new one only when the scene, camera or recipe changes', async () => {
    const { life, made } = rig();
    const w = world();
    const other = { ...w, camera: {} as Camera };
    life.sync(w, POST);
    await loaded();
    life.sync(other, POST); // a new camera
    await loaded();
    life.sync(other, { ...POST, vignette: 0.5 }); // a new recipe
    await loaded();
    life.sync(other, { ...POST, vignette: 0.5 }); // the same again: nothing happens
    await loaded();
    expect(made).toHaveLength(3);
    expect(made.map((m) => m.disposed)).toEqual([true, true, false]);
  });

  it('takes the chain down when none is wanted, and when the table goes', async () => {
    const { life, made } = rig();
    const w = world();
    life.sync(w, POST);
    await loaded();
    life.sync(w, null);
    expect(made[0]!.disposed).toBe(true);
    expect(life.chain).toBeNull();
    life.sync(w, POST);
    await loaded();
    life.down();
    expect(made.map((m) => m.disposed)).toEqual([true, true]);
    expect(life.chain).toBeNull();
  });

  it('never builds a chain that was taken down while its chunk was still loading', async () => {
    const { life, createPostChain } = rig();
    life.sync(world(), POST);
    life.down();
    await loaded();
    expect(createPostChain).not.toHaveBeenCalled();
    expect(life.chain).toBeNull();
  });

  it('a chunk that will not load calls the latest onFail, once, and builds nothing', async () => {
    const { life, createPostChain, onFail } = rig(true);
    const latest = vi.fn();
    life.listen(latest);
    life.sync(world(), POST);
    await loaded();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
    expect(createPostChain).not.toHaveBeenCalled();
  });

  it('stays quiet about a failed chunk once the chain was taken down', async () => {
    const { life, onFail } = rig(true);
    life.sync(world(), POST);
    life.down();
    await loaded();
    expect(onFail).not.toHaveBeenCalled();
  });
});
