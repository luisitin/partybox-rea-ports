// The authoritative direction survives reconnects. Phones without the TV carry the public map.
import { useEffect, useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Screen, buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { PaperTerritoryControllerView } from '../server/index';
import type { Input } from '../server/types';
import { clockText } from './controls';
import { DirectionPad } from './DirectionPad';
import { Map } from './Map';
import { areaPercent, playerInk } from './mapMath';
import { standings } from './standings';
import { SeatBadge } from './SeatBadge';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<PaperTerritoryControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const previous = useRef({ captures: view.captures, deaths: view.deaths });
  useEffect(() => {
    if (view.phaseId === 'play') {
      if (view.captures > previous.current.captures) {
        play('correct');
        buzz([20, 30, 20]);
      }
      if (view.deaths > previous.current.deaths) {
        play('thud');
        buzz(120);
      }
    }
    previous.current = { captures: view.captures, deaths: view.deaths };
  }, [view.phaseId, view.captures, view.deaths, play]);
  const phoneOnly = usePhoneOnly();
  const player = view.me.role === 'player';
  const stage = phoneOnly || view.owners !== undefined || !player;
  const now = useServerNow(200, view.paused, view.clockHeldAt);
  const left = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const seconds = Math.ceil(left / 1000);
  const over = view.phaseId === 'score' || view.phaseId === 'done';
  const mine = view.runners.find((runner) => runner.id === view.me.id);
  const exposed = !!mine && mine.trail.length > 0;
  const returning =
    view.respawnAt === null ? null : Math.max(0, Math.ceil((view.respawnAt - now) / 1000));
  const rows = standings(view, true);
  const leaders = rows.filter((row) => row.rank === 1);
  const myRow = rows.find((row) => row.id === view.me.id);
  const leadArea = leaders[0]?.area ?? 0;
  const nextArea = rows.find((row) => row.rank > 1)?.area ?? leadArea;
  const standing =
    myRow?.rank === 1
      ? leaders.length > 1
        ? L('Tied for lead · {n}', { n: leaders.length })
        : L('Leading · {n} ahead', { n: leadArea - nextArea })
      : leaders.length > 1
        ? L('{n} tied leaders · {m} off', {
            n: leaders.length,
            m: Math.max(0, leadArea - (myRow?.area ?? 0)),
          })
        : L('#{n} leads · {m} off', {
            n: (leaders[0]?.slot ?? 0) + 1,
            m: Math.max(0, leadArea - (myRow?.area ?? 0)),
          });
  const title = over
    ? leaders.length === 1
      ? L('{name} takes the map!', { name: leaders[0]?.name ?? '' })
      : L('A tie at the top!')
    : view.phaseId === 'ready'
      ? player
        ? L('Find your number')
        : L('The race starts soon')
      : !player
        ? L('Watch the land grow')
        : !view.alive
          ? L('Back home soon')
          : exposed
            ? L('Close your loop')
            : L('Make some territory');
  const cause =
    view.cause === 'wall'
      ? L('Wall hit')
      : view.cause === 'trail'
        ? L('Own trail crossed')
        : view.cause === 'head'
          ? L('Head collision')
          : view.cause === 'cut'
            ? L('Trail cut')
            : view.cause === 'connection'
              ? L('Rejoining')
              : L('Returning');
  const status = view.paused
    ? L('Paused — your trail is safe for now')
    : !view.alive
      ? returning === null
        ? `${cause} · ${L('waiting to return home')}`
        : returning === 0
          ? `${cause} · ${L('waiting for home to clear')}`
          : `${cause} · ${L('home in {n}s', { n: returning })}`
      : exposed
        ? L('{n} trail cells — return to your land', { n: mine?.trail.length ?? 0 })
        : view.lastCapture > 0
          ? L('Loop closed · +{n} cells', { n: view.lastCapture })
          : L('Inside your land · safe trail');
  const ink = { ['--seat-ink' as string]: playerInk(view.slot) } as CSSProperties;
  return (
    <Screen className={styles.screen} ghost={false}>
      <div
        className={styles.content}
        data-stage={stage || undefined}
        data-results={over || undefined}
        style={ink}
      >
        <header className={styles.header}>
          {player ? <SeatBadge className={styles.seat} slot={view.slot} /> : null}
          <div className={styles.heading}>
            <p>{view.phaseId === 'play' && player ? standing : L('Paper Territory')}</p>
            <h2>{title}</h2>
          </div>
          {!over ? (
            <b className={styles.clock} role="timer">
              {view.paused ? L('Paused') : view.phaseId === 'ready' ? seconds : clockText(left)}
            </b>
          ) : null}
        </header>
        {player && !over ? (
          <dl className={styles.stats}>
            <div>
              <dt>{L('Area')}</dt>
              <dd>{areaPercent(view.area, view.width * view.height)}%</dd>
            </div>
            <div>
              <dt>{L('Cells')}</dt>
              <dd>{view.area}</dd>
            </div>
            <div>
              <dt>{view.phaseId === 'play' ? L('Place') : L('Crashes')}</dt>
              <dd>{view.phaseId === 'play' ? (myRow?.rank ?? 1) : view.deaths}</dd>
            </div>
          </dl>
        ) : null}
        {view.phaseId === 'play' && player ? (
          <p className={styles.status} data-exposed={exposed || undefined} role="status">
            {status}
          </p>
        ) : null}
        {stage && view.owners ? (
          <div className={styles.arena}>
            <Map
              compact={!over}
              width={view.width}
              height={view.height}
              owners={view.owners}
              runners={view.runners}
              meId={player ? view.me.id : undefined}
              label={
                player
                  ? L(
                      'Live map. Your numbered runner has a ring. Each seat has its own land texture. Arrows show direction. Outlined numbered squares are protected homes.',
                    )
                  : L(
                      'Live map. Numbered discs and direction arrows are players. Each seat has its own land texture. Outlined numbered squares are protected homes.',
                    )
              }
            />
          </div>
        ) : null}
        {over ? (
          <>
            <p className={styles.summary}>
              {player
                ? L('Place {rank} · {n} cells · {m}%', {
                    rank: rows.find((row) => row.id === view.me.id)?.rank ?? 1,
                    n: view.scores[view.me.id] ?? 0,
                    m: areaPercent(view.scores[view.me.id] ?? 0, view.width * view.height),
                  })
                : L('Final territory counts')}
            </p>
            <ul className={styles.rows} aria-label={L('Final standings')}>
              {rows.map((row) => (
                <li
                  key={row.id}
                  data-me={(player && row.id === view.me.id) || undefined}
                  style={{ ['--seat-ink' as string]: playerInk(row.slot) } as CSSProperties}
                >
                  <span className={styles.rank}>{row.rank}</span>
                  <SeatBadge className={styles.rowSeat} slot={row.slot} />
                  <b className={styles.name}>{row.name}</b>
                  <b>{row.area}</b>
                </li>
              ))}
            </ul>
          </>
        ) : view.phaseId === 'ready' ? (
          <>
            <ul className={styles.rules}>
              <li>
                <b>1</b>
                {L('Tap an arrow. You keep moving.')}
              </li>
              <li>
                <b>2</b>
                {L('Loop back to your land to claim it.')}
              </li>
              <li>
                <b>3</b>
                {L('Protect your trail. Rivals can cut it.')}
              </li>
              <li>
                <b>4</b>
                {L('Walls, your own trail and head crashes cost all extra land.')}
              </li>
            </ul>
            {!stage ? (
              <p className={styles.count} aria-live="polite">
                {seconds}
              </p>
            ) : null}
          </>
        ) : player ? (
          <>
            <DirectionPad view={view} send={send} />
            <p className={styles.hint}>
              {L('Tap to turn. No U-turns. A cut trail costs your extra land.')}
            </p>
          </>
        ) : (
          <p className={styles.hint}>
            {L('Outlined squares are homes. Dashed trails can be cut.')}
          </p>
        )}
      </div>
    </Screen>
  );
}
