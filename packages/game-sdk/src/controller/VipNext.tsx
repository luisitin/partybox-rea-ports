// Audit #13: the VIP's own Next on a phone. The shell hands only the VIP's phone a `skip`; one tap
// locks the button (it remounts with the next screen), so a nervous double tap never skips two
// phases. "Moving on…" while it goes, unless the game words it its own way.
import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '../ui/lang';
import { PrimaryButton } from './PrimaryButton';
import type { PrimaryButtonProps } from './PrimaryButton';
import { STRINGS } from './strings';

export interface VipNextProps {
  skip: () => void;
  label: ReactNode;
  /** Shown once tapped; the SDK's "Moving on…" by default. */
  sentLabel?: string;
  tone?: PrimaryButtonProps['tone'];
}

export function VipNext({ skip, label, sentLabel, tone }: VipNextProps): JSX.Element {
  const L = useT(STRINGS);
  const [sent, setSent] = useState(false);
  return (
    <PrimaryButton
      tone={tone}
      done={sent}
      onClick={() => {
        if (sent) return;
        setSent(true);
        skip();
      }}
    >
      {sent ? (sentLabel ?? L('Moving on…')) : label}
    </PrimaryButton>
  );
}
