// A TV or phone that reloads mid-reveal lands on the room's current beat: the beats count from the
// server's `revealAt`, not from the mount (the race is not replayed, the phone's ✓ and the VIP's
// Next do not wait again, the final's "bets are in" hold is not shown twice).
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import tvStyles from '../client/Tv.module.css';
import { phone, pick, start, timer, toFirstQuestion, toWager, tv, vip, wager } from './helpers';
import type { State } from '../server/types';

afterEach(() => vi.useRealTimers());

function regularReveal(): State {
  let state = toFirstQuestion(start());
  state = pick(state, 'a', true, 1000);
  state = pick(state, 'b', false, 2000);
  state = pick(state, 'c', true, 3000);
  if (state.phase.id === 'question') state = timer(state);
  expect(state.phase.id).toBe('reveal');
  return state;
}

function finalReveal(): State {
  let state = toWager(start(), { a: true, b: true, c: true });
  for (const id of ['a', 'b', 'c']) state = wager(state, id, 50);
  if (state.phase.id === 'wager') state = timer(state);
  for (const id of ['a', 'b', 'c']) state = pick(state, id, id !== 'b');
  if (state.phase.id === 'question') state = timer(state);
  expect(state.phase.id).toBe('reveal');
  return state;
}

function at(state: State, sinceMs: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(state.phase.startedAt + sinceMs);
}

const paintPhone = (state: State, id: string): string =>
  renderToStaticMarkup(
    <Controller
      view={{ ...phone(state, id), vip: 'a' }}
      me={{ id, name: id, avatarId: 'fox' }}
      send={() => {}}
      skip={() => {}}
    />,
  );

describe('Lightning Round reveal: a reload lands on the current beat', () => {
  it('the TV comes back on the standings and the Next hint, not the race', () => {
    const state = regularReveal();
    at(state, 0);
    const fresh = renderToStaticMarkup(<Tv view={{ ...tv(state), vip: 'a' }} skip={() => {}} />);
    expect(fresh).not.toContain(tvStyles.settled);
    expect(fresh).not.toContain('phone');
    at(state, tv(state).leaderboardAt! - state.phase.startedAt + 500);
    const late = renderToStaticMarkup(<Tv view={{ ...tv(state), vip: 'a' }} skip={() => {}} />);
    expect(late).toContain(tvStyles.settled);
    expect(late).toContain('Next on Ana');
  });

  it('a paused race and verdict stay on their held beat after a late reload', () => {
    const state = regularReveal();
    const paused = vip(state, 'pause', state.phase.startedAt + 200);
    at(state, 10_200);
    const view = tv(paused);
    expect(view.clockHeldAt).toBe(state.phase.startedAt + 200);
    const html = renderToStaticMarkup(<Tv view={{ ...view, vip: 'a' }} skip={() => {}} />);
    expect(html).not.toContain(tvStyles.settled);
    expect(html).not.toContain('Next on Ana');
    expect(paintPhone(paused, 'a')).not.toContain('Next question');
    const resumed = vip(paused, 'resume', state.phase.startedAt + 10_200);
    expect(tv(resumed).revealAt).toBe(state.phase.startedAt + 10_000);
    at(state, 10_200);
    expect(renderToStaticMarkup(<Tv view={{ ...tv(resumed), vip: 'a' }} />)).not.toContain(
      tvStyles.settled,
    );
    at(state, tv(resumed).leaderboardAt! - state.phase.startedAt);
    expect(renderToStaticMarkup(<Tv view={{ ...tv(resumed), vip: 'a' }} />)).toContain(
      tvStyles.settled,
    );
  });

  it("the VIP's phone comes back with its verdict and Next at once", () => {
    const state = regularReveal();
    at(state, 0);
    expect(paintPhone(state, 'a')).not.toContain('Next question');
    at(state, phone(state, 'a').nextAt! - state.phase.startedAt + 500);
    expect(paintPhone(state, 'a')).toContain('Next question');
  });

  it("a resume (the deadline moved by the pause) does not hide the VIP's Next again", () => {
    const state = regularReveal();
    const pauseMs = 60_000;
    // The engine's resume shifts the deadline by the pause; the reveal's own clock skips the pause.
    const resumed: State = {
      ...state,
      phase: { ...state.phase, deadline: (state.phase.deadline ?? 0) + pauseMs },
    };
    expect(tv(resumed).revealAt).toBe(state.phase.startedAt + pauseMs);
    at(resumed, phone(resumed, 'a').nextAt! - resumed.phase.startedAt + 500);
    expect(paintPhone(resumed, 'a')).toContain('Next question');
    at(resumed, pauseMs + 100);
    expect(paintPhone(resumed, 'a')).not.toContain('Next question');
  });

  it('a phone reloaded late in the final reveal does not hold "the bets are in" again', () => {
    const state = finalReveal();
    at(state, 0);
    const fresh = paintPhone(state, 'b');
    at(state, 5_000);
    const late = paintPhone(state, 'b');
    // The verdict band is laid out unseen during the hold (aria-hidden), shown once it ends.
    expect(fresh).toContain('aria-hidden="true"');
    expect(late).not.toBe(fresh);
  });
});
