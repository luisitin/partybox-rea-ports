// Phone screen frame: safe-area padding, no rubber-banding, and a sticky bottom bar so the primary
// action stays thumb-reachable and is never hidden by the iOS keyboard.
//
// Screens dissolve into each other (review-loop #18): a Screen that really unmounts parks a DOM
// snapshot of itself in its parent and fades it over --pb-motion-base, so whatever mounts next —
// even a frame later — rises under the old picture instead of after a blank. Imperative on purpose
// (no state, no extra render) so the ghost is there from the first frame; StrictMode's simulated
// unmount leaves the node connected and is ignored. Reduced motion: no ghost.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { useT } from '../ui/lang';
import { sanitizeSnapshot, usePrefersReducedMotion } from '../ui/motion';
import styles from './Screen.module.css';
import { STRINGS } from './strings';

export interface ScreenProps {
  children: ReactNode;
  /** Rendered in the sticky bottom bar (usually a PrimaryButton). */
  footer?: ReactNode;
  title?: ReactNode;
  className?: string;
  /** Inline style on the frame. */
  style?: CSSProperties;
  /**
   * The title is drawn right down to its bottom edge (the results' award chips): once the body
   * scrolls, its top fades over a band scaled to the text size, so a row scrolling up thins out
   * below that edge instead of reading as tucked under it. Paint only; the layout does not change.
   */
  fadeTop?: boolean;
  /**
   * Default true: on unmount the Screen leaves a fading picture of itself (the dissolve). False for
   * a placeholder the real screen replaces in place (the shell's "Getting the game ready…"): its
   * picture would fade over the game that just mounted (T-0281).
   */
  ghost?: boolean;
}

const GHOST_MS = 350;
// Disabled controls cannot take focus: a body holding only those (Yahtzee's tiles before the roll) still needs its own stop.
const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const GHOST = styles['ghost'] ?? 'ghost';

export function Screen({
  children,
  footer,
  title,
  className,
  style,
  fadeTop,
  ghost = true,
}: ScreenProps): JSX.Element {
  const L = useT(STRINGS);
  const section = useRef<HTMLElement>(null);
  // I-066 B: "more below" — true while the body can scroll further (scroll + resize watched).
  // I-788 A: the cue is a row of its own at the top of the footer. `room` lays the row out while
  // the body overflows (measured as if the row were absent, so laying it out never flips it back);
  // `more` only fades it, so reaching the end shifts nothing under the finger.
  const body = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLButtonElement>(null);
  const [room, setRoom] = useState(false);
  const [more, setMore] = useState(false);
  // T-0089: a body that scrolls with nothing inside to Tab to takes focus itself, so a keyboard
  // (a switch, a Bluetooth one) can scroll it; one with a control lets that control scroll it.
  const [keyScroll, setKeyScroll] = useState(false);
  useEffect(() => {
    const el = body.current;
    if (!el) return undefined;
    const check = (): void => {
      // What the laid-out row takes from the body: the row itself inside a footer, or the whole
      // safe-area strip when the Screen has no footer (the strip holds the row alone).
      const btn = cue.current;
      const strip = btn?.parentElement;
      const alone = !!strip && strip.children.length === 1;
      const taken = !btn ? 0 : alone ? (strip?.offsetHeight ?? 0) : btn.offsetHeight + 2;
      setRoom(el.scrollHeight - el.clientHeight - taken > 24);
      setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 24);
      setKeyScroll(el.scrollHeight > el.clientHeight + 1 && !el.querySelector(FOCUSABLE));
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    // A section that opens inside the body (the VIP's Game options) grows the content, not the
    // body's box: re-check on any change inside, and watch the new children's sizes too.
    const mo = new MutationObserver(() => {
      for (const child of el.children) ro.observe(child);
      check();
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const el = section.current;
    if (!el || reduced || !ghost) return;
    return () => {
      // Unmount: the parent keeps a fading picture of this screen for one motion beat.
      const parent = el.parentElement;
      const snapshot = sanitizeSnapshot(el.cloneNode(true) as HTMLElement);
      queueMicrotask(() => {
        if (el.isConnected || !parent?.isConnected) return; // StrictMode rehearsal, or gone
        const host = el.ownerDocument.createElement('div');
        host.className = GHOST;
        host.dataset.pbGhost = ''; // I-791 D: the phone shell hides it while the link card is up
        host.appendChild(snapshot);
        parent.appendChild(host);
        setTimeout(() => host.remove(), GHOST_MS);
      });
    };
  }, [reduced, ghost]);
  return (
    <section ref={section} className={`${styles.screen} ${className ?? ''}`} style={style}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <div
        ref={body}
        className={fadeTop ? `${styles.body} ${styles.fadeTop}` : styles.body}
        data-fold={room || undefined}
        tabIndex={keyScroll ? 0 : undefined}
      >
        {children}
      </div>
      {footer || room ? (
        <div className={footer ? styles.footer : styles.cueOnly}>
          {room ? (
            <button
              ref={cue}
              type="button"
              className={styles.cue}
              data-on={more}
              aria-label={L('scroll down')}
              tabIndex={more ? 0 : -1}
              onClick={() =>
                body.current?.scrollBy({ top: body.current.clientHeight * 0.8, behavior: 'smooth' })
              }
            >
              {L('more below')}
            </button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </section>
  );
}
