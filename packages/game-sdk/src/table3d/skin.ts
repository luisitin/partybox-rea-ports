// A model in another colour (T-0595): what `Model3d.skin` takes. Pure, no WebGL (the three.js half is skin-three.ts).
// Two ways to paint, one per kind of model. A model with a colour texture (the Kenney pets, the KayKit adventurers)
// swaps that texture for a baked one of the same size and UVs: `map`. A model of flat-colour materials (the Quaternius
// mascot) names the materials to colour: `colors`. A tint is not offered: it would colour the eyes and the steel too.

export interface Skin3d {
  /** URL of a PNG that replaces the model's colour texture (same size, same UVs: a palette swap made offline). */
  map?: string;
  /** Flat materials by name to a CSS colour (`{ Main: '#ff5d8f' }`); the model's other materials stay as drawn. */
  colors?: Readonly<Record<string, string>>;
}

/** Two skins with the same key paint the same, whichever object names them (a model is rebuilt only when this changes). */
export function skinKey(skin: Skin3d): string {
  const colors = Object.entries(skin.colors ?? {})
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, color]) => `${name}=${color}`)
    .join(',');
  return `${skin.map ?? ''}|${colors}`;
}
