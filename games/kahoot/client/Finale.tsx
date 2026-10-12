// The results stage keeps the final-wager board up (bets, answer, deltas, totals) under the
// winner line until Play again / New game / Home — the game is decided here, and the room wants
// to look at it (owner request 2026-09-15). Rendered by the shell's TvResults through
// clientModule.Finale; `finale()` in index.ts says when this applies.
import type { JSX } from 'react';
import type { GameFinaleProps } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { FinalReveal } from './TvFinal';

export function Finale({ lastView }: GameFinaleProps<LightningTvView>): JSX.Element | null {
  const v = lastView;
  if (!v.round?.final || !v.question || v.correctIndex === undefined) return null;
  return (
    <FinalReveal settled question={v.question} correctIndex={v.correctIndex} rows={v.rows ?? []} />
  );
}
