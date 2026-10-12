// Player-following software 3D scene, with original low-poly geometry and public state only.
import { useEffect, useId, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { CityView, HoleView } from '../server/types';
import { playerStyle } from './presentation';
import { cameraFor, inFrame, liveHole, MODEL_HEIGHT, objectFaces, polygon, project } from './scene';
import type { Camera, Vec3 } from './scene';
import styles from './City.module.css';
import { facingCamera } from './facing';

interface NamedPlayer {
  id: string;
  name: string;
}
function groundRect(x: number, y: number, w: number, h: number, camera: Camera): string {
  return polygon(
    [
      { x, y, z: 0 },
      { x: x + w, y, z: 0 },
      { x: x + w, y: y + h, z: 0 },
      { x, y: y + h, z: 0 },
    ].map((p) => project(p, camera)),
  );
}

function Building({
  kind,
  x,
  y,
  camera,
  tilt = 0,
  sink = 0,
}: {
  kind: keyof typeof MODEL_HEIGHT;
  x: number;
  y: number;
  camera: Camera;
  tilt?: number;
  sink?: number;
}): JSX.Element {
  return (
    <g
      data-kind={kind}
      data-mesh="3d"
      className={[styles.object, styles[kind]].filter(Boolean).join(' ')}
    >
      {objectFaces(kind, x, y, tilt, sink)
        .filter((face) => facingCamera(face, camera))
        .map((face, i) => (
          <polygon
            key={i}
            points={polygon(face.points.map((p) => project(p, camera)))}
            className={styles[face.material]}
          />
        ))}
    </g>
  );
}

function nameLabels(
  holes: HoleView[],
  camera: Camera,
  players: NamedPlayer[],
): {
  hole: HoleView;
  x: number;
  y: number;
  name: string;
}[] {
  const occupied: { x: number; y: number }[] = [];
  const ordered = [...holes].sort(
    (a, b) => Number(b.id === camera.target) - Number(a.id === camera.target) || a.slot - b.slot,
  );
  return ordered.flatMap((h) => {
    const p = project({ x: h.x, y: h.y, z: 0 }, camera);
    if (p.x < 64 || p.x > camera.width - 64 || p.y < 32 || p.y > camera.height - 26) return [];
    // Native names stay attached to the mouth. A coincident rival label yields to the camera owner.
    if (occupied.some((o) => Math.abs(p.x - o.x) < 190 && Math.abs(p.y - o.y) < 48)) return [];
    occupied.push(p);
    return [
      {
        hole: h,
        x: p.x,
        y: p.y,
        name: players.find((player) => player.id === h.id)?.name ?? `#${h.slot + 1}`,
      },
    ];
  });
}

function Mouth({ h, camera }: { h: HoleView; camera: Camera }): JSX.Element {
  const p = project({ x: h.x, y: h.y, z: 0 }, camera),
    r = h.radius * camera.scale;
  return (
    <g
      className={styles.hole}
      style={playerStyle(h.slot)}
      data-hole={h.id}
      data-me={h.id === camera.target || undefined}
    >
      <ellipse className={styles.shadow} cx={p.x + 3} cy={p.y + 3} rx={r + 3} ry={r * 0.72 + 3} />
      {h.shield ? (
        <ellipse className={styles.shield} cx={p.x} cy={p.y} rx={r + 5} ry={r * 0.72 + 4} />
      ) : null}
      <ellipse className={styles.rim} cx={p.x} cy={p.y} rx={r} ry={r * 0.72} />
      <ellipse
        className={styles.void}
        cx={p.x}
        cy={p.y}
        rx={Math.max(1, r - 5)}
        ry={Math.max(1, r * 0.72 - 4)}
      />
      <path
        className={styles.shine}
        d={`M${p.x - r * 0.67} ${p.y - r * 0.42}Q${p.x} ${p.y - r * 0.89} ${p.x + r * 0.67} ${p.y - r * 0.42}`}
      />
    </g>
  );
}

export function City({
  city,
  mine,
  compact = false,
  label,
  players = [],
  elapsed = 0,
}: {
  city: CityView;
  mine?: string;
  compact?: boolean;
  label?: string;
  players?: NamedPlayer[];
  elapsed?: number;
}): JSX.Element {
  const titleId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>();
  useEffect(() => {
    const box = frame.current;
    if (!box) return undefined;
    const measure = (): void => {
      const width = Math.round(box.clientWidth),
        height = Math.round(box.clientHeight);
      if (width > 0 && height > 0)
        setViewport((old) =>
          old?.width === width && old.height === height ? old : { width, height },
        );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const camera = cameraFor(city, mine, compact, viewport);
  const holes = city.holes.filter((h) => liveHole(h) && inFrame(h.x, h.y, h.radius, 0, camera));
  const objects = [
    ...city.props
      .filter((p) => inFrame(p.x, p.y, p.radius, MODEL_HEIGHT[p.kind], camera))
      .map((p) => ({ ...p, sinking: false, consumedAt: 0, by: '' })),
    ...(city.sinks ?? [])
      .filter(
        (p) =>
          elapsed >= p.consumedAt &&
          elapsed - p.consumedAt < 700 &&
          inFrame(p.x, p.y, p.radius, MODEL_HEIGHT[p.kind], camera),
      )
      .map((p) => ({ ...p, sinking: true })),
  ].sort((a, b) => a.y + a.x * 0.12 - (b.y + b.x * 0.12) || a.id - b.id);
  const ground = (p: Vec3) => project(p, camera);
  const drawables = [
    ...holes.map((h) => ({ depth: h.y + h.x * 0.12, key: `hole-${h.id}`, hole: h, prop: null })),
    ...objects.map((p) => ({
      depth: p.y + p.x * 0.12,
      key: `prop-${p.sinking ? 'sink' : ''}-${p.id}`,
      hole: null,
      prop: p,
    })),
  ].sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key));
  return (
    <div
      ref={frame}
      className={styles.frame}
      data-camera={camera.target ?? 'none'}
      data-compact={compact || undefined}
    >
      <svg
        className={styles.city}
        viewBox={`0 0 ${camera.width} ${camera.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{label ?? 'Hole.io local city camera'}</title>
        <rect className={styles.water} width={camera.width} height={camera.height} />
        <polygon className={styles.ground} points={groundRect(0, 0, 180, 110, camera)} />
        <g className={styles.blocks}>
          {[0, 1, 2, 3].flatMap((col) =>
            [0, 1].map((row) => (
              <polygon
                key={`${col}-${row}`}
                points={groundRect(col * 45 + 3, row * 55 + 3, 39, 49, camera)}
              />
            )),
          )}
        </g>
        <g className={styles.parks}>
          {[0, 1, 2, 3].flatMap((col) =>
            [0, 1].map((row) => (
              <polygon
                key={`${col}-${row}`}
                points={groundRect(col * 45 + 17, row * 55 + 8, 11, 13, camera)}
              />
            )),
          )}
        </g>
        <g className={styles.roadLines}>
          {[45, 90, 135].map((x) => {
            const a = ground({ x, y: 0, z: 0 }),
              b = ground({ x, y: 110, z: 0 });
            return <path key={x} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} />;
          })}
          {[55].map((y) => {
            const a = ground({ x: 0, y, z: 0 }),
              b = ground({ x: 180, y, z: 0 });
            return <path key={y} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} />;
          })}
        </g>
        <g className={styles.crossings}>
          {[45, 90, 135].flatMap((x) =>
            [-3, -1, 1, 3].map((dx) => (
              <polygon key={`${x}-${dx}`} points={groundRect(x + dx, 49, 0.7, 3, camera)} />
            )),
          )}
        </g>
        {drawables.map((item) => {
          if (item.hole) return <Mouth key={item.key} h={item.hole} camera={camera} />;
          const p = item.prop!;
          const progress = p.sinking ? Math.min(1, (elapsed - p.consumedAt) / 700) : 0;
          const eater = city.holes.find((h) => h.id === p.by);
          const x = p.x + (eater ? eater.x - p.x : 0) * progress * 0.65;
          const y = p.y + (eater ? eater.y - p.y : 0) * progress * 0.65;
          const location = ground({ x, y, z: 0 });
          return (
            <g key={item.key} data-prop={p.id} data-sinking={p.sinking || undefined}>
              {!p.sinking ? (
                <ellipse
                  className={styles.shadow}
                  cx={location.x + MODEL_HEIGHT[p.kind] * camera.scale * 0.22}
                  cy={location.y + camera.scale * 0.4}
                  rx={p.radius * camera.scale * 0.9}
                  ry={p.radius * camera.scale * 0.3}
                />
              ) : null}
              <Building
                kind={p.kind}
                x={x}
                y={y}
                camera={camera}
                tilt={progress * 0.78}
                sink={progress * (MODEL_HEIGHT[p.kind] + p.radius)}
              />
            </g>
          );
        })}
      </svg>
      {nameLabels(holes, camera, players).map(({ hole: h, x, y, name }) => (
        <div
          key={h.id}
          className={styles.nativeLabel}
          style={{
            ...playerStyle(h.slot),
            left: `${(x / camera.width) * 100}%`,
            top: `${(y / camera.height) * 100}%`,
          }}
          data-me={h.id === camera.target || undefined}
          title={`${h.slot + 1} · ${name}`}
        >
          <span className={styles.name}>
            {h.slot + 1} · {name}
          </span>
          {h.lastGain > 0 ? <span className={styles.gain}>+{h.lastGain}</span> : null}
        </div>
      ))}
    </div>
  );
}
