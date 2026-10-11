// WordGrid (Part 00 §6, SPEC §9.5) — the 5×5 board, on the TV and on phones. Dumb: cards in,
// taps out. A card turns over in 3D (transform only, both faces back-to-back) to show what it is;
// under reduced motion the faces crossfade instead. Never colour alone: every identity has its
// icon, every pointer its face, rows and columns their letters and numbers.
// Owned by Spy Grid (SESSION-PLAYBOOK §3); served as the subpath `@partybox/game-sdk/ui/word-grid`
// so it lands in its game's chunk, never the entry (audit #23).
import { memo, useRef } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { Faces, Reaction } from './WordGridParts';
import type { GridFace } from './WordGridParts';
import styles from './WordGrid.module.css';

/** A word's width in average letters: W and M run about 1.5× wide, I and punctuation half. */
export function fitWidth(word: string): number {
  let n = 0;
  for (const ch of word.toUpperCase()) n += /[WM]/.test(ch) ? 1.5 : /[I.'’\- ]/.test(ch) ? 0.5 : 1;
  return Math.max(1, Math.round(n * 100) / 100);
}

export type CardKind = 'sun' | 'moon' | 'bystander' | 'assassin';

export const KIND_ICON: Record<CardKind, string> = {
  sun: '▲',
  moon: '●',
  bystander: '🚶',
  assassin: '💀',
};

/** An identity's mark at full size: the team shapes as SVG (a text ● renders as a small dot in
 *  Nunito), the others as their emoji. */
export function KindIcon({ kind }: { kind: CardKind }): JSX.Element {
  if (kind === 'sun')
    return (
      <svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden>
        <path d="M50 8 L94 88 L6 88 Z" fill="currentColor" />
      </svg>
    );
  if (kind === 'moon')
    return (
      <svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="currentColor" />
      </svg>
    );
  return <>{KIND_ICON[kind]}</>;
}

export type { GridFace };

export interface GridCard {
  word: string;
  /** Known identity (null = face down for this screen). */
  kind: CardKind | null;
  /** Spymaster's key tint under a face-down card (the card stays face down). */
  keyKind?: CardKind | null;
  faces?: readonly GridFace[];
  /** The team whose pointers ring this card (shape + colour). */
  ring?: 'sun' | 'moon' | null;
  mine?: boolean;
  /** This card is turning right now (stage ≥ 1): lift it while it turns. */
  turning?: boolean;
  /** Turn over on mount after this many ms (the TV remounts per phase, so a flip is an entrance:
   *  the card being flipped, and the win's ripple). Null = already as shown. */
  turnIn?: number | null;
  /** A reaction and how long ago it was sent (a remount resumes the float, never restarts it). */
  reaction?: { emoji: string; key: string; until: number } | null;
}

export interface WordGridProps {
  cards: readonly GridCard[];
  surface: 'tv' | 'phone';
  /** 'grid' = 5×5; 'list' = reading-order buttons with coordinates (phones under 380 px). */
  layout?: 'grid' | 'list';
  onTap?: (index: number) => void;
  onLongPress?: (index: number) => void;
  /** Dim everything but these cards (the one turning). */
  focus?: number | null;
  label?: (index: number) => string;
  /** Only the words on face-down cards (no flip faces, pointers or handlers): a first, cheap paint
   *  while the full board renders in a later, time-sliced pass (Spy Grid's TV, T-0550). */
  bare?: boolean;
  className?: string;
  children?: ReactNode;
}

const ROWS = 'ABCDE';
export const coord = (i: number): string => `${ROWS[Math.floor(i / 5)] ?? ''}${(i % 5) + 1}`;

function sizeClass(word: string): string {
  const n = word.length;
  return n >= 9 ? (styles.long ?? '') : n >= 7 ? (styles.mid ?? '') : '';
}

function useLongPress(
  index: number,
  onTap?: (i: number) => void,
  onLong?: (i: number) => void,
): Record<string, (e: never) => void> {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const clear = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      if (onLong)
        timer.current = setTimeout(() => {
          fired.current = true;
          onLong(index);
        }, 450);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      clear();
      if (!fired.current) onTap?.(index);
      fired.current = false;
    },
  } as unknown as Record<string, (e: never) => void>;
}

type CardProps = {
  card: GridCard;
  index: number;
  surface: 'tv' | 'phone';
  list: boolean;
  dim: boolean;
  onTap?: (i: number) => void;
  onLongPress?: (i: number) => void;
  label?: string;
};

/** The views rebuild every `GridCard` on each push (the clock alone sends one a second), so a card
 *  compares by what it draws: a full board re-rendered 25 cards for a tick that changed none. */
function sameCard(a: CardProps, b: CardProps): boolean {
  const x = a.card;
  const y = b.card;
  const fa = x.faces ?? [];
  const fb = y.faces ?? [];
  return (
    a.index === b.index &&
    a.surface === b.surface &&
    a.list === b.list &&
    a.dim === b.dim &&
    a.onTap === b.onTap &&
    a.onLongPress === b.onLongPress &&
    a.label === b.label &&
    x.word === y.word &&
    x.kind === y.kind &&
    x.keyKind === y.keyKind &&
    x.ring === y.ring &&
    x.mine === y.mine &&
    x.turning === y.turning &&
    x.turnIn === y.turnIn &&
    x.reaction?.key === y.reaction?.key &&
    x.reaction?.until === y.reaction?.until &&
    fa.length === fb.length &&
    fa.every((f, i) => f.id === fb[i]?.id && f.avatarId === fb[i]?.avatarId)
  );
}

/** A card's resting look and nothing else: a full board of these costs a fraction of `Card`s. A card that is
 *  already revealed shows its identity (so it never blinks face-down), one that turns in on mount starts
 *  face-down like the real card will. */
const BareCard = memo(function BareCard({
  word,
  kind,
}: {
  word: string;
  kind: CardKind | null;
}): JSX.Element {
  const fit = { '--n': fitWidth(word) } as CSSProperties;
  return (
    <div className={[styles.card, kind ? styles.up : '', kind ? styles[kind] : ''].join(' ')}>
      <span className={styles.inner}>
        <span className={styles.front}>
          <span className={`${styles.word} ${sizeClass(word)}`} style={fit}>
            {word}
          </span>
        </span>
        <span className={styles.back} aria-hidden={!kind}>
          <span className={styles.smallWord} style={fit}>
            {word}
          </span>
          <span className={styles.icon}>{kind ? <KindIcon kind={kind} /> : null}</span>
        </span>
      </span>
    </div>
  );
});

const Card = memo(function Card(props: CardProps): JSX.Element {
  const { card, index, list, onTap, onLongPress } = props;
  const press = useLongPress(index, onTap, onLongPress);
  const kind = card.kind;
  const cls = [
    styles.card,
    kind ? styles.up : '',
    kind ? styles[kind] : '',
    card.keyKind && !kind ? styles[`key-${card.keyKind}`] : '',
    card.ring ? styles[`ring-${card.ring}`] : '',
    card.mine ? styles.mine : '',
    card.turning ? styles.turning : '',
    kind && card.turnIn !== null && card.turnIn !== undefined ? styles.turnIn : '',
    props.dim ? styles.dim : '',
    onTap ? styles.tappable : '',
  ].join(' ');
  const style = { '--delay': `${card.turnIn ?? 0}ms` } as CSSProperties;
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      type={onTap ? 'button' : undefined}
      className={cls}
      style={style}
      aria-label={props.label}
      {...(onTap ? press : {})}
    >
      <span className={styles.inner}>
        <span className={styles.front}>
          {list ? <span className={styles.coord}>{coord(index)}</span> : null}
          {card.keyKind && !kind ? (
            <span className={styles.keyIcon}>{KIND_ICON[card.keyKind]}</span>
          ) : null}
          <span
            className={`${styles.word} ${sizeClass(card.word)}`}
            style={{ '--n': fitWidth(card.word) } as CSSProperties}
          >
            {card.word}
          </span>
        </span>
        <span className={styles.back} aria-hidden={!kind}>
          {list ? <span className={styles.coord}>{coord(index)}</span> : null}
          <span
            className={styles.smallWord}
            style={{ '--n': fitWidth(card.word) } as CSSProperties}
          >
            {card.word}
          </span>
          <span className={styles.icon}>{kind ? <KindIcon kind={kind} /> : null}</span>
        </span>
      </span>
      <Faces faces={card.faces ?? []} />
      {card.reaction ? (
        <Reaction key={card.reaction.key} emoji={card.reaction.emoji} until={card.reaction.until} />
      ) : null}
    </Tag>
  );
}, sameCard);

export function WordGrid({
  cards,
  surface,
  layout = 'grid',
  onTap,
  onLongPress,
  focus = null,
  label,
  bare = false,
  className,
  children,
}: WordGridProps): JSX.Element {
  const list = layout === 'list';
  return (
    <div
      className={`${styles.wrap} ${styles[surface]} ${list ? styles.list : styles.grid} ${className ?? ''}`}
    >
      {list ? null : (
        <>
          <span className={styles.corner} />
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={`c${n}`} className={styles.colLabel}>
              {n}
            </span>
          ))}
        </>
      )}
      {cards.map((card, i) => (
        <GridCell key={i} index={i} list={list}>
          {bare ? (
            <BareCard
              word={card.word}
              kind={card.turnIn !== null && card.turnIn !== undefined ? null : card.kind}
            />
          ) : (
            <Card
              card={card}
              index={i}
              surface={surface}
              list={list}
              dim={focus !== null && focus !== i}
              onTap={onTap}
              onLongPress={onLongPress}
              label={label?.(i)}
            />
          )}
        </GridCell>
      ))}
      {children}
    </div>
  );
}

function GridCell({
  index,
  list,
  children,
}: {
  index: number;
  list: boolean;
  children: ReactNode;
}): JSX.Element {
  if (list || index % 5 !== 0) return <>{children}</>;
  return (
    <>
      <span className={styles.rowLabel}>{ROWS[index / 5]}</span>
      {children}
    </>
  );
}
