// The reduce skeleton every game repeats (audit #11): a player event, a made reading, the VIP's
// pause / resume / skip / end, the paused guard, then the phase on stage. A game hands over its
// parts; the order is fixed, so a new game gets it right by construction. Pure.
import type { GameEvent, GameStateBase } from '@partybox/shared';
import { applyVip, setConnected } from './timer';
import type { PlayerEvent } from './timer';

/** A phase's exit (what its deadline — or a VIP skip — does). */
export type Transition<S> = (state: S, now: number) => S;

/** One phase file's reducer: inputs and timers while that phase is on stage and not paused. */
export type PhaseReducer<S, I> = (state: S, event: GameEvent<I>, next: Transition<S>) => S;

export interface ReduceParts<S, I> {
  /** Each phase id's reducer; a phase without one ignores inputs and timers. */
  phases: Readonly<Record<string, PhaseReducer<S, I>>>;
  /** What a deadline or a VIP skip does in each phase (handed to the phase reducers as `next`). */
  advance: Transition<S>;
  /** The VIP's skip when it is not simply the phase's exit (a card at a time, a step at a time);
   *  default `advance`. */
  skip?: Transition<S>;
  /** The VIP's end: straight to the terminal phase. */
  end: Transition<S>;
  /** A drop, a return or a leave (default `setConnected`; see `onPlayerEvent`). */
  onPlayer?: (state: S, event: PlayerEvent) => S;
  /** A reading the game asked for is made (`ms`, or -1: failed); without it, ignored. */
  onSpeech?: (state: S, key: string, ms: number, now: number) => S;
  /** T-0159: the host's reader started a reading (its `onSpeech` follows); without it, ignored. */
  onSpeechStart?: (state: S, key: string, now: number) => S;
  /** Readies the state for an event past the player and speech steps, before the VIP sees it (a
   *  claim credited before a skip, a day's clock shifted before a resume, drops expired); what it
   *  returns is what the VIP, the paused guard and the phase see. */
  prepare?: (state: S, event: GameEvent<I>) => S;
  /** After the VIP's pause / resume / skip / end: `before` is the state the event found (not
   *  `prepare`'s) — a resume's re-check, a game's own clocks. Default: the VIP's result as is. */
  afterVip?: (before: S, after: S, event: GameEvent<I>) => S;
  /** A player's input while the VIP has the phase paused (default: dropped). Only for inputs that
   *  change what the room shows and move neither the phase nor a clock: a card-style sheet closed
   *  on a phone (T-0774). The resume reads what it left (`afterVip`). Timers never reach it. */
  whilePaused?: (state: S, event: Extract<GameEvent<I>, { type: 'input' }>) => S;
}

/**
 * A game's `reduce` from its parts, in the one order: player → speech → VIP → paused → phase.
 * While paused, inputs are ignored (but `whilePaused` takes its own) and timers wait (the VIP
 * resume moves the deadline on).
 */
export function composeReduce<S extends GameStateBase, I>(
  parts: ReduceParts<S, I>,
): (state: S, event: GameEvent<I>) => S {
  const {
    phases,
    advance,
    skip = advance,
    end,
    onPlayer = setConnected,
    onSpeech,
    onSpeechStart,
    prepare,
    afterVip,
    whilePaused,
  } = parts;
  const run = (state: S, event: GameEvent<I>): S => {
    if (event.type === 'player') return onPlayer(state, event);
    if (event.type === 'speech')
      return onSpeech ? onSpeech(state, event.key, event.ms, event.now) : state;
    if (event.type === 'speechStart')
      return onSpeechStart ? onSpeechStart(state, event.key, event.now) : state;
    // A skip sent while paused is a resume, then the skip. Each runs the whole reduce, so clocks
    // move past the pause (prepare, the unpause, afterVip) before the skip judges the round.
    if (event.type === 'vip' && event.action === 'skip' && state.phase.paused) {
      const resumed = run(state, { ...event, action: 'resume' });
      // A resume that already moved the phase on (a re-check) leaves the skip nothing to skip.
      const moved =
        resumed.phase.id !== state.phase.id || resumed.phase.startedAt !== state.phase.startedAt;
      return moved ? resumed : run(resumed, event);
    }
    const ready = prepare ? prepare(state, event) : state;
    const vip = applyVip(ready, event, { skip, end });
    if (vip) return afterVip ? afterVip(state, vip, event) : vip;
    if (ready.phase.paused) {
      return whilePaused && event.type === 'input' ? whilePaused(ready, event) : ready;
    }
    const phase = Object.hasOwn(phases, ready.phase.id) ? phases[ready.phase.id] : undefined;
    return phase ? phase(ready, event, advance) : ready;
  };
  return run;
}
