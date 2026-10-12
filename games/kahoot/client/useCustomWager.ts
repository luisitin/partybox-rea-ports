import { useEffect, useState } from 'react';
import type { LightningControllerView } from '../server/index';

/** A custom send locks briefly, but only the server can confirm the stake. */
export function useCustomWager(view: LightningControllerView): {
  pending: boolean;
  failed: boolean;
  place: (amount: number) => void;
} {
  const key = `${view.phaseId}:${view.deadline}`;
  const [sent, setSent] = useState<{ key: string; amount: number; failed: boolean } | null>(null);
  const echoed = view.myWagerAmount !== undefined;
  if (sent !== null && (sent.key !== key || echoed)) setSent(null);
  const current = sent?.key === key && !echoed ? sent : null;
  const pending = current !== null && !current.failed;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(
      () => setSent((s) => (s?.key === key ? { ...s, failed: true } : s)),
      4000,
    );
    return () => clearTimeout(timer);
  }, [key, pending]);
  return {
    pending,
    failed: current?.failed ?? false,
    place: (amount) => setSent({ key, amount, failed: false }),
  };
}
