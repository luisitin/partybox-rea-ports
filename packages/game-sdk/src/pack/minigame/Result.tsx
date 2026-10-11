// S18: "{Name} Wins!", ranks in a row with a +coins chip for the winners, the Double ribbon, and the
// phone's one line. Ties share the rank and the prize (the ranking already says who tied).
import type { JSX } from 'react';
import type {
  MinigameControllerView,
  MinigamePlayerView,
  MinigameView,
} from '../../minigame/types';
import { Avatar } from '../../ui/Avatar';
import { joinNamesIn } from '../../ui/joinNamesIn';
import { useT } from '../../ui/lang';
import { CoinArt } from './GameBadge';
import styles from './MinigameFrame.module.css';
import { Sheen } from './Sheen';
import { STRINGS } from './strings';

type Translate = ReturnType<typeof useT>;

/** 1 → "1st" (English) / "1.º" (Spanish). */
function place(n: number, lang: string): string {
  if (lang === 'es') return `${n}.º`;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}

function byId(view: MinigameView): Map<string, MinigamePlayerView> {
  return new Map(view.players.map((p) => [p.id, p]));
}

/** The headline for who won: a side's name, one or two names, or nobody. */
export function headline(view: MinigameView, L: Translate): string {
  const r = view.result;
  const names = byId(view);
  if (!r || r.winnerIds.length === 0) return L('Nobody wins this one.');
  if (r.winningTeam !== null && view.mode !== 'duel') {
    const side = view.teams[r.winningTeam];
    if (side) return L('Team {name} Wins!', { name: L(side.name) });
  }
  const winners = r.winnerIds.map((id) => names.get(id)?.name ?? id);
  const [first, second] = winners;
  if (winners.length === 1 && first !== undefined) return L('{name} Wins!', { name: first });
  if (winners.length === 2 && first !== undefined && second !== undefined)
    return L('{a} and {b} Win!', { a: first, b: second });
  return L('{name} Wins!', { name: joinNamesIn(L.lang, winners) });
}

export function Result(props: {
  view: MinigameView | MinigameControllerView;
  role: 'tv' | 'phone';
}): JSX.Element {
  const { view, role } = props;
  const L = useT(STRINGS);
  const r = view.result;
  const prize = view.prize;
  const winners = new Set(r?.winnerIds ?? []);
  const names = byId(view);
  const me = 'me' in view ? view.me.id : null;
  if (role === 'phone') {
    const won = me !== null && winners.has(me);
    const first = r?.winnerIds[0];
    const line = won
      ? prize
        ? L('You won! +{n} coins', { n: prize.coins })
        : L('You won!')
      : first !== undefined
        ? L('{name} won. You got 0.', { name: names.get(first)?.name ?? first })
        : L('You got 0.');
    const mine = (r?.ranking ?? []).find((row) => row.playerId === me);
    return (
      <section className={`${styles.result} ${styles.phone}`} aria-live="polite">
        <h2 className={styles.headline}>{headline(view, L)}</h2>
        <p className={`${styles.phoneLine} ${won ? styles.won : ''}`}>{line}</p>
        {mine ? (
          <p className={styles.phonePlace}>
            {L('You came {place}', { place: place(mine.rank, L.lang) })}
          </p>
        ) : null}
        <ol className={styles.phoneRanks}>
          {(r?.ranking ?? []).map((row) => (
            <li key={row.playerId} className={row.playerId === me ? styles.mine : ''}>
              <span>{row.rank}</span>
              <span className={styles.phoneName}>
                {names.get(row.playerId)?.name ?? row.playerId}
              </span>
              {row.score !== undefined ? <span>{Math.round(row.score * 10) / 10}</span> : null}
            </li>
          ))}
        </ol>
        {prize?.double ? <p className={styles.ribbon}>{L('Double coins!')}</p> : null}
      </section>
    );
  }
  return (
    <section className={`${styles.result} ${styles.tv}`} aria-live="polite">
      <Sheen />
      <h2 className={styles.headline}>{headline(view, L)}</h2>
      {prize?.double ? <p className={styles.ribbon}>{L('Double coins!')}</p> : null}
      <ol className={styles.ranks}>
        {(r?.ranking ?? []).map((row) => {
          const p = names.get(row.playerId);
          if (!p) return null;
          const won = winners.has(row.playerId);
          return (
            <li key={row.playerId} className={`${styles.rank} ${won ? styles.winner : ''}`}>
              <span className={styles.place}>{row.rank}</span>
              <Avatar avatarId={p.avatarId} size="var(--pb-chip-size, 96px)" />
              <span className={styles.rankName}>{p.name}</span>
              {row.score !== undefined ? (
                <span className={styles.score}>{Math.round(row.score * 10) / 10}</span>
              ) : null}
              {won && prize ? (
                <span className={styles.coins}>
                  <CoinArt /> +{prize.coins}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
