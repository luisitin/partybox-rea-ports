// Presentation geometry authored from public contact positions, not original client code.
// Call once per receipt/native keyframe; this module never advances the game or owns a clock.
export const OUTLINE_VERTEX_COUNT = 48;
export const OUTLINE_MAX_CONTACTS = 12;
export const OUTLINE_MAX_FRAMES = 121;
export const OUTLINE_DURATION_MS = 2000;

export interface OutlinePose {
  id: number;
  x: number;
  y: number;
  /** The already planned painted envelope, separate from the logical camera radius. */
  radius: number;
}
export interface OutlineContact {
  kind: 'cell' | 'food';
  id: number;
  x: number;
  y: number;
  radius: number;
}
export interface OutlineSample extends OutlinePose {
  offset: number;
}
export interface OutlineFrame {
  offset: number;
  d: string;
}

const TURN = Math.PI * 2;
// Five original-world units become .275 of this port's world units. The independent
// soft notch is capped at .65 units: about five pixels in the matched growth scene.
const CONTACT_REACH = 0.275;
const MAX_NOTCH = 0.65;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const angleGap = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const finitePose = (pose: OutlinePose): boolean =>
  [pose.id, pose.x, pose.y, pose.radius].every(Number.isFinite) && pose.radius > 0;

function contactsFor(pose: OutlinePose, contacts: readonly OutlineContact[]) {
  return contacts
    .filter(
      (contact) =>
        !(contact.kind === 'cell' && contact.id === pose.id) &&
        [contact.id, contact.x, contact.y, contact.radius].every(Number.isFinite) &&
        contact.radius > 0,
    )
    .map((contact) => {
      const dx = contact.x - pose.x;
      const dy = contact.y - pose.y;
      const distance = Math.hypot(dx, dy);
      return {
        contact,
        distance,
        direction: Math.atan2(dy, dx),
        // Circumferences may cross away from their centerline, including sibling contacts.
        separation: Math.max(
          0,
          distance - pose.radius - contact.radius,
          Math.abs(pose.radius - contact.radius) - distance,
        ),
      };
    })
    .filter((contact) => contact.separation <= CONTACT_REACH)
    .sort(
      (a, b) =>
        a.separation - b.separation ||
        a.contact.kind.localeCompare(b.contact.kind) ||
        a.contact.id - b.contact.id,
    )
    .slice(0, OUTLINE_MAX_CONTACTS);
}

/** Fixed topology lets native SVG path interpolation preserve every painted vertex. */
export function outlineVertices(
  pose: OutlinePose,
  contacts: readonly OutlineContact[],
  checked: number,
  presentationMs = 0,
): readonly { x: number; y: number }[] {
  if (!finitePose(pose) || !Number.isFinite(checked) || !Number.isFinite(presentationMs))
    throw new Error('An outline needs a finite public pose and presentation time');
  const nearby = contactsFor(pose, contacts);
  const phase = pose.id * 2.399963229728653;
  const time = (checked + presentationMs) / 1000;
  const wobble = Math.min(0.045, pose.radius * 0.02);
  const depth = Math.min(MAX_NOTCH, pose.radius * 0.12);
  return Array.from({ length: OUTLINE_VERTEX_COUNT }, (_, index) => {
    const angle = (index * TURN) / OUTLINE_VERTEX_COUNT;
    const noise =
      wobble *
      ((2 / 3) * Math.sin(3 * angle + phase + time * 0.9) +
        (1 / 3) * Math.sin(5 * angle - phase - time * 0.63));
    let notch = 0;
    for (const { contact, distance, direction } of nearby) {
      const reach = contact.radius + CONTACT_REACH;
      // Exterior grazing is shallow; a boundary passing through a contact gets the full notch.
      const overlap = clamp01((pose.radius + reach - distance) / reach);
      const cosine =
        (pose.radius ** 2 + distance ** 2 - contact.radius ** 2) /
        (2 * pose.radius * Math.max(distance, 0.001));
      const halfSpan = Math.acos(Math.max(-1, Math.min(1, cosine)));
      const gap =
        distance < 0.001
          ? 0
          : Math.min(
              Math.abs(angleGap(angle, direction - halfSpan)),
              Math.abs(angleGap(angle, direction + halfSpan)),
            );
      // Two intersection shoulders receive local notches; a rival's entire interior does not.
      const spread = Math.max(0.1, Math.atan2(CONTACT_REACH, pose.radius) * 1.5 + 0.065);
      const candidate = depth * overlap * Math.exp(-(gap * gap) / (2 * spread * spread));
      // Multiple adjacent contacts soften one outline rather than stacking damage to its size.
      notch = Math.max(notch, candidate);
    }
    const radius = pose.radius + noise - notch;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

const coordinate = (n: number): string => {
  const rounded = Number(n.toFixed(5));
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

export function outlinePath(
  pose: OutlinePose,
  contacts: readonly OutlineContact[],
  checked: number,
  presentationMs = 0,
): string {
  return `${outlineVertices(pose, contacts, checked, presentationMs)
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'}${coordinate(point.x)} ${coordinate(point.y)}`,
    )
    .join(' ')} Z`;
}

/** Maps an existing painted-pose plan to a bounded native path plan, without duplicating it. */
export function outlineFrames(
  samples: readonly OutlineSample[],
  contacts: readonly OutlineContact[],
  checked: number,
  duration = OUTLINE_DURATION_MS,
): OutlineFrame[] {
  if (
    samples.length > OUTLINE_MAX_FRAMES ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > OUTLINE_DURATION_MS
  )
    throw new Error('Outline animation exceeds its bounded presentation budget');
  let previous = -1;
  return samples.map((sample) => {
    if (
      !Number.isFinite(sample.offset) ||
      sample.offset < 0 ||
      sample.offset > 1 ||
      sample.offset < previous
    )
      throw new Error('Outline samples need ordered native offsets');
    previous = sample.offset;
    return {
      offset: sample.offset,
      d: outlinePath(sample, contacts, checked, sample.offset * duration),
    };
  });
}
