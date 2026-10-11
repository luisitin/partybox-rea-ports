import type { CSSProperties, JSX } from 'react';
import { usePrefersReducedMotion, useT } from '@partybox/game-sdk/ui';
import type { MatchView } from '../server/index';
import { DUCK_HEIGHT, RUNNER_HEIGHT, RUNNER_X, distanceAt, heightAt } from '../server/world';
import type { Obstacle, Runner } from '../server/world';
import { runnerMetres, slotStyle, standingsRows } from './display';
import styles from './Race.module.css';
import { STRINGS } from './strings';

/** Original comet-creature silhouette, never a source-game sprite. */
export function Comet({
  duck = false,
  out = false,
}: {
  duck?: boolean;
  out?: boolean;
}): JSX.Element {
  const height = duck ? DUCK_HEIGHT : RUNNER_HEIGHT;
  return (
    <g transform={`scale(1 ${height / RUNNER_HEIGHT})`}>
      <path className={styles.tail} d="M2 -34 L-31 -37 L-17 -23 L-38 -12 L3 -7 Z" />
      <path
        className={styles.creature}
        d="M0 -9 Q-7 -35 10 -40 Q26 -45 30 -25 L29 -5 L21 -5 L20 0 L13 0 L11 -7 Z"
      />
      {out ? (
        <path className={styles.faceLine} d="M15 -31 l7 7 m0 -7 l-7 7" />
      ) : (
        <circle className={styles.eye} cx="21" cy="-29" r="3" />
      )}
      <path className={styles.faceLine} d="M18 -16 Q22 -13 26 -17" />
    </g>
  );
}

export function RunnerIcon({ slot }: { slot: number }): JSX.Element {
  return (
    <svg className={styles.icon} viewBox="-40 -48 76 52" style={slotStyle(slot)} aria-hidden="true">
      <Comet />
    </svg>
  );
}

function Hazard({ obstacle }: { obstacle: Obstacle }): JSX.Element {
  const { width: w, height: h } = obstacle;
  return obstacle.kind === 'bird' ? (
    <g className={styles.bird}>
      <path
        d={`M0 ${-h / 2} L${w * 0.25} ${-h} L${w * 0.55} ${-h * 0.58} L${w * 0.8} ${-h * 0.9} L${w} ${-h * 0.4} L${w * 0.6} ${-h * 0.3} L${w * 0.2} 0 Z`}
      />
      <circle className={styles.eye} cx={w * 0.8} cy={-h * 0.48} r="2" />
    </g>
  ) : (
    <g className={styles.rock}>
      <path
        d={`M0 0 L${w * 0.1} ${-h * 0.58} L${w * 0.4} ${-h} L${w * 0.8} ${-h * 0.85} L${w} 0 Z`}
      />
      <path
        className={styles.rockLine}
        d={`M${w * 0.4} ${-h * 0.78} L${w * 0.3} ${-h * 0.3} L${w * 0.65} ${-h * 0.45}`}
      />
    </g>
  );
}

export interface RaceLaneProps {
  runner: Runner;
  obstacles: Obstacle[];
  t: number;
  slot: number;
  name: string;
  close?: boolean;
}

export function RaceLane({
  runner,
  obstacles,
  t,
  slot,
  name,
  close = false,
}: RaceLaneProps): JSX.Element {
  const L = useT(STRINGS);
  const reduced = usePrefersReducedMotion();
  const stopped = runner.died !== null;
  const at = stopped ? Math.min(t, runner.died ?? t) : t;
  const distance = distanceAt(at);
  const height = heightAt(runner, at);
  const duck = runner.duck && height === 0;
  const width = close ? 440 : 640;
  return (
    <svg
      className={styles.lane}
      style={slotStyle(slot)}
      viewBox={`0 0 ${width} 180`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        stopped
          ? L('{name}, crashed, {n} metres', { name, n: runnerMetres(runner, t) })
          : L('{name}, running, {n} metres', { name, n: runnerMetres(runner, t) })
      }
      data-runner={runner.id}
      data-out={stopped ? 'true' : undefined}
    >
      <path className={styles.ground} d={`M0 165 H${width}`} />
      {!reduced ? (
        <g className={styles.track} transform={`translate(${-distance % 80} 0)`}>
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${i * 80} 174 h20`} />
          ))}
        </g>
      ) : null}
      {obstacles.map((obstacle) => {
        const x = obstacle.x - distance;
        return x + obstacle.width >= 0 && x < width ? (
          <g key={obstacle.id} transform={`translate(${x} ${165 - obstacle.bottom})`}>
            <Hazard obstacle={obstacle} />
          </g>
        ) : null;
      })}
      <g transform={`translate(${RUNNER_X} ${165 - height})`}>
        <Comet duck={duck} out={stopped} />
        {stopped ? (
          <path className={styles.crash} d="M-5 -48 l-9 -9 m45 7 l9 -9 m-1 49 l10 2" />
        ) : null}
      </g>
    </svg>
  );
}

export function Race({
  view,
  t,
  meId,
  tv = false,
  results = false,
}: {
  view: MatchView & { players: { id: string; name: string }[] };
  t: number;
  meId?: string;
  tv?: boolean;
  results?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const ranked = standingsRows(view);
  const order = results
    ? ranked.map((row) => ({ runner: view.runners[row.slot]!, slot: row.slot, row }))
    : view.runners.map((runner, slot) => ({ runner, slot, row: ranked.find((r) => r.id === runner.id)! }));
  const columns = tv && view.runners.length > 4 ? 2 : 1;
  const rows = Math.ceil(view.runners.length / columns);
  return (
    <ul
      className={styles.race}
      aria-label={results ? L('Race lanes · Match standings') : L('Race lanes')}
      data-tv={tv ? 'true' : undefined}
      data-columns={columns}
      data-results={results ? 'true' : undefined}
      style={{ ['--pb-race-rows' as string]: rows } as CSSProperties}
    >
      {order.map(({ runner, slot, row }) => {
        const name = view.players.find((p) => p.id === runner.id)?.name ?? runner.id;
        return (
          <li
            key={runner.id}
            style={slotStyle(slot)}
            data-me={runner.id === meId ? 'true' : undefined}
            data-out={runner.died !== null ? 'true' : undefined}
          >
            <div className={styles.identity}>
              <b className={styles.number}>{slot + 1}</b>
              <span className={styles.name}>{results ? `${row.rank}${row.tied ? '=' : ''} · ` : ''}{name}</span>
            </div>
            <RaceLane runner={runner} obstacles={view.obstacles} t={t} slot={slot} name={name} />
            <div className={styles.distance}>
              <b>{results ? L('+{n} m', { n: row.gained }) : L('{n} m', { n: runnerMetres(runner, t) })}</b>
              <span>{results ? L('{n} m', { n: row.total }) : runner.died === null ? L('RUNNING') : L('OUT')}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
