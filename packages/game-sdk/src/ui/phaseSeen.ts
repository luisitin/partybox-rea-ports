// Which phase instance a countdown (the TV Timer, the DeadlineBar) is showing. The view names it by its
// phase id and its engine start (`phaseAt`, ADR-097). A new instance starts a new countdown, even
// a VIP skip into a phase with the same id while the game is paused (T-0701 F4). A VIP resume keeps the
// instance and moves the deadline by the paused span, so a deadline that moves inside one instance counts
// as a resume only when the last view was paused; otherwise it is a beat (a nextStep) and starts afresh.
// Pure: the component keeps the result in state and re-renders when it changes.

export interface PhaseSeen {
  /** The phase id this countdown was started for (`phaseKey`). */
  phaseKey: string;
  /** The engine start of that instance (`phaseAt`). */
  startedAt: number;
  deadline: number | null;
  /** The paused flag of the last view: tells a resume's moved deadline from a beat. */
  paused: boolean;
  /** Server time this phase instance started counting. A resume moves it by the same delta as the
   *  deadline, so the phase length (`deadline - at`) and the fill hold across a pause. */
  at: number;
  /** Counts the phase instances: a keyed element remounts on each one (a fresh full bar). */
  gen: number;
}

export function startSeen(
  phaseKey: string,
  startedAt: number,
  deadline: number | null,
  paused: boolean,
  now: number,
): PhaseSeen {
  return { phaseKey, startedAt, deadline, paused, at: now, gen: 0 };
}

/** The phase instance after this view. Returns `prev` itself when nothing that matters changed. */
export function nextSeen(
  prev: PhaseSeen,
  phaseKey: string,
  startedAt: number,
  deadline: number | null,
  paused: boolean,
  now: number,
): PhaseSeen {
  const newInstance =
    prev.phaseKey !== phaseKey ||
    prev.startedAt !== startedAt ||
    (prev.deadline !== deadline && !prev.paused);
  if (newInstance) return { phaseKey, startedAt, deadline, paused, at: now, gen: prev.gen + 1 };
  if (prev.deadline === deadline) return prev.paused === paused ? prev : { ...prev, paused };
  // A resume: the deadline moved by the paused span, so the start moves by the same delta.
  const at =
    prev.deadline !== null && deadline !== null ? prev.at + (deadline - prev.deadline) : now;
  return { ...prev, deadline, paused, at };
}
