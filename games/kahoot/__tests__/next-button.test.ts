// I-589 (the owner's note): a regular reveal holds the standings longer and carries its own Next
// button, so the shell's generic Skip / Next is hidden there; the final reveal keeps the shell's.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { controllerView, tvView } from '../server/views';
import { revealMs } from '../server/phases/reveal';
import { FINAL_REVEAL_MS, REVEAL_MS } from '../server/types';
import type { State } from '../server/types';

const players = [
  { id: 'a', name: 'A', avatarId: 'fox', connected: true },
  { id: 'b', name: 'B', avatarId: 'owl', connected: true },
];

function at(index: number, phase: 'question' | 'reveal'): State {
  const s = game.init({ players, settings: { questions: 5 }, seed: 1, now: 0 }) as State;
  return { ...s, index, phase: { id: phase, startedAt: 0, deadline: 1000 } } as State;
}

describe('I-589: the standings Next button', () => {
  it('a regular reveal names its next step and hides the shell skip', () => {
    const tv = tvView(at(0, 'reveal'), 'kahoot');
    expect(tv.next).toBe('question');
    expect(tv.vipSkipHidden).toBe(true);
    expect(controllerView(at(0, 'reveal'), 'kahoot', 'a').next).toBe('question');
    // question 5 of 5 → the wager comes next
    expect(tvView(at(4, 'reveal'), 'kahoot').next).toBe('wager');
  });

  it('the question phase and the final reveal keep the shell skip', () => {
    for (const s of [at(0, 'question'), at(5, 'reveal')]) {
      const tv = tvView(s, 'kahoot');
      expect(tv.next).toBeUndefined();
      expect(tv.vipSkipHidden).toBeUndefined();
    }
  });

  it('a reveal holds long enough to read every row (pacing rule): at least 8 s, more with more players', () => {
    expect(REVEAL_MS).toBe(8000);
    expect(FINAL_REVEAL_MS).toBe(8000);
    let s = game.init({ players, settings: { questions: 5 }, seed: 1, now: 0 }) as State;
    s = game.reduce(s, { type: 'vip', action: 'skip', now: 10 }) as State;
    s = game.reduce(s, { type: 'vip', action: 'skip', now: 20 }) as State;
    expect(s.phase.id).toBe('reveal');
    expect(s.phase.deadline).toBe(20 + revealMs(s));
    expect(revealMs(s)).toBeGreaterThanOrEqual(REVEAL_MS);
    const crowd = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`p${i}`, Object.values(s.players)[0]]),
    );
    expect(revealMs({ ...s, players: crowd } as State)).toBeGreaterThan(revealMs(s) + 5_000);
  });
});
