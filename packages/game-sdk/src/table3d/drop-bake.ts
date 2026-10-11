// A drop, baked: a box (a house, a hotel) is let fall onto the floor with a little tilt and spin in its own Rapier
// world, the fall is recorded at 60 Hz, and the screen replays it. The recording is stored relative to where the box
// came to rest, so whatever the physics did, the replay ends at exactly the identity pose: the object lies where the
// game put it. Deterministic in the seed, joinable mid-fall, independent of the frame rate.
import { createRng } from '@partybox/shared';
import { dot, qConj, qFromAxisAngle, qMul, qNormalize, qRotate, qSlerp } from './quat';
import type { Quat, Vec3 } from './quat';
import type { Rapier } from './dice-bake';

export interface DropBakeInput {
  /** Same seed, same fall. */
  seed: number;
  /** Width, height and depth of the box, standing on the floor with its base at y = 0. */
  size: Vec3;
  /** How far above its resting place the base starts. */
  height: number;
}
export interface DropBake {
  steps: number;
  seconds: number;
  /** x, y, z per sample: where the base of the box is, relative to its resting place (all zero at the end). */
  positions: Float32Array;
  /** x, y, z, w per sample: the box's turn relative to its resting turn (identity at the end). */
  rotations: Float32Array;
}

const STEP = 1 / 60;
const GRAVITY = 3600;
const MAX_STEPS = 120;
const TRIES = 8;
/** At rest the box must still stand on the face it started on (within this many radians), or it is thrown again. */
const TILT_OK = 0.1;
const UP: Vec3 = [0, 1, 0];

interface Run {
  steps: number;
  centres: Float32Array;
  turns: Float32Array;
  tilt: number;
}

function simulate(rapier: Rapier, input: DropBakeInput, seed: number): Run {
  const [w, h, d] = input.size;
  const rng = createRng(seed);
  const range = (a: number, b: number): number => a + (b - a) * rng.float();
  const world = new rapier.World({ x: 0, y: -GRAVITY, z: 0 });
  try {
    world.timestep = STEP;
    world.createCollider(
      rapier.ColliderDesc.cuboid(400, 20, 400)
        .setTranslation(0, -20, 0)
        .setRestitution(0.3)
        .setFriction(0.8),
    );
    const round = Math.min(w, h, d) * 0.1;
    const lean = qFromAxisAngle([range(-1, 1), 0, range(-1, 1)], range(0.1, 0.32));
    const q = qMul(qFromAxisAngle(UP, range(0, Math.PI * 2)), lean);
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(range(-2, 2), input.height + h / 2, range(-2, 2))
        .setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
        .setLinvel(range(-25, 25), 0, range(-25, 25))
        .setAngvel({ x: range(-3, 3), y: range(-3, 3), z: range(-3, 3) })
        .setLinearDamping(0.1)
        .setAngularDamping(0.5)
        .setCcdEnabled(true),
    );
    world.createCollider(
      rapier.ColliderDesc.roundCuboid(w / 2 - round, h / 2 - round, d / 2 - round, round)
        .setRestitution(0.3)
        .setFriction(0.7)
        .setDensity(1),
      body,
    );
    const centres = new Float32Array(MAX_STEPS * 3);
    const turns = new Float32Array(MAX_STEPS * 4);
    let steps = 0,
      calm = 0;
    const record = (): void => {
      const p = body.translation(),
        r = body.rotation();
      centres.set([p.x, p.y, p.z], steps * 3);
      turns.set([r.x, r.y, r.z, r.w], steps * 4);
      steps++;
    };
    record();
    for (let s = 1; s < MAX_STEPS; s++) {
      world.step();
      record();
      const v = body.linvel(),
        a = body.angvel();
      const still = Math.hypot(v.x, v.y, v.z) < 8 && Math.hypot(a.x, a.y, a.z) < 0.6;
      calm = s * STEP > 0.15 && still ? calm + 1 : 0;
      if (calm >= 6) break;
    }
    const o = (steps - 1) * 4;
    const local = qRotate(qConj([turns[o]!, turns[o + 1]!, turns[o + 2]!, turns[o + 3]!]), UP);
    return {
      steps,
      centres: centres.slice(0, steps * 3),
      turns: turns.slice(0, steps * 4),
      tilt: Math.acos(Math.min(1, dot(local, UP))),
    };
  } finally {
    world.free();
  }
}

/** Lets the box fall and records it. Deterministic in `input` and the engine. */
export function bakeDrop(rapier: Rapier, input: DropBakeInput): DropBake {
  let run = simulate(rapier, input, input.seed);
  for (let k = 1; k < TRIES && run.tilt > TILT_OK; k++) {
    const next = simulate(rapier, input, input.seed + k * 7919);
    if (next.tilt < run.tilt) run = next;
  }
  const { steps, centres, turns } = run;
  const half: Vec3 = [0, input.size[1] / 2, 0];
  const quat = (s: number): Quat => [
    turns[s * 4]!,
    turns[s * 4 + 1]!,
    turns[s * 4 + 2]!,
    turns[s * 4 + 3]!,
  ];
  // Where the base is: the centre, minus half the height along the box's own up.
  const base = (s: number): Vec3 => {
    const down = qRotate(quat(s), half);
    return [
      centres[s * 3]! - down[0],
      centres[s * 3 + 1]! - down[1],
      centres[s * 3 + 2]! - down[2],
    ];
  };
  const last = steps - 1,
    rest = base(last),
    restBack = qConj(quat(last));
  const positions = new Float32Array(steps * 3),
    rotations = new Float32Array(steps * 4);
  for (let s = 0; s < steps; s++) {
    const b = base(s);
    const p = qRotate(restBack, [b[0] - rest[0], b[1] - rest[1], b[2] - rest[2]]);
    // The contact is soft for a frame: the base sinks a couple of units into the floor at the first touch. Not drawn.
    positions.set([p[0], Math.max(0, p[1]), p[2]], s * 3);
    rotations.set(qNormalize(qMul(restBack, quat(s))), s * 4);
  }
  // Exactly the identity pose at the end, whatever the float noise says.
  positions.set([0, 0, 0], last * 3);
  rotations.set([0, 0, 0, 1], last * 4);
  return { steps, seconds: last * STEP, positions, rotations };
}

/** The pose of the box `seconds` into the fall, relative to its resting place (it stays there once the fall is over). */
export function sampleDrop(bake: DropBake, seconds: number): { position: Vec3; rotation: Quat } {
  const f = Math.min(Math.max(seconds / STEP, 0), bake.steps - 1);
  const a = Math.floor(f),
    b = Math.min(a + 1, bake.steps - 1),
    u = f - a;
  const at = (k: number, o: number): number => bake.positions[k * 3 + o]!;
  const q = (k: number): Quat => [
    bake.rotations[k * 4]!,
    bake.rotations[k * 4 + 1]!,
    bake.rotations[k * 4 + 2]!,
    bake.rotations[k * 4 + 3]!,
  ];
  return {
    position: [
      at(a, 0) + (at(b, 0) - at(a, 0)) * u,
      at(a, 1) + (at(b, 1) - at(a, 1)) * u,
      at(a, 2) + (at(b, 2) - at(a, 2)) * u,
    ],
    rotation: qSlerp(q(a), q(b), u),
  };
}
