// Vector geometry survives static rendering and requires no canvas, assets or animation loop.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Runner, World } from '../server/types';
import { gateColour } from '../server/world';
import { colourOf, gateMovement } from './presentation';
import { STRINGS } from './strings';
import styles from './StageLane.module.css';

interface Props {
  runner: Runner;
  world: World;
  elapsed: number;
  name: string;
}

export function Shape({
  colour,
  x,
  y,
  size = 16,
}: {
  colour: number;
  x: number;
  y: number;
  size?: number;
}): JSX.Element {
  const fill = `var(${colourOf(colour).token})`;
  const common = { fill, stroke: 'var(--pb-bg)', strokeWidth: 2 };
  switch (((colour % 4) + 4) % 4) {
    case 0:
      return (
        <path
          d={`M ${x} ${y - size} L ${x + size} ${y + size} L ${x - size} ${y + size} Z`}
          {...common}
        />
      );
    case 1:
      return <circle cx={x} cy={y} r={size} {...common} />;
    case 2:
      return (
        <path
          d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`}
          {...common}
        />
      );
    default:
      return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} {...common} />;
  }
}

export function StageLane({ runner, world, elapsed, name }: Props): JSX.Element {
  const L = useT(STRINGS);
  const baseline = Math.max(0, runner.floor - 12);
  const yAt = (height: number): number => 440 - (height - baseline) * 1.65;
  const colour = colourOf(runner.colour);
  const retrying = runner.respawnAt !== null;
  const current = world.gates[runner.gates];
  const active = current ? colourOf(gateColour(current, elapsed)) : null;
  return (
    <svg
      className={styles.lane}
      viewBox="0 0 180 480"
      role="img"
      aria-label={`${L('{name}: {colour} {shape}, {n} gates cleared. Next gate: {gate}.', {
        name,
        colour: L(colour.name),
        shape: L(colour.shape),
        n: runner.gates,
        gate: active ? `${L(active.name)} ${L(active.shape)}` : L('Course complete'),
      })}${retrying ? ` ${L('Retry: checkpoint kept.')}` : ''}`}
    >
      <rect width="180" height="480" rx="12" fill="var(--pb-surface)" />
      <path d="M90 18 V440" className={styles.path} />
      {world.gates.slice(runner.gates, runner.gates + 2).map((gate, index) => {
        const y = yAt(gate.height);
        if (y < -30 || y > 480) return null;
        const cycle = gate.offset + (gate.direction * elapsed) / gate.beatMs;
        const centre = gateColour(gate, elapsed);
        const fraction = cycle - Math.floor(cycle);
        return (
          <g key={gate.height}>
            {[-3, -2, -1, 0, 1, 2, 3].map((segment) => {
              const segmentColour = (((centre + segment) % 4) + 4) % 4;
              const x = 90 + (segment - fraction) * 36;
              return (
                <g key={segment}>
                  <rect
                    x={x}
                    y={y - 18}
                    width="36"
                    height="36"
                    fill={`var(${colourOf(segmentColour).token})`}
                  />
                  <Shape colour={segmentColour} x={x + 18} y={y} size={14} />
                </g>
              );
            })}
            <path
              d={`M 74 ${y - 20} V ${y - 30} H 106 V ${y - 20} M 74 ${y + 20} V ${y + 30} H 106 V ${y + 20}`}
              className={styles.target}
            />
            <circle
              cx="90"
              cy={y - 65}
              r="22"
              fill="var(--pb-surface-2)"
              stroke="var(--pb-text-muted)"
              strokeWidth="2"
            />
            <Shape colour={gate.colourAfter} x={90} y={y - 65} size={12} />
            <path d={`M90 ${y - 42} v8 m-5 -4 l5 4 l5 -4`} className={styles.target} />
            {index === 0 ? (
              <path
                d={
                  gateMovement(gate.direction) === 'right'
                    ? `M144 ${y - 36} h20 l-7 -7 m7 7 l-7 7`
                    : `M164 ${y - 36} h-20 l7 -7 m-7 7 l7 7`
                }
                className={styles.target}
              />
            ) : null}
          </g>
        );
      })}
      <path d={`M 16 ${yAt(runner.floor) + 22} H 164`} className={styles.floor} />
      <Shape colour={runner.colour} x={90} y={yAt(runner.y)} size={18} />
      {retrying ? (
        <g>
          <circle cx="90" cy="345" r="30" fill="var(--pb-bg)" />
          <path d="M78 333 L102 357 M102 333 L78 357" className={styles.target} />
        </g>
      ) : null}
    </svg>
  );
}
