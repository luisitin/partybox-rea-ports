// A dice roll, baked: the throw is simulated once in its own Rapier world (the real engine: bounces, die against die,
// the tray walls), the whole fall is recorded at 60 Hz, and the screen only replays the recording. So a roll is the
// same for the same seed, can be joined mid-throw, never depends on the frame rate, and always ends showing the
// values the game's reducer chose: the recording says which body face landed up, and the die's pips are laid on the
// body turned by one fixed cube symmetry so that face carries the wanted number. Physics never picks the outcome.
import type { useRapier } from '@react-three/rapier';
import { createRng } from '@partybox/shared';
import { dot, qConj, qFromAxisAngle, qFromTo, qMul, qNormalize, qRotate, qSlerp } from './quat';
import type { Quat, Vec3 } from './quat';
import type { DiceTray } from './types';

export type Rapier = ReturnType<typeof useRapier>['rapier'];

/** The die's own faces: opposite faces sum to 7. `u` and `v` lay the pips out on the face. */
export const DIE_FACES: readonly { value: number; normal: Vec3; u: Vec3; v: Vec3 }[] = [
  { value: 1, normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { value: 6, normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { value: 3, normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { value: 2, normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { value: 5, normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

export interface DiceBakeInput {
  /** One wanted face (1 to 6) per die. */
  values: readonly number[];
  /** Same seed, same throw. */
  seed: number;
  tray: DiceTray;
  /** Edge length of a die, in table units. */
  size: number;
}
export interface DiceBake {
  dice: number;
  /** Samples per die, 60 Hz: the first is the throw's start, the last the dice at rest. */
  steps: number;
  seconds: number;
  /** x, y, z per sample, per die: the centre of the die. */
  positions: Float32Array[];
  /** x, y, z, w per sample, per die: the orientation of the drawn die (its pips included). */
  rotations: Float32Array[];
}

const STEP = 1 / 60;
/** Table units per second squared: heavier than the real thing's pace so a die falls and bounces readably on a TV. */
const GRAVITY = 3600;
const MAX_STEPS = 600;
/** After this long the felt grips harder every step, so a roll always comes to rest within about a second. */
const RAMP_FROM = 0.5;
const TRIES = 8;
/** A die more tilted than this (radians) at rest is leaning on something: throw again with the next seed. */
const TILT_OK = 0.1;
const UP: Vec3 = [0, 1, 0];

/** Which of the die's faces looks up in orientation `q`, and how far (radians) it is from straight up. */
export function faceUp(q: Quat): { value: number; normal: Vec3; tilt: number } {
  const local = qRotate(qConj(q), UP);
  let best = DIE_FACES[0]!,
    bestDot = -2;
  for (const face of DIE_FACES) {
    const d = dot(face.normal, local);
    if (d > bestDot) {
      best = face;
      bestDot = d;
    }
  }
  return { value: best.value, normal: best.normal, tilt: Math.acos(Math.min(1, bestDot)) };
}

interface Run {
  steps: number;
  positions: Float32Array[];
  bodies: Float32Array[];
  tilt: number;
}

function simulate(rapier: Rapier, input: DiceBakeInput, seed: number): Run {
  const { tray, size } = input;
  const n = input.values.length;
  const rng = createRng(seed);
  const range = (a: number, b: number): number => a + (b - a) * rng.float();
  const world = new rapier.World({ x: 0, y: -GRAVITY, z: 0 });
  try {
    world.timestep = STEP;
    const hw = tray.width / 2,
      hd = tray.depth / 2;
    const fixed = (half: Vec3, at: Vec3, restitution: number, friction: number): void => {
      world.createCollider(
        rapier.ColliderDesc.cuboid(half[0], half[1], half[2])
          .setTranslation(at[0], at[1], at[2])
          .setRestitution(restitution)
          .setFriction(friction),
      );
    };
    fixed([hw + 40, 20, hd + 40], [tray.x, tray.floor - 20, tray.z], 0.4, 0.8);
    fixed([10, 300, hd + 20], [tray.x - hw - 10, tray.floor + 300, tray.z], 0.5, 0.1);
    fixed([10, 300, hd + 20], [tray.x + hw + 10, tray.floor + 300, tray.z], 0.5, 0.1);
    fixed([hw + 20, 300, 10], [tray.x, tray.floor + 300, tray.z - hd - 10], 0.5, 0.1);
    fixed([hw + 20, 300, 10], [tray.x, tray.floor + 300, tray.z + hd + 10], 0.5, 0.1);
    const round = size * 0.1,
      half = size / 2 - round;
    const bodies = Array.from({ length: n }, (_, i) => {
      const axis: Vec3 = [range(-1, 1), range(-1, 1), range(-1, 1)];
      const q = qFromAxisAngle(axis, range(0, Math.PI * 2));
      const spin = (): number => range(-20, 20);
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(
            tray.x + (i - (n - 1) / 2) * size * 1.7 + range(-0.2, 0.2) * size,
            tray.floor + size * (2.4 + 0.9 * i + range(0, 1.2)),
            tray.z - hd * 0.6 + range(-0.1, 0.1) * hd,
          )
          .setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
          .setLinvel(range(-90, 90), range(-60, 0), range(240, 380))
          .setAngvel({ x: spin(), y: spin(), z: spin() })
          .setLinearDamping(0.1)
          .setAngularDamping(0.25)
          .setCcdEnabled(true),
      );
      world.createCollider(
        rapier.ColliderDesc.roundCuboid(half, half, half, round)
          .setRestitution(0.42)
          .setFriction(0.6)
          .setDensity(1),
        body,
      );
      return body;
    });
    const positions = bodies.map(() => new Float32Array(MAX_STEPS * 3));
    const rotations = bodies.map(() => new Float32Array(MAX_STEPS * 4));
    let steps = 0,
      calm = 0;
    const record = (): void => {
      bodies.forEach((body, i) => {
        const p = body.translation(),
          q = body.rotation();
        positions[i]!.set([p.x, p.y, p.z], steps * 3);
        rotations[i]!.set([q.x, q.y, q.z, q.w], steps * 4);
      });
      steps++;
    };
    record();
    for (let s = 1; s < MAX_STEPS; s++) {
      const t = s * STEP;
      if (t > RAMP_FROM) {
        const grip = 0.25 + 7 * (t - RAMP_FROM);
        for (const body of bodies) {
          body.setLinearDamping(grip);
          body.setAngularDamping(grip * 1.4);
        }
      }
      world.step();
      record();
      const still = bodies.every((body) => {
        const v = body.linvel(),
          w = body.angvel();
        return Math.hypot(v.x, v.y, v.z) < 8 && Math.hypot(w.x, w.y, w.z) < 0.6;
      });
      calm = t > 0.3 && still ? calm + 1 : 0;
      if (calm >= 6) break;
    }
    let tilt = 0;
    for (const r of rotations) {
      const o = (steps - 1) * 4;
      tilt = Math.max(tilt, faceUp([r[o]!, r[o + 1]!, r[o + 2]!, r[o + 3]!]).tilt);
    }
    return {
      steps,
      positions: positions.map((p) => p.slice(0, steps * 3)),
      bodies: rotations.map((r) => r.slice(0, steps * 4)),
      tilt,
    };
  } finally {
    world.free();
  }
}

const faceValue = (value: number): number => Math.min(6, Math.max(1, Math.round(value) || 1));

/** Throws the dice and records the fall. Deterministic in `input` and the engine. */
export function bakeDiceRoll(rapier: Rapier, input: DiceBakeInput): DiceBake {
  let run = simulate(rapier, input, input.seed);
  for (let k = 1; k < TRIES && run.tilt > TILT_OK; k++) {
    const next = simulate(rapier, input, input.seed + k * 7919);
    if (next.tilt < run.tilt) run = next;
  }
  const rng = createRng(input.seed ^ 0x5bd1e995);
  const rotations = run.bodies.map((body, i) => {
    const o = (run.steps - 1) * 4;
    const rest = faceUp([body[o]!, body[o + 1]!, body[o + 2]!, body[o + 3]!]);
    const wanted = DIE_FACES.find((f) => f.value === faceValue(input.values[i] ?? 1))!;
    // One fixed turn of the drawn die against its body: the wanted number lands on the face that came to rest up,
    // with a random quarter turn about it so the pips do not always sit the same way.
    const turn = qMul(
      qFromAxisAngle(rest.normal, rng.int(0, 3) * (Math.PI / 2)),
      qFromTo(wanted.normal, rest.normal),
    );
    const out = new Float32Array(run.steps * 4);
    for (let s = 0; s < run.steps; s++) {
      const q = qNormalize(
        qMul([body[s * 4]!, body[s * 4 + 1]!, body[s * 4 + 2]!, body[s * 4 + 3]!], turn),
      );
      out.set(q, s * 4);
    }
    return out;
  });
  return {
    dice: input.values.length,
    steps: run.steps,
    seconds: (run.steps - 1) * STEP,
    positions: run.positions,
    rotations,
  };
}

/** Where die `i` is `seconds` into the roll (it stays at rest once the recording ends). */
export function sampleDie(
  bake: DiceBake,
  i: number,
  seconds: number,
): { position: Vec3; rotation: Quat } {
  const pos = bake.positions[i]!,
    rot = bake.rotations[i]!;
  const f = Math.min(Math.max(seconds / STEP, 0), bake.steps - 1);
  const a = Math.floor(f),
    b = Math.min(a + 1, bake.steps - 1),
    u = f - a;
  const at = (k: number, o: number): number => pos[k * 3 + o]!;
  const q = (k: number): Quat => [rot[k * 4]!, rot[k * 4 + 1]!, rot[k * 4 + 2]!, rot[k * 4 + 3]!];
  return {
    position: [
      at(a, 0) + (at(b, 0) - at(a, 0)) * u,
      at(a, 1) + (at(b, 1) - at(a, 1)) * u,
      at(a, 2) + (at(b, 2) - at(a, 2)) * u,
    ],
    rotation: qSlerp(q(a), q(b), u),
  };
}
