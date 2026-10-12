import type { Translator } from '@partybox/game-sdk/ui';
import type { RoundOutcome } from '../server/types';
import type { StandingRow } from './standings';

/** The frozen arena shows the last round, while the headline names the whole match's winner. */
export function finalRoundText(
  winners: readonly Pick<StandingRow, 'slot' | 'name'>[],
  outcome: RoundOutcome,
  L: Translator,
): string {
  if (outcome === 'draw') return L('Final round: drawn — no points');
  if (winners.length === 0) return L('Final round: no points awarded');
  if (winners.length === 1)
    return L('Final round: ball {n} · {name} wins +1', {
      n: (winners[0]?.slot ?? 0) + 1,
      name: winners[0]?.name ?? '',
    });
  return L('Final round: balls {numbers} share +1', {
    numbers: [...winners]
      .sort((a, b) => a.slot - b.slot)
      .map((winner) => winner.slot + 1)
      .join(', '),
  });
}
