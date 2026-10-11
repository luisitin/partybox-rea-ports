// BidPad (P00 §6, P6): a big bid in large digits with − / + steppers, quick chips (+5, +10, +25,
// All in), the coins you have, a confirm button and an optional Pass. A bid above your coins
// cannot be entered: everything clamps to `max`. Built for thumbs and fidgeting: steppers act on
// press and repeat while held, nothing selects or zooms, and the confirm is inert while the shown
// bid is the one already sent (no double send) or on its way (T-0225: "Sending…" until the echo,
// at most 4 s). Tokens only; motion off under reduced motion.
// Imported from its own subpath (`@partybox/game-sdk/ui/bid-pad`) so it lands in its game's
// chunk, never the entry (game-pack audit #23).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent, ReactNode } from 'react';
import { PrimaryButton } from '../../controller/PrimaryButton';
import { Screen } from '../../controller/Screen';
import { buzz } from '../../ui/haptics';
import { useT } from '../../ui/lang';
import styles from './BidPad.module.css';
import { chipTargets, clampBid, stepBid } from './bidPadMath';
import { BID_PAD_STRINGS } from './strings';

export interface BidPadProps {
  value: number;
  /** Your coins: the largest bid you can enter. */
  max: number;
  /** The smallest bid (default 0): e.g. an ante everyone must stake. */
  min?: number;
  onChange: (value: number) => void;
  onConfirm: (value: number) => void;
  /** The bid already sent (null = none yet): the confirm reads "✓ Bid placed" while it matches. */
  placed: number | null;
  /** Sends a 0 bid. Omit to hide the Pass button. */
  onPass?: () => void;
  step?: number;
  chips?: readonly number[];
  /** What is being bid on, one short line above the pad (the lot's name). */
  header?: ReactNode;
  /** More about it, under the pad (the lot's hint): the pad itself always comes first, so on a
   *  small or sideways phone, or at large text, the thumb finds it without scrolling. */
  below?: ReactNode;
  /** A line under the pad: a refusal from the server, or a reason the confirm is off. */
  notice?: ReactNode;
  /** A quiet line under the chips that follows the bid (what it would bring back, a limit): never
   *  shaken like `notice`. */
  readout?: ReactNode;
  /** Glyph before every amount. */
  coin?: string;
  /** The game's own words for the buttons (already translated); BidPad's are the default. A
   *  betting game says "Bet 🪙 40 on 💀 Trap" where an auction says "Place bid". */
  texts?: BidPadTexts;
  /** The confirm stays off (with `notice` saying why) — e.g. nothing picked yet to bet on. */
  blocked?: boolean;
  /** Show "You have 🪙 N" above the dial (default). Off when the caller shows the coins itself,
   *  e.g. pinned in a header that never scrolls under a fade. */
  showHave?: boolean;
  /** Pin the dial and chips in the footer above the confirm (they never scroll under a fade);
   *  the body then holds only `header` and `below`. E.g. once the thing to bet on is picked. */
  pinPad?: boolean;
  className?: string;
}

export interface BidPadTexts {
  place?: (amount: number) => string;
  change?: (amount: number) => string;
  placed?: (amount: number) => string;
  zero?: string;
  pass?: string;
  passed?: string;
  /** The top chip ("All in" by default): e.g. "Max" when `max` is a limit, not your coins. */
  allIn?: string;
}

const REPEAT_AFTER_MS = 420;
/** How long a sent bid waits for the server's echo before the confirm is live again. */
const ECHO_TIMEOUT_MS = 4000;
const REPEAT_EVERY_MS = 90;

/** Press-and-hold repeat for a stepper: acts on press, then repeats until the finger lifts. */
function useRepeat(act: () => void): {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  stop: () => void;
} {
  const timers = useRef<{ wait: number; tick: number }>({ wait: 0, tick: 0 });
  const latest = useRef(act);
  useLayoutEffect(() => {
    latest.current = act;
  });
  const stop = (): void => {
    window.clearTimeout(timers.current.wait);
    window.clearInterval(timers.current.tick);
  };
  useEffect(() => stop, []);
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      stop();
      latest.current();
      timers.current.wait = window.setTimeout(() => {
        timers.current.tick = window.setInterval(() => latest.current(), REPEAT_EVERY_MS);
      }, REPEAT_AFTER_MS);
    },
    stop,
  };
}

export function BidPad({
  value,
  max,
  min = 0,
  onChange,
  onConfirm,
  placed,
  onPass,
  step = 5,
  chips = [5, 10, 25],
  header,
  below,
  notice,
  readout,
  coin = '🪙',
  texts = {},
  blocked = false,
  showHave = true,
  pinPad = false,
  className,
}: BidPadProps): JSX.Element {
  const L = useT(BID_PAD_STRINGS);
  const bid = clampBid(value, max, min);
  // Latest value for the repeat timers (a held stepper keeps counting from where it is).
  const current = useRef(bid);
  useLayoutEffect(() => {
    current.current = bid;
  }, [bid]);
  const set = (next: number): void => {
    const clamped = clampBid(next, max, min);
    if (clamped === current.current) return;
    current.current = clamped;
    buzz(8);
    onChange(clamped);
  };
  const down = useRepeat(() => set(stepBid(current.current, -1, step, max, min)));
  const up = useRepeat(() => set(stepBid(current.current, 1, step, max, min)));
  // The amount on its way (a pass is 0): the echo in `placed` or 4 s of silence ends the wait.
  const [inflight, setInflight] = useState<number | null>(null);
  if (inflight !== null && placed === inflight) setInflight(null);
  useEffect(() => {
    if (inflight === null) return;
    const handle = setTimeout(() => setInflight(null), ECHO_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, [inflight]);
  const sending = inflight !== null && inflight === bid;
  const sent = placed !== null && placed === bid;
  const passed = placed === 0;
  const confirmLabel =
    bid === 0
      ? (texts.zero ?? L('Choose an amount'))
      : sending
        ? L('Sending…')
        : sent
          ? (texts.placed?.(bid) ?? L('Bid placed: {coin} {n}', { coin, n: bid }))
          : placed !== null && placed > 0
            ? (texts.change?.(bid) ?? L('Change bid to {coin} {n}', { coin, n: bid }))
            : (texts.place?.(bid) ?? L('Place bid: {coin} {n}', { coin, n: bid }));
  const stepper = (dir: 1 | -1, handlers: ReturnType<typeof useRepeat>): JSX.Element => {
    const inert = dir < 0 ? bid <= Math.min(min, max) || bid <= 0 : bid >= max;
    return (
      <button
        type="button"
        className={styles.step}
        aria-label={
          dir < 0 ? L('Lower the bid by {n}', { n: step }) : L('Raise the bid by {n}', { n: step })
        }
        aria-disabled={inert}
        onPointerDown={handlers.onPointerDown}
        onPointerUp={handlers.stop}
        onPointerLeave={handlers.stop}
        onPointerCancel={handlers.stop}
        onContextMenu={(e) => e.preventDefault()}
        // Keyboard and screen readers click (detail 0); a finger already acted on press.
        onClick={(e) => {
          if (e.detail === 0) set(stepBid(current.current, dir, step, max, min));
        }}
      >
        {dir < 0 ? '−' : '+'}
      </button>
    );
  };
  const pad = (
    <div className={styles.pad} onContextMenu={(e) => e.preventDefault()}>
      {showHave ? (
        <p className={styles.have}>{L('You have {coin} {n}', { coin, n: max })}</p>
      ) : null}
      <div className={styles.dial}>
        {stepper(-1, down)}
        <output
          className={styles.amount}
          aria-live="polite"
          aria-label={L('Your bid: {n}', { n: bid })}
        >
          <span className={styles.coin} aria-hidden>
            {coin}
          </span>
          <span key={bid} className={styles.digits}>
            {bid}
          </span>
        </output>
        {stepper(1, up)}
      </div>
      <div className={styles.chips}>
        {chipTargets(bid, chips, max, min).map((c) => (
          <button
            key={c.amount}
            type="button"
            className={styles.chip}
            aria-disabled={!c.live}
            aria-label={L('Add {n}', { n: c.amount })}
            onClick={() => set(c.to)}
          >
            +{c.amount}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${styles.allIn}`}
          aria-disabled={bid >= max || max <= 0}
          onClick={() => set(max)}
        >
          {texts.allIn ?? L('All in')}
        </button>
      </div>
      {readout ? <p className={styles.readout}>{readout}</p> : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
  return (
    <Screen
      className={`${styles.screen} ${pinPad ? styles.pinned : ''} ${className ?? ''}`}
      footer={
        <div className={styles.footer}>
          {pinPad ? pad : null}
          <PrimaryButton
            done={sent && !passed && !blocked}
            busy={sending && !blocked}
            disabled={bid === 0 || blocked}
            onClick={() => {
              if (bid > 0 && !sent && !sending && !blocked) {
                setInflight(bid);
                onConfirm(bid);
              }
            }}
          >
            {confirmLabel}
          </PrimaryButton>
          {onPass ? (
            <button
              type="button"
              className={`${styles.pass} ${passed ? styles.passed : ''}`}
              aria-disabled={passed}
              onClick={() => {
                if (!passed && inflight !== 0) {
                  setInflight(0);
                  onPass();
                }
              }}
            >
              {passed ? (texts.passed ?? L('✓ Passed')) : (texts.pass ?? L('Pass (bid 0)'))}
            </button>
          ) : null}
        </div>
      }
    >
      {header}
      <div className={styles.layout}>
        {pinPad ? null : pad}
        {below ? <div className={styles.below}>{below}</div> : null}
      </div>
    </Screen>
  );
}
