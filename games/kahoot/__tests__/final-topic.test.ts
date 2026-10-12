// I-550: the wager screens know the final's topic.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { controllerView, tvView } from '../server/views';
import type { State } from '../server/types';

describe('I-550: the category before the bet', () => {
  it('the wager views carry the final question topic', () => {
    const players = [
      { id: 'a', name: 'A', avatarId: 'fox', connected: true },
      { id: 'b', name: 'B', avatarId: 'owl', connected: true },
    ];
    const s0 = game.init({ players, settings: { questions: 5 }, seed: 1, now: 0 }) as State;
    const s = { ...s0, phase: { ...s0.phase, id: 'wager' as const } } as State;
    const tv = tvView(s, 'kahoot');
    const cv = controllerView(s, 'kahoot', 'a');
    expect(tv.finalTopic?.categoryLabel).toBeTruthy();
    expect(cv.finalTopic).toEqual(tv.finalTopic);
  });
});
