// A real SVG snapshot on both surfaces, including SSR; no animation loop or client physics.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { World } from '../server/types';
import { MIN_MASS } from '../server/types';
import { STRINGS } from './strings';
import { playerStyle } from './timing';
import styles from './Arena.module.css';

interface ArenaProps {
  world: World;
  names: ReadonlyMap<string, string>;
  me?: string;
}

export function Arena({ world, names, me }: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  return (
    <svg
      className={styles.arena}
      viewBox="0 0 160 100"
      role="img"
      aria-label={L('Snake arena. Eat sparks; avoid walls and other snakes.')}
    >
      <rect className={styles.floor} x="0" y="0" width="160" height="100" rx="2" />
      <path className={styles.grid} d="M40 0V100M80 0V100M120 0V100M0 25H160M0 50H160M0 75H160" />
      {world.food.map((food, index) =>
        food.value > 1 ? (
          <path
            key={index}
            className={styles.corpseFood}
            d={`M${food.x} ${food.y - 1.1}l1.1 1.1-1.1 1.1-1.1-1.1Z`}
          />
        ) : (
          <circle key={index} className={styles.food} cx={food.x} cy={food.y} r="0.55" />
        ),
      )}
      {world.snakes.map((snake, slot) => {
        const head = snake.body[0];
        if (!head || snake.respawnAt !== null) return null;
        const protectedNow = snake.safeUntil > world.elapsed;
        return (
          <g key={snake.id} style={playerStyle(slot)} data-me={snake.id === me || undefined}>
            <title>
              {L('{name}, snake {n}', { name: names.get(snake.id) ?? '', n: slot + 1 })}
            </title>
            <polyline
              className={styles.body}
              points={snake.body.map(([x, y]) => `${x},${y}`).join(' ')}
            />
            {slot > 0 ? (
              <polyline
                className={styles.marks}
                points={snake.body.map(([x, y]) => `${x},${y}`).join(' ')}
                strokeDasharray={`${0.5 + slot * 0.1} ${2 + slot * 0.4}`}
              />
            ) : null}
            {protectedNow ? (
              <circle className={styles.shield} cx={head[0]} cy={head[1]} r="3.4" />
            ) : null}
            <g
              transform={`translate(${head[0]} ${head[1]}) rotate(${(snake.angle * 180) / Math.PI})`}
            >
              {snake.boost && snake.mass > MIN_MASS ? (
                <path className={styles.boost} d="M-3-1.3L-5 0-3 1.3" />
              ) : null}
              <circle className={styles.head} r="1.8" />
              <circle className={styles.eye} cx="0.8" cy="-0.7" r="0.35" />
              <circle className={styles.eye} cx="0.8" cy="0.7" r="0.35" />
            </g>
            <text
              className={styles.number}
              x={Math.max(3, Math.min(157, head[0]))}
              y={Math.max(5, head[1] - 4)}
            >
              {slot + 1}
            </text>
          </g>
        );
      })}
      <rect className={styles.wall} x="0.3" y="0.3" width="159.4" height="99.4" rx="2" />
    </svg>
  );
}
