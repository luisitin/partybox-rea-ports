import { createRng } from '@partybox/game-sdk';
import { game } from '../../games/haxball/server/index';
import { decision } from '../../games/haxball/server/strategy';
import { start, timer, T0 } from '../../games/haxball/__tests__/helpers';
const i = 2,
  count = 2,
  seed = (Math.imul(i + 1, 2654435761) + count * 1009) >>> 0;
const rng = createRng(seed ^ 0x483be971);
let state = start(count, seed);
state = {
  ...state,
  players: Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, { ...p, bot: true }]),
  ),
};
let batches = 0,
  kicks = 0;
const rows: unknown[] = [];
const react = () => {
  const ids = Object.keys(state.players),
    offset = batches % ids.length;
  const order = [...ids.slice(offset), ...ids.slice(0, offset)];
  const choices = order.map((id) => ({
    id,
    choice: game.bot.sampleInput(state, id, rng, 'sharp'),
  }));
  for (const { id, choice } of choices)
    if (choice)
      state = game.reduce(state, { type: 'input', now: state.clock, playerId: id, input: choice });
};
react();
while (state.phase.id !== 'done' && batches < 500) {
  const before = state;
  const now =
    state.phase.id === 'play'
      ? Math.min(state.clock + 400, state.halfEndsAt)
      : state.phase.deadline!;
  state = timer(state, now);
  let kicked = false;
  for (const [id, intent] of Object.entries(state.intents))
    if (intent.lastKickAt !== null && intent.lastKickAt !== before.intents[id]?.lastKickAt) {
      kicks++;
      kicked = true;
    }
  if (batches % 25 === 0 || kicked)
    rows.push({
      t: state.clock - T0,
      phase: state.phase.id,
      ball: state.ball,
      discs: state.discs.map((d) => ({
        id: d.id,
        team: d.team,
        x: d.x,
        y: d.y,
        vx: d.vx,
        vy: d.vy,
        decision: decision(state, d, 'sharp'),
      })),
      goals: state.goals,
      kicked,
    });
  batches++;
  if (state.phase.id === 'play') react();
}
console.log(
  JSON.stringify(
    { seed, batches, kicks, phase: state.phase.id, goals: state.goals, rows },
    null,
    2,
  ),
);
