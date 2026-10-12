// I-589 (the owner's note on option B): "a bit more time at the standings page with a 'next
// question' button the vip or tv can click to go next. If a new button is added then the
// 'skip/next' should be hidden in this game." A regular reveal carries `next` (and the envelope's
// `vipSkipHidden`, so the host bar and the ★ menu drop their generic Skip / Next); the button
// arrives with the standings (STANDINGS_AT_MS in) on the TV stage and on the VIP's phone. Both send the
// engine's VIP skip; one tap locks the button, so a double tap never skips two phases. On the TV it
// takes the header's topic slot (right of "Question n of m"): at sixteen players the stage has no
// free row for it above the host bar, and the header's line keeps its height.
import { useState } from 'react';
import type { JSX } from 'react';
import { useT, VipNext } from '@partybox/game-sdk/ui';
import type { Translator } from '@partybox/game-sdk/ui';
import type { RevealNext } from '../server/views';
import { STRINGS } from './strings';
import { STANDINGS_AT_MS } from './timing';
import { useRevealBeat } from './reveal-clock';
import styles from './NextStep.module.css';

function nextLabel(next: RevealNext, L: Translator): string {
  return next === 'wager' ? L('On to the wager') : L('Next question');
}

/** True once the standings are up: STANDINGS_AT_MS after the reveal began on the room's clock
 *  (`revealAt`), keyed by its deadline — a reloaded TV or phone does not wait the race out again. */
export function useStandingsUp(
  key: number | null,
  revealAt: number | undefined,
  paused = false,
  clockHeldAt?: number,
): boolean {
  return useRevealBeat(key, revealAt, STANDINGS_AT_MS, paused, clockHeldAt);
}

/** The TV stage's Next: a hint that says whose phone moves the room on (review 6c24ba (4): the
 *  accent chip read as a button nobody on the sofa could press); still clickable for a host who
 *  runs the party from the TV (ADR-031). Shown once the standings are up (useStandingsUp). */
export function TvNext({
  skip,
  vipName,
}: {
  next: RevealNext;
  skip: () => void;
  /** Review 6c24ba (4): the TV says whose phone moves the room on (Wisecrack's scores kicker). */
  vipName: string | undefined;
}): JSX.Element {
  const L = useT(STRINGS);
  const [sent, setSent] = useState(false);
  return (
    <button
      type="button"
      className={styles.nextButton}
      disabled={sent}
      onClick={() => {
        setSent(true);
        skip();
      }}
    >
      {sent
        ? L('Moving on…')
        : vipName
          ? L("Next on {name}'s phone", { name: vipName })
          : L("Next on the VIP's phone")}
    </button>
  );
}

/** The VIP's phone: the same Next, under the outcome card (other phones get no `skip`). */
export function PhoneNext({
  next,
  skip,
  phaseKey,
  revealAt,
  paused,
  clockHeldAt,
}: {
  next: RevealNext | undefined;
  skip: (() => void) | undefined;
  phaseKey: number | null;
  revealAt: number | undefined;
  paused?: boolean;
  clockHeldAt?: number;
}): JSX.Element | null {
  const L = useT(STRINGS);
  const up = useStandingsUp(phaseKey, revealAt, paused, clockHeldAt);
  if (!next || !skip || !up) return null;
  return <VipNext tone="neutral" skip={skip} label={nextLabel(next, L)} />;
}
