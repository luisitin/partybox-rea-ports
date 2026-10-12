// Original public maze artwork. SVG paints the server snapshot; numbered HTML labels keep their real device font size.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Arena as ArenaState } from '../server/world';
import { playerColor, weaponName } from './timing';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

interface ArenaProps {
  arena: ArenaState;
  players: readonly { id: string; name: string }[];
  me?: string;
}

export function Arena({ arena, players, me }: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const names = new Map(players.map((player) => [player.id, player.name]));
  const alive = arena.tanks.filter((tank) => tank.alive).length;
  const label = L('Maze arena: {n} of {m} tanks still in', { n: alive, m: arena.tanks.length });
  return (
    <div className={styles.scene}>
      <svg className={styles.svg} viewBox="0 0 160 96" role="img" aria-label={label}>
        <title>{label}</title>
        <rect x="0" y="0" width="160" height="96" className={styles.floor} />
        <path
          d="M0 16H160M0 32H160M0 48H160M0 64H160M0 80H160M16 0V96M32 0V96M48 0V96M64 0V96M80 0V96M96 0V96M112 0V96M128 0V96M144 0V96"
          className={styles.grid}
        />
        <g className={styles.walls}>
          {arena.maze.walls.map((wall, index) => (
            <line key={index} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} />
          ))}
        </g>
        {arena.pickups.map((pickup) => (
          <g
            key={pickup.id}
            transform={`translate(${pickup.x} ${pickup.y})`}
            className={styles.pickup}
          >
            <title>{weaponName(pickup.kind, L)}</title>
            <path d="M0-4 4 0 0 4-4 0Z" className={styles.crate} />
            {pickup.kind === 'scatter' ? (
              <path d="M-2 0H2M-1.5-1.5 1.5 1.5M-1.5 1.5 1.5-1.5" className={styles.mark} />
            ) : pickup.kind === 'beam' ? (
              <path d="M-2 1 0-1H2M0-1 0 1" className={styles.mark} />
            ) : (
              <path d="M-2 1Q-2-2 1-1M0-2 2-1 0 0" className={styles.mark} />
            )}
          </g>
        ))}
        {arena.bullets.map((bullet) => {
          const angle = (Math.atan2(bullet.vy, bullet.vx) * 180) / Math.PI;
          const owner = arena.tanks.find((tank) => tank.id === bullet.owner);
          return (
            <g
              key={bullet.id}
              transform={`translate(${bullet.x} ${bullet.y}) rotate(${angle})`}
              className={styles.projectile}
              style={{ color: playerColor(owner?.slot ?? 0) }}
            >
              <title>
                {bullet.owner === me ? L('Your shell can hit you') : weaponName(bullet.kind, L)}
              </title>
              {bullet.kind === 'beam' ? (
                <path d="M-3 0H1" className={styles.beam} />
              ) : bullet.kind === 'guided' ? (
                <path d="M-1.6-0.8 1.5 0-1.6 0.8Z" className={styles.shell} />
              ) : (
                <circle r="0.85" className={styles.shell} />
              )}
            </g>
          );
        })}
        {arena.tanks.map((tank) => (
          <g
            key={tank.id}
            transform={`translate(${tank.x} ${tank.y}) rotate(${(tank.angle * 180) / Math.PI})`}
            className={styles.tank}
            data-out={!tank.alive || undefined}
            style={{ color: playerColor(tank.slot) }}
          >
            <title>
              {L('Tank {n}: {name}', { n: tank.slot + 1, name: names.get(tank.id) ?? L('Player') })}
            </title>
            {tank.id === me && tank.alive ? <circle r="5.2" className={styles.mine} /> : null}
            <rect x="-3.7" y="-3.4" width="7.4" height="1.2" rx="0.3" className={styles.track} />
            <rect x="-3.7" y="2.2" width="7.4" height="1.2" rx="0.3" className={styles.track} />
            <rect x="-3.1" y="-2.4" width="6.2" height="4.8" rx="1.1" className={styles.chassis} />
            {tank.alive ? (
              <>
                <rect x="1" y="-0.55" width="5.1" height="1.1" rx="0.3" className={styles.barrel} />
                <path d="M7.5 0 5.8-1.2V1.2Z" className={styles.heading} />
              </>
            ) : (
              <path d="M-3-3 3 3M3-3-3 3" className={styles.wreck} />
            )}
          </g>
        ))}
      </svg>
      {arena.tanks.map((tank) => (
        <span
          key={tank.id}
          className={styles.number}
          data-out={!tank.alive || undefined}
          data-me={tank.id === me || undefined}
          aria-hidden="true"
          style={
            {
              left: `clamp(calc(var(--pb-font-body) * 0.7), ${(tank.x / 160) * 100}%, calc(100% - var(--pb-font-body) * 0.7))`,
              top: `clamp(calc(var(--pb-font-body) * 0.7), ${(tank.y / 96) * 100}%, calc(100% - var(--pb-font-body) * 0.7))`,
              ['--tank-color' as string]: playerColor(tank.slot),
            } as CSSProperties
          }
        >
          {tank.slot + 1}
        </span>
      ))}
    </div>
  );
}
