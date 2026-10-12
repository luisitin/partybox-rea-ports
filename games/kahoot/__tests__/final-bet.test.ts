import { describe, expect, it } from 'vitest';
import { finalBetLine } from '../client/final-bet';
import type { LightningControllerView } from '../server/views';

const L = ((key: string, p?: Record<string, string | number>) =>
  key.replace(/\{(\w+)\}/g, (_, k: string) => String(p?.[k] ?? ''))) as never;
const view = (v: Partial<LightningControllerView>): LightningControllerView =>
  v as LightningControllerView;

describe('finalBetLine', () => {
  it('shows both the stake and the delta once the verdict is shown', () => {
    const won = view({ myWagerAmount: 300, outcome: { correct: true, delta: 300 } });
    expect(finalBetLine(won, true, L)).toBe('You bet 300 and won 300');
    const lost = view({ myWagerAmount: 300, outcome: { correct: false, delta: -300 } });
    expect(finalBetLine(lost, true, L)).toBe('You bet 300 and lost 300');
  });
  it('keeps the waiting line before the verdict, or with no bet', () => {
    const v = view({ myWagerAmount: 300, outcome: { correct: true, delta: 300 } });
    expect(finalBetLine(v, false, L)).toBe('The bets are in — look at the TV');
    expect(finalBetLine({ ...v, phoneOnly: true } as never, false, L)).toBe('The bets are in…');
    expect(finalBetLine(view({ outcome: { correct: true, delta: 0 } }), true, L)).toBe(
      'The bets are in — look at the TV',
    );
  });
});
