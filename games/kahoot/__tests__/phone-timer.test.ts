// I-288 A: the phone's clock goes quiet when nothing can be pressed.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { controllerView } from '../server/views';
import type { State } from '../server/types';

describe('I-288: the phone clock follows the TV', () => {
  it('quiet in the intro and reveal, normal while a question is open', () => {
    const players = [
      { id: 'a', name: 'A', avatarId: 'fox', connected: true },
      { id: 'b', name: 'B', avatarId: 'owl', connected: true },
    ];
    const s = game.init({ players, settings: { questions: 5 }, seed: 1, now: 0 }) as State;
    expect(controllerView(s, 'kahoot', 'a').timerMode).toBe('quiet'); // intro
    const q = { ...s, index: 0, phase: { ...s.phase, id: 'question' as const } } as State;
    expect(controllerView(q, 'kahoot', 'a').timerMode).toBe('normal');
    const r = { ...q, phase: { ...q.phase, id: 'reveal' as const } } as State;
    expect(controllerView(r, 'kahoot', 'a').timerMode).toBe('quiet');
  });
});
