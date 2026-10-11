// Original top-down city art. SVG remains visible in static renders and needs no graphics runtime.
import { useId } from 'react';
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { CityView, PropKind } from '../server/types';
import { CITY_HEIGHT, CITY_WIDTH, holeLabels, playerStyle } from './presentation';
import { STRINGS } from './strings';
import styles from './City.module.css';

export function PropArt({ kind }: { kind: PropKind }): JSX.Element {
  switch (kind) {
    case 'bin':
      return (
        <g className={styles.bin}>
          <rect x="-0.65" y="-0.8" width="1.3" height="1.6" rx="0.2" />
          <path d="M-.85-.7H.85M-.25-1H.25" />
          <path d="M-.2-.4V.5M.2-.4V.5" />
        </g>
      );
    case 'tree':
      return (
        <g className={styles.tree}>
          <path d="M0 .2V1.5" />
          <circle r="1.45" />
          <circle cx="-.45" cy="-.35" r=".6" className={styles.treeLight} />
        </g>
      );
    case 'bench':
      return (
        <g className={styles.bench}>
          <path d="M-1.7-.65V1.4M1.7-.65V1.4" />
          <rect x="-2.3" y="-1" width="4.6" height=".8" rx=".2" />
          <rect x="-2.3" y=".25" width="4.6" height=".7" rx=".2" />
        </g>
      );
    case 'car':
      return (
        <g className={styles.car}>
          <path className={styles.tyres} d="M-2.6-2.2V-1M2.6-2.2V-1M-2.6 1V2.2M2.6 1V2.2" />
          <rect x="-2.5" y="-3.7" width="5" height="7.4" rx="1.1" />
          <path
            className={styles.glass}
            d="M-1.8-1.7-1.4-2.7H1.4L1.8-1.7ZM-1.8 1.4H1.8L1.5 2.5H-1.5Z"
          />
          <path d="M-1.7-3.2H-1M1-3.2H1.7" className={styles.headlights} />
        </g>
      );
    case 'house':
      return (
        <g className={styles.house}>
          <rect x="-5.4" y="-4.5" width="10.8" height="9" rx=".6" />
          <path className={styles.roof} d="M-6-2.2 0-6.5 6-2.2 0 2Z" />
          <path className={styles.roofLine} d="M0-6.5V2M-6-2.2H6" />
          <rect x="2.4" y="2" width="1.5" height="2.5" className={styles.glass} />
          <rect x="-4" y="2.2" width="2.5" height="1.4" className={styles.window} />
        </g>
      );
    case 'tower':
      return (
        <g className={styles.tower}>
          <path className={styles.towerSide} d="M-6.5-6.5H6.5V7.5H-6.5Z" />
          <rect x="-6.5" y="-8" width="13" height="12" rx=".6" />
          <rect x="-4.7" y="-6.2" width="9.4" height="8.4" className={styles.roof} />
          <path className={styles.window} d="M-4 5V6.5M-1.4 5V6.5M1.4 5V6.5M4 5V6.5" />
          <rect x="-1.4" y="-4.3" width="2.8" height="2.8" className={styles.glass} />
          <path d="M3.5-4.5V-.5M2.5-3.5H4.5" className={styles.roofLine} />
        </g>
      );
  }
}

export function City({
  city,
  mine,
  compact = false,
  label,
}: {
  city: CityView;
  mine?: string;
  compact?: boolean;
  label?: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const titleId = useId();
  return (
    <svg
      className={styles.city}
      data-compact={compact || undefined}
      viewBox={`0 0 ${CITY_WIDTH} ${CITY_HEIGHT}`}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{label ?? L('City with numbered player holes')}</title>
      <rect className={styles.ground} width={CITY_WIDTH} height={CITY_HEIGHT} />
      <g className={styles.blocks}>
        {[0, 1, 2, 3].flatMap((col) =>
          [0, 1].map((row) => (
            <rect
              key={`${col}-${row}`}
              x={col * 45 + 3}
              y={row * 55 + 3}
              width="39"
              height="49"
              rx="3"
            />
          )),
        )}
      </g>
      <g className={styles.parks}>
        <rect x="9" y="10" width="12" height="13" rx="3" />
        <rect x="148" y="66" width="14" height="13" rx="3" />
        <rect x="59" y="67" width="12" height="13" rx="3" />
      </g>
      <g className={styles.roadLines}>
        {[45, 90, 135].map((x) => (
          <path key={x} d={`M${x} 3V107`} />
        ))}
        <path d="M3 55H177" />
      </g>
      <g className={styles.crossings}>
        {[45, 90, 135].flatMap((x) =>
          [-3, -1, 1, 3].map((dx) => (
            <path key={`${x}-${dx}`} d={`M${x + dx} 49V51M${x + dx} 59V61`} />
          )),
        )}
      </g>
      <g className={styles.props}>
        {city.props.map((p) => (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} data-kind={p.kind}>
            <PropArt kind={p.kind} />
          </g>
        ))}
      </g>
      {city.holes.map((h) => (
        <g
          key={h.id}
          className={styles.hole}
          transform={`translate(${h.x} ${h.y})`}
          style={{ ...playerStyle(h.slot), transform: `translate(${h.x}px, ${h.y}px)` }}
          data-me={mine === h.id || undefined}
          data-respawn={h.respawnIn > 0 || undefined}
          data-shield={h.shield || undefined}
        >
          <title>{L('Hole {n}, {score} points', { n: h.slot + 1, score: h.score })}</title>
          {h.shield && h.respawnIn === 0 ? (
            <circle className={styles.shield} r={h.radius + 1.5} />
          ) : null}
          <circle className={styles.rim} r={h.radius} />
          <circle className={styles.void} r={Math.max(0.5, h.radius - 0.65)} />
          <path
            className={styles.shine}
            d={`M${-h.radius * 0.65} ${-h.radius * 0.45}Q0 ${-h.radius * 1.05} ${h.radius * 0.65} ${-h.radius * 0.45}`}
          />
        </g>
      ))}
      {city.holes.map((h) => (
        <g key={`feedback-${h.id}`}>
          {h.lastGain > 0 && !compact ? (
            <text
              className={styles.gain}
              fontSize={6}
              x={h.x}
              y={Math.max(6, h.y - h.radius - 2.2)}
              textAnchor="middle"
            >
              +{h.lastGain}
            </text>
          ) : null}
          {h.respawnIn > 0 ? (
            <text
              className={styles.returning}
              fontSize={6}
              x={h.x}
              y={Math.min(CITY_HEIGHT - 3, h.y + h.radius + 5)}
              textAnchor="middle"
            >
              {Math.ceil(h.respawnIn / 1000)}s
            </text>
          ) : null}
        </g>
      ))}
      {holeLabels(city.holes).map(({ hole: h, x, y, callout }) => (
        <g
          key={`label-${h.id}`}
          className={styles.hole}
          transform={`translate(${x} ${y})`}
          style={{ ...playerStyle(h.slot), transform: `translate(${x}px, ${y}px)` }}
          data-respawn={h.respawnIn > 0 || undefined}
          data-shield={h.shield || undefined}
        >
          {callout ? <path className={styles.callout} d={`M${h.x - x} ${h.y - y}L0 0`} /> : null}
          {callout ? <circle className={styles.labelRing} r={3.3} /> : null}
          <text
            className={styles.number}
            fontSize={compact ? 6.4 : 6}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {h.slot + 1}
          </text>
          {mine === h.id ? <path className={styles.you} d="M-1.6-5.5H1.6L0-3.7Z" /> : null}
        </g>
      ))}
    </svg>
  );
}
