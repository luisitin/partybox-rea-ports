import type { CSSProperties, ReactNode } from 'react';
import type { Skin3d } from './skin';

export type { Skin3d } from './skin';

export type Point3 = readonly [number, number, number];
export type MeshData = readonly {
  points: readonly Point3[];
  material?: 'dark' | 'bright';
}[];

export interface ProjectedSolidFace {
  points: string;
  shade: number;
  depth: number;
  material?: 'dark' | 'bright';
}

export interface TableCamera {
  orthographic?: boolean;
  position?: Point3;
  up?: Point3;
  target?: Point3;
  zoom?: number;
  fov?: number;
  near?: number;
  far?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/** One directional light aimed at `target`. With `shadow` it casts a soft shadow map over a square of
 *  `extent` world units around the target (`mapSize` texels a side, default 2048); needs `shadows` on Table3d. */
export interface KeyLight {
  position: Point3;
  target?: Point3;
  intensity?: number;
  /** Concrete colour, default white (a warm key against a cool fill reads as studio light). */
  color?: string;
  shadow?: { extent: number; mapSize?: number; bias?: number };
}

/** A camera that glides: the runtime chases `position` and `target` with a critically damped spring, so a goal that
 *  jumps (a new shot) or moves (a piece being followed) never snaps the view. Give it a fresh goal as often as you like. */
export interface CameraRig {
  position: Point3;
  target: Point3;
  /** What is being watched, default `target`: the follow spot lights it and the depth of field focuses on it. */
  focus?: Point3;
  /** Seconds to cover ~95 % of a step, default 0.7. Reduced motion cuts instead. */
  settle?: number;
}

/** A soft pool of light that follows the rig's focus (the piece in play). Needs `rig`. */
export interface FollowSpot {
  /** Distance above the focus, default 1200. */
  height?: number;
  intensity?: number;
  /** Cone half-angle in radians, default 0.32. */
  angle?: number;
  /** 0 (hard edge) to 1 (all falloff), default 0.85. */
  penumbra?: number;
  color?: string;
}

/** Cinematic post-processing, drawn through one MSAA half-float pass chain (lazy chunk: only a Table3d that sets
 *  `post` downloads it). The runtime drops it by itself if frames stay slow (never by lowering the resolution). */
export interface PostSettings {
  /** Glow on highlights above `threshold` (linear luminance, default 0.96). */
  bloom?: { strength: number; radius?: number; threshold?: number };
  /** Soft focus away from the rig's focus: blur grows by `aperture` (screen fraction per world unit) up to `maxBlur`. */
  depthOfField?: { aperture: number; maxBlur: number };
  /** Darkened corners, 0 (none) to 1. */
  vignette?: number;
  /** Never give the effects up when frames run slow (captures and tests); default: they drop after a few seconds of it. */
  keep?: boolean;
}

export interface Table3dProps {
  children: ReactNode;
  camera?: TableCamera;
  style?: CSSProperties;
  reducedMotion?: boolean;
  /** Sharpness ceiling: the canvas backing store is CSS size x min(devicePixelRatio, maxDpr), fixed for the canvas's
   *  life (resizing a WebGL drawing buffer leaves the canvas blank in WebKit). Default 1.5. */
  maxDpr?: number;
  /** `true`: stop drawing frames (a board that is mounted but hidden). The scene stays alive, so showing it again
   *  costs no new context, shader compile or texture upload. Call it only once `onReady` has fired: a canvas paused
   *  before its first frame never draws it. Default false. */
  paused?: boolean;
  /** Soft shadow maps: solids cast and receive them; a `shadowMaterial` plane or `receiveShadow` meshes show them. */
  shadows?: boolean;
  /** `false`: skip the built-in ambient + directional pair, the game lights its own scene. */
  defaultLights?: boolean;
  keyLight?: KeyLight;
  /** `'studio'`: a soft box-room reflection map on every standard material (chrome/metal looks like metal). */
  environment?: 'studio';
  /** Strength of the environment map, default 0.55. A diffuse paper board wants it low, polished metal higher. */
  environmentIntensity?: number;
  /** `'neutral'`: Khronos Neutral tone mapping instead of R3F's default ACES, which washes a printed board's colours toward grey. */
  toneMapping?: 'neutral';
  /** Tone-mapping exposure, default 1. Lower for a moodier, less bright picture. */
  exposure?: number;
  rig?: CameraRig;
  spot?: FollowSpot;
  post?: PostSettings;
  /** Called once if the runtime gave up `post` because frames stayed slow (the game can tone its look down too). */
  onTier?: (tier: 'sharp') => void;
  /** The game's accessible public board, also used before WebGL is ready or unavailable. */
  fallback?: ReactNode;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/** A group that breathes: scale (and the opacity of transparent materials inside) swells and settles on a loop.
 *  Static when reduced motion is on. For a ring under the piece whose turn it is. */
export interface Pulse3dProps {
  children: ReactNode;
  position?: Point3;
  rotation?: Point3;
  /** Seconds per breath, default 1.6. */
  period?: number;
  /** How far the scale swells, as a fraction (0.15 = 15 %), default 0.12. */
  amount?: number;
}

/** A group that turns slowly about its own vertical axis (a piece on a turntable). Static when reduced motion is on. */
export interface Spin3dProps {
  children: ReactNode;
  position?: Point3;
  scale?: number;
  /** Seconds per full turn, default 14. */
  period?: number;
  /** Where in the turn it starts, 0 to 1, so a row of pieces does not turn in lockstep. Default 0. */
  phase?: number;
}

export interface Solid3dProps {
  mesh: MeshData;
  color?: string;
  position?: Point3;
  rotation?: Point3;
  scale?: number | Point3;
  /** Finish of the main (non-dark, non-bright) faces: 0 to 1, default 0.68 and 0.3. */
  metalness?: number;
  roughness?: number;
  /** Smooth shading: faces meeting at less than this angle (radians) share normals; default flat. */
  crease?: number;
}

/** The floor a roll is thrown onto: its centre and size on the table plane (X/Z), and the height of its surface (Y). */
export interface DiceTray {
  x: number;
  z: number;
  width: number;
  depth: number;
  floor: number;
}

/** Dice thrown on the table by the real physics engine and replayed from a recording: bounces, die against die and the
 *  tray's walls are simulated, but the roll always ends showing `values`. The same `seed` throws the same way, on every
 *  screen, at any frame rate, and a screen that joins mid-throw sees the throw where it is. Goes inside Table3d. */
export interface Dice3dProps {
  /** The faces (1 to 6) the roll lands showing, one per die. Empty: no dice. */
  values: readonly number[];
  /** A new throw for each value (the game's roll counter). */
  seed: number;
  /** When the roll began, on the clock `clock` reads (ms). */
  startedAt: number;
  /** The game's clock in ms, read every frame: the server's, so every screen sees the same throw. */
  clock: () => number;
  tray: DiceTray;
  /** Edge of a die in table units, default 30. */
  size?: number;
  /** How long the roll takes to come to rest, ms, default 1000: the recording plays slightly faster or slower to fit. */
  durationMs?: number;
  /** Body and pip colours, default ivory and near-black. */
  color?: string;
  pipColor?: string;
  /** The dice are simply at rest (also when the platform asks for reduced motion). */
  reducedMotion?: boolean;
  /** A die kept out of the throw: `hold[i]` is where die i stands (table x/z) instead of where the throw left it, from
   *  the first frame of a roll, and a die that becomes held after the roll glides there. null/absent: the die is thrown. */
  hold?: readonly ({ x: number; z: number } | null)[];
}

/** A group that falls into place on the real physics engine, from a recording (the same bake-and-replay as `Dice3d`):
 *  it tilts, lands, bounces a little and settles, and always ends exactly where its parent put it. Before `startedAt`
 *  the children are hidden; after the fall they are plain children. The same `seed` falls the same way on every screen.
 *  Goes inside Table3d; the children are posed as if at rest, on a floor at y = 0 of this group. */
export interface Drop3dProps {
  children: ReactNode;
  seed: number;
  /** Width, height and depth of the box the children fill, standing on the floor: what the physics lets fall. */
  size: readonly [number, number, number];
  /** How far above its place the base starts, default 80. */
  height?: number;
  /** When the fall began, on the clock `clock` reads (ms). */
  startedAt: number;
  clock: () => number;
  /** Stretch or squeeze the recording to this long, ms; default its own length (about half a second). */
  durationMs?: number;
  /** Not drawn falling: the children are simply in place (also when the platform asks for reduced motion). */
  reducedMotion?: boolean;
}

/** Where a tracked model stands this frame; the game reads it from its own layout (an SVG piece, say). */
export interface ModelPose {
  position: Point3;
  /** The model's longest side, in scene units. */
  size: number;
  /** Turn about the upright axis, in radians. */
  rotationY?: number;
  /** Tip about the table's x axis (toward or away from the viewer), radians; turned after rotationY, so a piece falls the same way whatever it faces. */
  rotationX?: number;
  /** Tip about the table's z axis (sideways), radians. */
  rotationZ?: number;
  /** An animated GLB (skinned, with clips): the clip to play, by name. A new name cross-fades in; unknown or absent
   *  leaves the model in its rest pose. Ignored by a GLB without animations. */
  clip?: string;
  /** Plays the same clip again from its start when this changes (hop, hop). */
  clipKey?: number;
  /** Hold the clip's last frame instead of looping it (a landing, a cheer). */
  clipOnce?: boolean;
  /** Playback rate, default 1. */
  clipSpeed?: number;
  /** Scale the standing model up/down vertically only (a squash and stretch), default 1. */
  squash?: number;
}

/** Where a tracked group stands this frame (Track3d). */
export interface GroupPose {
  position: Point3;
  /** Turn about the upright axis, radians. */
  rotationY?: number;
  /** Tilt about the x and z axes, radians (a tray rolling and pitching), default 0. */
  rotationX?: number;
  rotationZ?: number;
  /** Uniform, or per axis; default 1. */
  scale?: number | Point3;
  /** 0 to 1, multiplies the opacity of every transparent material inside (a floater fading out), default 1. */
  opacity?: number;
}

export interface Track3dProps {
  children: ReactNode;
  /** Called every frame: the group follows what it returns and hides while it returns null. Read the game's clock in
   *  here, not in React state, so the motion costs no renders. */
  track: () => GroupPose | null;
}

export interface Model3dProps {
  /** A GLB that stands on y = 0, centred on x/z, longest side 1 (scripts/glb-lod.ts makes one). */
  url: string;
  color?: string;
  /** Fixed placement, used when `track` is absent. */
  position?: Point3;
  size?: number;
  /** Casts a shadow when the table has a shadow map. Off by default: every caster is drawn again in the shadow pass. */
  castShadow?: boolean;
  /** Called every frame: the model follows what it returns and hides while it returns null. */
  track?: () => ModelPose | null;
  /** The model in another colour (a baked texture swap and/or flat material colours, see skin.ts): the cast's skins. */
  skin?: Skin3d;
  /** Reports a model that failed to load (the game keeps drawing its 2D piece). */
  onError?: (error: Error) => void;
}
