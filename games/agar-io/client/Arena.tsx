// Received poses and a bounded native camera animation; there is no client physics.
import { Component, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import { radius } from '../server/geometry';
import type { ArenaView, MatchView } from '../server/index';
import {
  CameraMotionSession,
  PoseMotionSession,
  cameraFromTransform,
  cameraTransform,
  cellNameSize,
  foodPoints,
  ownedCameraPoses,
  playerCamera,
} from './camera';
import type { CameraSnapshot } from './camera';
import { playerStyle } from './display';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

export interface ArenaProps extends ArenaView {
  players: ViewPlayer[];
  slots: MatchView['slots'];
  checked: number;
  mine?: string;
  frozen?: boolean;
  phone?: boolean;
  compact?: boolean;
  follow?: boolean;
}

// Growth reorders keyed SVG groups for correct occlusion. Read their public visual
// geometry before that DOM mutation, which otherwise destroys CSS before-styles.
class PoseCaptureBoundary extends Component<{
  receipt: string;
  capture(): void;
  children: ReactNode;
}> {
  override getSnapshotBeforeUpdate(previous: Readonly<{ receipt: string }>): null {
    if (previous.receipt !== this.props.receipt) this.props.capture();
    return null;
  }
  override componentDidUpdate(): void {
    // The parent layout effect consumes the precommit snapshot before paint.
  }
  override render(): ReactNode {
    return this.props.children;
  }
}

export function Arena({
  cells,
  pellets,
  players,
  slots,
  checked,
  mine,
  frozen,
  phone,
  compact,
  follow,
}: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const arena = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const [viewport, setViewport] = useState({ width: 362, height: 420 });
  const [motion] = useState(() => new CameraMotionSession());
  const [poseMotion] = useState(() => new PoseMotionSession());
  const captured = useRef<CameraSnapshot | null>(null);
  const [motionDisabled, setMotionDisabled] = useState(false);
  const clipId = useId();
  const gridId = useId();
  useLayoutEffect(() => {
    const element = arena.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      setViewport((current) =>
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const camera = follow ? playerCamera(cells, mine, viewport) : null;
  const readSnapshot = (): CameraSnapshot | null => {
    const element = world.current;
    if (!element) return null;
    const poses = [...element.querySelectorAll<SVGGElement>('[data-cell-id]')].flatMap((group) => {
      const body = group.querySelector<SVGCircleElement>('[data-cell-body]');
      const logical = group.querySelector<SVGCircleElement>('[data-cell-logical-radius]');
      const label = group.querySelector<SVGTextElement>('[data-name-inside]');
      if (!body || !logical) return [];
      const matrix = new DOMMatrixReadOnly(getComputedStyle(group).transform);
      const currentRadius = Number.parseFloat(getComputedStyle(logical).getPropertyValue('r'));
      const outlineRadius = Number.parseFloat(getComputedStyle(body).getPropertyValue('r'));
      const fontSize = label ? Number.parseFloat(getComputedStyle(label).fontSize) : undefined;
      if (
        ![matrix.e, matrix.f, currentRadius, outlineRadius].every(Number.isFinite) ||
        currentRadius <= 0
      )
        return [];
      return [
        {
          id: Number(group.dataset.cellId),
          x: matrix.e,
          y: matrix.f,
          radius: currentRadius,
          outlineRadius,
          fontSize,
        },
      ];
    });
    return { camera: cameraFromTransform(getComputedStyle(element).transform, viewport), poses };
  };
  // React keeps this base style stable. The layout effect owns subsequent transforms,
  // so receipt sampling reads the visible animation rather than a newly committed target.
  const [initialTransform] = useState(() => (camera ? cameraTransform(camera) : ''));
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const synchronize = (): void =>
      setMotionDisabled(preference.matches || document.documentElement.dataset.motion === 'off');
    synchronize();
    preference.addEventListener('change', synchronize);
    const observer = new MutationObserver(synchronize);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-motion'],
    });
    return () => {
      preference.removeEventListener('change', synchronize);
      observer.disconnect();
      motion.cancel();
      poseMotion.cancel();
    };
  }, [motion, poseMotion]);
  useLayoutEffect(() => {
    const element = world.current;
    if (!element) return;
    const poses = ownedCameraPoses(cells, mine);
    const context = `${follow ? 'follow' : 'overview'}:${mine ?? ''}:${viewport.width}:${viewport.height}`;
    const snapshot = captured.current;
    const mineIds = new Set(poses.map((pose) => pose.id));
    const disabled =
      motionDisabled ||
      frozen ||
      typeof element.animate !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'off';
    motion.update(
      {
        readCamera: (target) => cameraFromTransform(getComputedStyle(element).transform, target),
        readPoses: (targets) =>
          targets.flatMap((pose) => {
            const group = element.querySelector<SVGGElement>(`[data-cell-id="${pose.id}"]`);
            const body = group?.querySelector<SVGCircleElement>('[data-cell-logical-radius]');
            if (!group || !body) return [];
            const matrix = new DOMMatrixReadOnly(getComputedStyle(group).transform);
            const currentRadius = Number.parseFloat(getComputedStyle(body).getPropertyValue('r'));
            if (![matrix.e, matrix.f, currentRadius].every(Number.isFinite) || currentRadius <= 0)
              return [];
            return [{ id: pose.id, x: matrix.e, y: matrix.f, radius: currentRadius }];
          }),
        setTransform: (transform) => {
          element.style.transform = transform;
        },
        animate: (frames, options) => element.animate(frames, options),
      },
      context,
      camera,
      poses,
      Boolean(disabled),
      snapshot
        ? { camera: snapshot.camera, poses: snapshot.poses.filter((pose) => mineIds.has(pose.id)) }
        : null,
    );
    poseMotion.update(
      {
        animatePose: (id, from, to, options) => {
          const group = element.querySelector<SVGGElement>(`[data-cell-id="${id}"]`);
          return (
            group?.animate(
              [
                { transform: `translate(${from.x}px, ${from.y}px)` },
                { transform: `translate(${to.x}px, ${to.y}px)` },
              ],
              options,
            ) ?? { cancel() {} }
          );
        },
        animateRadius: (id, from, to, options) => {
          const logical = element.querySelector<SVGCircleElement>(
            `[data-cell-id="${id}"] [data-cell-logical-radius]`,
          );
          return (
            logical?.animate([{ r: `${from.radius}px` }, { r: `${to.radius}px` }], options) ?? {
              cancel() {},
            }
          );
        },
        animateOutlineRadius: (id, frames, options) => {
          const circles = element.querySelectorAll<SVGCircleElement>(
            `[data-cell-id="${id}"] [data-cell-body], [data-cell-id="${id}"] [data-cell-shield]`,
          );
          const animations = [...circles].map((circle) => {
            const extra = circle.hasAttribute('data-cell-shield') ? 0.9 : 0;
            return circle.animate(
              frames.map(({ offset, r }) => ({ offset, r: `${Number.parseFloat(r) + extra}px` })),
              options,
            );
          });
          return {
            cancel: () => {
              for (const animation of animations) animation.cancel();
            },
          };
        },
        animateNameFont: (id, frames, options) => {
          const label = element.querySelector<SVGTextElement>(
            `[data-cell-id="${id}"] [data-name-inside]`,
          );
          return label?.animate(frames, options) ?? { cancel() {} };
        },
      },
      context,
      snapshot?.poses ?? [],
      cells.map((cell) => ({ id: cell.id, x: cell.x, y: cell.y, radius: radius(cell.mass) })),
      Boolean(disabled),
    );
    captured.current = null;
  }, [camera, cells, follow, frozen, mine, motion, motionDisabled, poseMotion, viewport]);
  const names = Object.fromEntries(players.map((player) => [player.id, player.name]));
  const orderedCells = [...cells].sort((a, b) => radius(a.mass) - radius(b.mass) || a.id - b.id);
  const pose = (cell: { owner: string; x: number; y: number }): CSSProperties => ({
    ...playerStyle(slots[cell.owner] ?? 0),
    transform: `translate(${cell.x}px, ${cell.y}px)`,
  });
  const title = (cell: { owner: string; mass: number }): string =>
    `${L('{name}, blob {slot}, {mass} mass', {
      name: names[cell.owner] ?? '',
      slot: (slots[cell.owner] ?? 0) + 1,
      mass: Math.floor(cell.mass),
    })}${cell.owner === mine ? ` · ${L('Your blob')}` : ''}`;
  return (
    <PoseCaptureBoundary
      receipt={`${cells.map((cell) => `${cell.id}:${cell.x}:${cell.y}:${cell.mass}`).join('|')}:${follow}:${mine}:${viewport.width}:${viewport.height}:${frozen}:${motionDisabled}`}
      capture={() => {
        captured.current = readSnapshot();
      }}
    >
      <svg
        ref={arena}
        className={styles.arena}
        viewBox={camera ? `0 0 ${viewport.width} ${viewport.height}` : '0 0 160 100'}
        preserveAspectRatio={camera ? 'xMidYMid slice' : 'xMidYMid meet'}
        role="img"
        aria-label={L('Shared arena: {n} blobs and {m} snacks', {
          n: cells.length,
          m: pellets.length,
        })}
        data-arena="true"
        data-camera={camera ? 'personal' : 'overview'}
        data-camera-clipping={camera ? 'intentional player viewport' : undefined}
        data-camera-center={camera ? `${camera.x} ${camera.y}` : undefined}
        data-camera-zoom={camera?.zoom}
        data-frozen={frozen ? 'true' : undefined}
        data-phone={phone ? 'true' : undefined}
        data-compact={compact ? 'true' : undefined}
      >
        <defs>
          {!camera ? (
            <clipPath id={clipId}>
              <rect width="160" height="100" />
            </clipPath>
          ) : null}
          <pattern id={gridId} width="2.75" height="2.75" patternUnits="userSpaceOnUse">
            <path className={styles.grid} d="M2.75 0H0V2.75" />
          </pattern>
        </defs>
        <g
          ref={world}
          className={styles.world}
          style={{ transform: initialTransform }}
          data-world-layer="true"
          data-intentional-clipping={camera ? 'player-camera' : undefined}
        >
          <rect
            className={camera ? styles.background : styles.worldBounds}
            data-world-background={camera ? 'viewport' : 'map'}
            x={camera ? -160 : 0}
            y={camera ? -100 : 0}
            width={camera ? 480 : 160}
            height={camera ? 300 : 100}
          />
          <g clipPath={camera ? undefined : `url(#${clipId})`}>
            <rect
              data-grid-background="true"
              x={camera ? -160 : 0}
              y={camera ? -100 : 0}
              width={camera ? 480 : 160}
              height={camera ? 300 : 100}
              fill={`url(#${gridId})`}
            />
            {pellets.map((pellet) => (
              <polygon
                key={pellet.id}
                className={styles.snack}
                data-snack-id={pellet.id}
                points={foodPoints(
                  pellet.x,
                  pellet.y,
                  camera?.zoom ?? Math.min(viewport.width / 160, viewport.height / 100),
                )}
                style={playerStyle(pellet.id % 8)}
              />
            ))}
            {orderedCells.map((cell) => {
              const cellRadius = radius(cell.mass);
              const name = names[cell.owner] ?? '';
              return (
                <g
                  key={cell.id}
                  data-cell-id={cell.id}
                  data-pose-cell={cell.id}
                  data-pose-layer="cell"
                  className={`${styles.cell} ${styles.pose}`}
                  style={pose(cell)}
                  data-mine={cell.owner === mine ? 'true' : undefined}
                >
                  <title>{title(cell)}</title>
                  {cell.shieldUntil > checked ? (
                    <circle
                      className={styles.shield}
                      data-cell-shield="true"
                      r={cellRadius + 0.9}
                      style={{ ['r' as string]: `${cellRadius + 0.9}px` }}
                    />
                  ) : null}
                  <circle
                    className={styles.logicalRadius}
                    data-cell-logical-radius="true"
                    aria-hidden="true"
                    r={cellRadius}
                    style={{ ['r' as string]: `${cellRadius}px` }}
                  />
                  <circle
                    className={styles.body}
                    data-cell-body="true"
                    r={cellRadius}
                    style={{ ['r' as string]: `${cellRadius}px` }}
                  />
                  {/* Each name travels with its body, allowing larger foreground cells to occlude both. */}
                  <text
                    className={styles.name}
                    data-name-owner={cell.owner}
                    data-cell-label-id={cell.id}
                    data-name-inside="true"
                    fontSize={cellNameSize(cellRadius)}
                    x="0"
                    y="0"
                  >
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </PoseCaptureBoundary>
  );
}
