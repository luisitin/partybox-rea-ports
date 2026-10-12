import { renderToStaticMarkup } from 'react-dom/server';
import { ServerClockProvider } from '@partybox/game-sdk/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tv } from '../client/Tv';
import styles from '../client/Tv.module.css';
import { phone, pick, start, timer, toWager, tv, vip, wager } from './helpers';

afterEach(() => vi.useRealTimers());

function finalReveal() {
  let state = toWager(start(), { a: true, b: true, c: true });
  for (const id of ['a', 'b', 'c']) state = wager(state, id, 50);
  if (state.phase.id === 'wager') state = timer(state);
  state = pick(state, 'a', true);
  state = pick(state, 'b', false);
  state = pick(state, 'c', true);
  if (state.phase.id === 'question') state = timer(state);
  expect(state.phase.id).toBe('reveal');
  expect(tv(state).round?.final).toBe(true);
  return state;
}

function paint(late: boolean, offsetMs: number): string {
  const state = finalReveal();
  const now = late ? state.phase.deadline! - 300 : state.phase.startedAt;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now - offsetMs);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offsetMs}>
      <Tv view={{ ...tv(state), vip: 'a' }} />
    </ServerClockProvider>,
  );
}

describe('Lightning Round final reveal first paint resumes after a late reload', () => {
  for (const offsetMs of [0, 2500, -2500])
    it(`keeps the answer and earned totals visible with 300 ms left (offset ${offsetMs})`, () => {
      const html = paint(true, offsetMs);
      expect(html).not.toContain(styles.answerHidden);
      expect(html).toContain(styles.total);
    });

  it('still holds the answer and totals on the initial reveal frame', () => {
    const html = paint(false, 0);
    expect(html).toContain(styles.answerHidden);
    expect(html).not.toContain(styles.total);
  });

  it('resuming preserves the active reveal age, excluding time paused', () => {
    let state = finalReveal();
    const began = state.phase.startedAt;
    state = vip(state, 'pause', began + 400);
    state = vip(state, 'resume', began + 10_400);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(began + 10_400);
    const view = tv(state);
    expect(view.revealAt).toBe(began + 10_000);
    const html = renderToStaticMarkup(<Tv view={{ ...view, vip: 'a' }} />);
    expect(html).toContain(styles.answerHidden);
    expect(html).not.toContain(styles.total);
  });

  it('publishes the reveal clock to the TV and the phones during reveal only', () => {
    const reveal = finalReveal();
    expect(tv(reveal).revealAt).toBe(reveal.phase.startedAt);
    expect(tv(start())).not.toHaveProperty('revealAt');
    expect(tv(toWager(start()))).not.toHaveProperty('revealAt');
    expect(tv(timer(reveal))).not.toHaveProperty('revealAt');
    // The phones count their beats (✓/✗, the final's hold, Next) from the TV's clock.
    expect(phone(reveal, 'a').revealAt).toBe(reveal.phase.startedAt);
    expect(phone(timer(reveal), 'a')).not.toHaveProperty('revealAt');
  });
});
