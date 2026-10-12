// Lightning Round's TV entry (ADR-050): downloaded by the TV once the game is chosen, never by a phone.
import { lazyFinale } from '@partybox/game-sdk/ui';
import type { GameTvModule } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { shared } from './shared';
import { Tv } from './Tv';

export const tv: GameTvModule = {
  ...shared,
  Tv,
  // T-0210 (ADR-064): each answer opens in a starburst iris. No toss into a question: a lightning
  // round's question is on screen the moment it starts, not a beat later.
  irisInto: ['reveal'],
  // The final-wager board stays on the results stage until someone presses Play again / Home.
  finale: (view) => view.phaseId === 'reveal' && Boolean((view as LightningTvView).round?.final),
  Finale: lazyFinale(() => import('./Finale').then((m) => m.Finale)),
  // I-007 B: while a question (or the wager) is open, whoever has not locked in is ringed.
  stripActive: (view) =>
    view.phaseId === 'question' || view.phaseId === 'wager'
      ? view.players.filter((p) => p.status === 'active' && p.connected).map((p) => p.id)
      : [],
};
