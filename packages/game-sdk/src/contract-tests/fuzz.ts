// Event fuzzing for reducer totality: everything the engine could conceivably send, in every
// phase, from every kind of sender. `reduce` must return a state and never throw.
import type { AnyGameDefinition, GameEvent, GameStateBase } from '@partybox/shared';
import { createRng } from '@partybox/shared';

export function fuzzEvents(
  game: AnyGameDefinition,
  state: GameStateBase,
  seed: number,
): GameEvent<unknown>[] {
  const rng = createRng(seed);
  const now = state.phase.startedAt + 1000;
  const ids = Object.keys(state.players);
  const events: GameEvent<unknown>[] = [];
  const senders = [...ids, 'ghost', '', '__proto__'];
  // Inputs: every player's own sample, every sample replayed by every other sender (including
  // unknown ids), and inputs whose `now` precedes the phase. Schema-INVALID inputs are not sent:
  // the socket layer validates with inputSchema before reduce runs (docs/GAME_CONTRACT.md).
  const samples: unknown[] = [];
  for (const id of ids) {
    try {
      const input = game.bot.sampleInput(state, id, rng);
      if (input !== null) samples.push(input);
    } catch {
      /* a throwing bot is reported by another test */
    }
  }
  for (const sender of senders) {
    for (const input of samples) {
      events.push({ type: 'input', now, playerId: sender, input });
      // ADR-042 stamps the VIP's inputs; a game that reserves an input for the VIP ("That
      // counts", Broken Pencil's veto) must also survive the stamp on any sender, in any phase.
      events.push({ type: 'input', now, playerId: sender, input, vip: true });
    }
    events.push({ type: 'input', now, playerId: sender, input: samples[0] ?? {}, vip: false });
    events.push({ type: 'input', now: now - 5000, playerId: sender, input: samples[0] ?? {} });
  }
  // Timers: current, stale, future, wrong phase, twice.
  events.push({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
  events.push({
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt - 1,
  });
  events.push({ type: 'timer', now, phaseId: 'nope', startedAt: state.phase.startedAt });
  events.push({ type: 'timer', now: 0, phaseId: state.phase.id, startedAt: state.phase.startedAt });
  // Player connectivity for known and unknown ids.
  for (const sender of senders) {
    events.push({ type: 'player', now, playerId: sender, connected: false });
    events.push({ type: 'player', now, playerId: sender, connected: true });
  }
  // Every VIP action, including nonsense orders (resume without pause, double pause).
  for (const action of ['pause', 'pause', 'resume', 'resume', 'skip', 'end'] as const)
    events.push({ type: 'vip', now, action });
  return events;
}

/** Applies each fuzz event to the SAME base state (not chained) and returns any failures. */
export function fuzzOnce(game: AnyGameDefinition, state: GameStateBase, seed: number): string[] {
  const failures: string[] = [];
  for (const event of fuzzEvents(game, state, seed)) {
    try {
      const next = game.reduce(state, event);
      if (!next || typeof next !== 'object' || typeof next.phase?.id !== 'string')
        failures.push(`reduce returned a non-state for ${JSON.stringify(event)}`);
      else if (!game.phases.includes(next.phase.id))
        failures.push(`reduce entered undeclared phase "${next.phase.id}" via ${event.type}`);
    } catch (err) {
      failures.push(`reduce threw on ${JSON.stringify(event).slice(0, 160)}: ${String(err)}`);
    }
  }
  return failures;
}
