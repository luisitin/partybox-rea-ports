// Each beat judges the shared fountain. Cuts are personal; nobody can steal another phone's fruit.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { swipePoints } from '../scoring';
import { TICK_MS, WAVE_MS } from '../types';
import type { Input, Seat, State, Transition } from '../types';
import { crosses, inputSchema, makeWave, targetsAt } from '../world';

export function freshSeat(): Seat {
  return {
    score: 0,
    streak: 0,
    bestCombo: 0,
    cut: [],
    bombed: false,
    hitWave: false,
    strokes: 0,
    lastSeq: -1,
    feedback: '',
    feedbackPoints: 0,
  };
}

export function settle(state: State, now: number): State {
  const checked = Math.min(state.endsAt - state.began, Math.max(state.checked, now - state.began));
  const wave = Math.min(29, Math.floor(checked / WAVE_MS));
  let next = state;
  for (let w = state.wave + 1; w <= wave; w++) {
    const [fruit, rng] = makeWave(next.rng, w);
    const seats = Object.fromEntries(
      Object.entries(next.seats).map(([id, seat]) => [
        id,
        {
          ...seat,
          streak: seat.hitWave && !seat.bombed ? seat.streak + 1 : 0,
          cut: [],
          bombed: false,
          hitWave: false,
          strokes: 0,
          feedback: '',
          feedbackPoints: 0,
        },
      ]),
    );
    next = { ...next, fruit, rng, seats, wave: w };
  }
  return { ...next, checked };
}

export function advancePlay(state: State, now: number, next: Transition): State {
  const settled = settle(state, now);
  if (now >= settled.endsAt) return next(settled, now);
  return nextStep(settled, Math.min(settled.endsAt, settled.began + settled.checked + TICK_MS));
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) ? advancePlay(state, event.now, next) : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected
  )
    return state;
  if (!inputSchema.safeParse(event.input).success || event.now < state.began + state.checked)
    return state;
  const settled = settle(state, event.now);
  if (event.now >= settled.endsAt) return next(settled, event.now);
  const input = event.input;
  const seat = settled.seats[event.playerId]!;
  if (
    input.wave !== settled.wave ||
    input.frame < settled.wave * WAVE_MS ||
    input.frame > settled.checked ||
    settled.checked - input.frame > 1200 ||
    input.seq <= seat.lastSeq ||
    seat.strokes >= 20 ||
    seat.bombed
  )
    return settled;
  const hit = targetsAt(settled.fruit, input.frame, settled.wave).filter(
    (f) => !seat.cut.includes(f.id) && crosses(input.points, f),
  );
  const bombed = hit.some((f) => f.bomb);
  const count = hit.filter((f) => !f.bomb).length;
  const points = bombed || count === 0 ? 0 : swipePoints(count, seat.streak);
  const updated: Seat = {
    ...seat,
    score: seat.score + points,
    streak: bombed ? 0 : seat.streak,
    bestCombo: bombed ? seat.bestCombo : Math.max(seat.bestCombo, count),
    cut: [...seat.cut, ...hit.map((f) => f.id)],
    bombed,
    hitWave: seat.hitWave || (!bombed && count > 0),
    strokes: seat.strokes + 1,
    lastSeq: input.seq,
    feedback: bombed
      ? 'Bomb! Streak reset'
      : count >= 3
        ? `${count} fruit combo!`
        : count > 0
          ? 'Nice slice!'
          : 'Miss — keep swiping',
    feedbackPoints: points,
  };
  return { ...settled, seats: { ...settled.seats, [event.playerId]: updated } };
}
