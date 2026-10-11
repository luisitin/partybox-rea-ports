import { describe, expect, it } from 'vitest';
import { drawing, kit } from './helpers';

describe('one-shot phase timers', () => {
  it('ignores timers before the current deadline in choice, drawing and reveal', () => {
    for (const state of [kit.start(), drawing(), kit.finish(drawing())]) {
      expect(state.phase.deadline).not.toBeNull();
      expect(kit.timer(state, state.phase.deadline! - 1)).toBe(state);
    }
  });

  it('ignores timers for a previous phase instance, even after their old deadline', () => {
    for (const state of [kit.start(), drawing(), kit.finish(drawing())]) {
      const event = {
        type: 'timer' as const,
        now: state.phase.deadline! + 1000,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt - 1,
      };
      expect(kit.reduce(state, event)).toBe(state);
      expect(
        kit.reduce(state, { ...event, phaseId: 'old-phase', startedAt: state.phase.startedAt }),
      ).toBe(state);
    }
  });
});
