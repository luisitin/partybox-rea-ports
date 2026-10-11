// Compare skill at the real 50ms observation cadence, with the same seeds at each strength.
import { writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/stack-tower/server/index';

const output: {
  skill: string;
  meanHeight: number;
  medianHeight: number;
  minHeight: number;
  maxHeight: number;
}[] = [];
for (const skill of ['easy', 'normal', 'sharp'] as const) {
  const heights: number[] = [];
  for (let seed = 1; seed <= 1000; seed++) {
    const players = testPlayers(2, { bots: 2 });
    const rng = createRng(seed);
    let state = game.init({ players, settings: {}, seed, now: 1000 });
    while (state.phase.id === 'play') {
      const now = state.phase.deadline!;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      for (const p of players) {
        const input = game.bot.sampleInput(state, p.id, rng, skill);
        if (input) state = game.reduce(state, { type: 'input', now, playerId: p.id, input });
      }
    }
    heights.push(...state.towers.map((t) => t.best));
  }
  heights.sort((a, b) => a - b);
  output.push({
    skill,
    meanHeight: heights.reduce((a, b) => a + b, 0) / heights.length,
    medianHeight: heights[1000]!,
    minHeight: heights[0]!,
    maxHeight: heights.at(-1)!,
  });
}
writeFileSync(
  new URL(`../media/bot-${process.env['PB_BOT_LABEL'] ?? 'baseline'}.json`, import.meta.url),
  JSON.stringify(output, null, 2) + '\n',
);
console.log(JSON.stringify(output));
