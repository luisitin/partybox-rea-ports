// The final reveal's footer: your own bet and how it landed, once the TV has shown the verdict.
import type { Translator } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';

export function finalBetLine(view: LightningControllerView, shown: boolean, L: Translator): string {
  const stake = view.myWagerAmount ?? 0;
  if (shown && view.outcome && stake > 0) {
    const delta = Math.abs(view.outcome.delta);
    return view.outcome.correct
      ? L('You bet {stake} and won {delta}', { stake, delta })
      : L('You bet {stake} and lost {delta}', { stake, delta });
  }
  return view.phoneOnly ? L('The bets are in…') : L('The bets are in — look at the TV');
}
