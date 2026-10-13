import type { GameStateBase } from '@partybox/game-sdk';

export const contractConfig = {
  settingsVariants: [{ halfSeconds: 30 }, { halfSeconds: 120 }],
  lastScores: 'play-last',
  hiddenFromTv: (_state: GameStateBase) => [
    'intents',
    'acceptedSeq',
    'kickArmed',
    'kickHeld',
    'kickReadyAt',
    'lastKickAt',
  ],
  // The public field has no secrets. Raw intent/lease records never travel to a phone.
  hiddenFromController: (_state: GameStateBase, _viewer: string) => ['intents', 'until'],
} satisfies {
  settingsVariants: { halfSeconds: number }[];
  lastScores: string;
  hiddenFromTv: (state: GameStateBase) => string[];
  hiddenFromController: (state: GameStateBase, viewer: string) => string[];
};
