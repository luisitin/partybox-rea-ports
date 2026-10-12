// Reveal cues use the held server clock, and never replay a beat after a reload or resume.
import { useEffect, useRef } from 'react';
import { buzz, useServerNow, useSound } from '@partybox/game-sdk/ui';
import type { LightningControllerView, LightningTvView } from '../server/views';
import { FINAL_REVEAL_HOLD_MS, REVEAL_BEAT_MS, standingsDelay } from './timing';

export interface RevealCueClock {
  /** Stable across pause/resume; null outside the relevant reveal. */
  key: string | null;
  revealAt: number | undefined;
  paused: boolean;
  clockHeldAt?: number;
}

function useRevealCue(clock: RevealCueClock, atMs: number, fire: () => void): void {
  const now = useServerNow(100, clock.paused, clock.clockHeldAt);
  const fired = useRef<{ key: string | null; done: boolean }>({ key: null, done: false });
  const { key, revealAt, paused } = clock;
  useEffect(() => {
    const elapsed = revealAt === undefined ? 0 : Math.max(0, now - revealAt);
    if (fired.current.key !== key) {
      // First seeing an already-past beat means this is a late mount/push: stay quiet.
      fired.current = { key, done: elapsed >= atMs };
    }
    if (key === null || revealAt === undefined || paused || elapsed < atMs || fired.current.done)
      return;
    fired.current.done = true;
    fire();
  }, [key, revealAt, paused, now, atMs, fire]);
}

export function useStandingsCue(view: LightningTvView): void {
  const play = useSound();
  useRevealCue(
    {
      key:
        view.phaseId === 'reveal' &&
        !view.round?.final &&
        !(view.quizMode === 'classic' && view.round?.last)
          ? (view.question?.id ?? null)
          : null,
      revealAt: view.revealAt,
      paused: view.paused,
      clockHeldAt: view.clockHeldAt,
    },
    standingsDelay(view.revealAt, view.leaderboardAt),
    () => play('tally'),
  );
}

export function useVerdictCue(view: LightningControllerView): void {
  const play = useSound();
  const correct = view.outcome?.correct;
  useRevealCue(
    {
      key:
        view.phaseId === 'reveal' && view.me.role === 'player' && correct !== undefined
          ? (view.question?.id ?? null)
          : null,
      revealAt: view.revealAt,
      paused: view.paused,
      clockHeldAt: view.clockHeldAt,
    },
    view.round?.final ? FINAL_REVEAL_HOLD_MS : REVEAL_BEAT_MS,
    () => {
      play(correct ? 'correct' : 'wrong');
      buzz(correct ? [30, 40, 30] : 120);
    },
  );
}
