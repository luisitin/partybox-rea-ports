// The browser half of skin.ts (T-0595). Lives in the lazy WebGL chunk with model.tsx. A skin's PNG is loaded once and
// shared by every model that wears it (a table of eight builds one texture per colour, not eight); a texture nobody
// wears any more is kept a while and then freed, so a phone browsing a hero's colours never piles them up on the GPU.
import { useEffect } from 'react';
import { Color, SRGBColorSpace, TextureLoader } from 'three';
import type { Material, MeshStandardMaterial, Texture } from 'three';
import type { Skin3d } from './skin';

/** Textures nobody wears that stay loaded, newest last. */
const KEEP_IDLE = 10;

interface Entry {
  url: string;
  texture: Texture | null;
  failed: boolean;
  promise: Promise<void>;
  wearers: number;
}

const entries = new Map<string, Entry>();
/** Entries nobody wears, oldest first. */
const idle: Entry[] = [];

function entryFor(url: string): Entry {
  const hit = entries.get(url);
  if (hit) return hit;
  const entry: Entry = {
    url,
    texture: null,
    failed: false,
    promise: Promise.resolve(),
    wearers: 0,
  };
  entry.promise = new TextureLoader().loadAsync(url).then(
    (texture) => {
      // A glTF texture is read upside down relative to an image file.
      texture.flipY = false;
      texture.colorSpace = SRGBColorSpace;
      entry.texture = texture;
    },
    () => {
      entry.failed = true;
    },
  );
  entries.set(url, entry);
  return entry;
}

function release(entry: Entry): void {
  if (--entry.wearers > 0) return;
  idle.push(entry);
  while (idle.length > KEEP_IDLE) {
    const old = idle.shift();
    if (!old || old.wearers > 0) continue;
    old.texture?.dispose();
    entries.delete(old.url);
  }
}

/** The skin's texture: suspends until it has loaded, null for no `map` or for one that failed (the model keeps its own colours). */
export function useSkinMap(url: string | undefined): Texture | null {
  const entry = url ? entryFor(url) : null;
  useEffect(() => {
    if (!entry) return undefined;
    const at = idle.indexOf(entry);
    if (at >= 0) idle.splice(at, 1);
    entry.wearers++;
    return () => release(entry);
  }, [entry]);
  if (entry && !entry.texture && !entry.failed) throw entry.promise;
  return entry?.texture ?? null;
}

/** Makes `tex` read like the texture it replaces: the same wrapping and filtering (the pets' swatches want nearest). */
function adopt(tex: Texture, old: Texture): void {
  const same =
    tex.wrapS === old.wrapS &&
    tex.wrapT === old.wrapT &&
    tex.magFilter === old.magFilter &&
    tex.minFilter === old.minFilter &&
    tex.anisotropy === old.anisotropy &&
    tex.channel === old.channel;
  if (same) return;
  tex.wrapS = old.wrapS;
  tex.wrapT = old.wrapT;
  tex.magFilter = old.magFilter;
  tex.minFilter = old.minFilter;
  tex.anisotropy = old.anisotropy;
  tex.channel = old.channel;
  tex.needsUpdate = true;
}

function skinOne(
  material: Material,
  skin: Skin3d,
  map: Texture | null,
  made: Material[],
): Material {
  const standard = material as MeshStandardMaterial;
  const color = skin.colors?.[material.name];
  const swap = map !== null && !!standard.map;
  if (color === undefined && !swap) return material;
  const copy = material.clone() as MeshStandardMaterial;
  if (swap && map && standard.map) {
    adopt(map, standard.map);
    copy.map = map;
  }
  if (color !== undefined) copy.color = new Color(color);
  made.push(copy);
  return copy;
}

/**
 * The material (or array of materials) wearing the skin; the original where the skin leaves it alone. The copies are
 * pushed to `made` so the model can free them; the texture is shared and freed by `useSkinMap`.
 */
export function skinMaterial(
  material: Material | Material[],
  skin: Skin3d,
  map: Texture | null,
  made: Material[],
): Material | Material[] {
  return Array.isArray(material)
    ? material.map((m) => skinOne(m, skin, map, made))
    : skinOne(material, skin, map, made);
}
