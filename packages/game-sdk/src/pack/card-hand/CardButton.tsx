// One card of CardHand's fan, memoised: a drag re-renders the hand at every gap it opens, and only the
// cards whose place changed redo their work (T-0342 review: every card re-rendered per gap, so a slow
// phone dropped frames in a 24-card hand). Its props are plain values and one stable set of handlers.
import { memo } from 'react';
import type {
  CSSProperties,
  FocusEvent,
  JSX,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import styles from './CardHand.module.css';

/** The same object on every render (CardHand keeps it), so a card's memo holds. */
export interface CardOn {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onFocus: (e: FocusEvent<HTMLButtonElement>) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface CardButtonProps {
  id: string;
  face: ReactNode;
  /** Its spoken name with its place ("Green 3, 4 of 11, playable"). */
  name: string;
  focusable: boolean;
  picked: boolean;
  /** On the finger: fixed, and the frame loop owns its transform (x, y, rotate are ignored). */
  lifted: boolean;
  glow: boolean;
  dim: boolean;
  fresh: boolean;
  w: number;
  h: number;
  z: number;
  x: number;
  y: number;
  rotate: number;
  /** How far a picked card rises (px). */
  lift: number;
  on: CardOn;
}

const noMenu = (e: MouseEvent<HTMLButtonElement>): void => e.preventDefault();

export const CardButton = memo(function CardButton(p: CardButtonProps): JSX.Element {
  const style = (
    p.lifted
      ? { width: p.w, height: p.h, zIndex: p.z }
      : {
          width: p.w,
          height: p.h,
          zIndex: p.z,
          transform: `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotate}deg)`,
          '--lift': `${-p.lift}px`,
        }
  ) as CSSProperties;
  return (
    <button
      type="button"
      className={styles.card}
      data-card={p.id}
      data-drag={p.lifted || undefined}
      data-picked={(p.picked && !p.lifted) || undefined}
      data-glow={p.glow || undefined}
      data-dim={p.dim || undefined}
      data-fresh={p.fresh || undefined}
      aria-pressed={p.picked}
      aria-label={p.name}
      tabIndex={p.focusable ? 0 : -1}
      style={style}
      onContextMenu={noMenu}
      {...p.on}
    >
      <span className={styles.skin}>{p.face}</span>
    </button>
  );
});
