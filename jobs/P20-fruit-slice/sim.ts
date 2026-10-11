// CPU-light deterministic strategy sim: one opportunity per player at each wave's apex.
// Default: 1000 seeded full games at EVERY count 2..8 and easy/normal/sharp (21,000 games).
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent, InitContext } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../games/fruit-slice/server/index';
import type { Input, State } from '../../games/fruit-slice/server/types';

interface Run {
  playMs: number;
  matchMs: number;
  scores: number[];
  strokes: number;
}
function simulate(players: number, seed: number, skill: BotSkill): Run {
  const now = 1_700_000_000_000;
  const init: InitContext = {
    players: testPlayers(players, { bots: players }),
    settings: {},
    seed,
    now,
  };
  let state = game.init(init);
  const rng = createRng(seed ^ 0x70520);
  const events: GameEvent<Input>[] = [];
  const witnesses: string[] = [];
  let strokes = 0;
  const apply = (event: GameEvent<Input>): void => {
    state = game.reduce(state, event);
    if (seed <= 3) {
      events.push(event);
      witnesses.push(JSON.stringify(state));
    }
  };
  for (let wave = 0; wave < 30; wave++) {
    const at = now + wave * 2000 + 1000;
    apply({ type: 'timer', now: at, phaseId: state.phase.id, startedAt: state.phase.startedAt });
    assert.equal(state.phase.id, 'play');
    for (const player of init.players) {
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (!input) continue;
      assert.equal(
        game.inputSchema.safeParse(input).success,
        true,
        `${players}/${seed}/${skill}: invalid bot input`,
      );
      apply({ type: 'input', now: at, playerId: player.id, input });
      strokes++;
    }
  }
  apply({
    type: 'timer',
    now: state.endsAt,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  assert.equal(state.phase.id, 'score');
  const playMs = state.phase.startedAt - now;
  apply({
    type: 'timer',
    now: state.phase.deadline!,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  const results = game.results(state);
  assert.ok(results, `${players}/${seed}/${skill}: did not terminate`);
  assert.equal(state.phase.id, 'done');
  const matchMs = state.phase.startedAt - now;
  assert.ok(matchMs <= game.manifest.estimatedMinutes * 2 * 60_000);
  assert.deepEqual(
    results.ranking.map((row) => row.playerId).sort(),
    init.players.map((player) => player.id).sort(),
  );
  const scores = Object.values(results.scores);
  assert.ok(scores.every((score) => Number.isFinite(score) && score >= 0));
  if (seed <= 3) {
    let replay: State = game.init(init);
    events.forEach((event, index) => {
      replay = game.reduce(replay, event);
      assert.equal(
        JSON.stringify(replay),
        witnesses[index],
        `${players}/${seed}/${skill}: replay diverged at ${index}`,
      );
    });
  }
  return { playMs, matchMs, scores, strokes };
}

const runsAt = process.argv.indexOf('--seeds');
const seeds = runsAt < 0 ? 1000 : Number(process.argv[runsAt + 1]);
assert.ok(Number.isInteger(seeds) && seeds >= 1 && seeds <= 1000, '--seeds must be 1..1000');
const summaries = [];
for (let players = 2; players <= 8; players++) {
  for (const skill of ['easy', 'normal', 'sharp'] as const) {
    const runs = Array.from({ length: seeds }, (_, index) => simulate(players, index + 1, skill));
    const median = (values: number[]): number => {
      values.sort((a, b) => a - b);
      return (
        (values[Math.floor((values.length - 1) / 2)]! + values[Math.floor(values.length / 2)]!) / 2
      );
    };
    const totalScores = runs.flatMap((run) => run.scores);
    const summary = {
      players,
      skill,
      seeds,
      terminated: runs.length,
      medianPlayMs: median(runs.map((run) => run.playMs)),
      medianMatchMs: median(runs.map((run) => run.matchMs)),
      maxMatchMs: Math.max(...runs.map((run) => run.matchMs)),
      meanScore:
        Math.round(
          (totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length) * 100,
        ) / 100,
      botStrokes: runs.reduce((sum, run) => sum + run.strokes, 0),
    };
    summaries.push(summary);
    console.log(JSON.stringify(summary));
  }
}
const report = {
  command: `pnpm tsx jobs/P20-fruit-slice/sim.ts --seeds ${seeds}`,
  totalGames: summaries.reduce((sum, row) => sum + row.terminated, 0),
  seedRange: [1, seeds],
  strategy: 'one current-view swipe at each two-second wave apex',
  replaySeeds: [1, 2, 3].filter((seed) => seed <= seeds),
  summaries,
};
const outAt = process.argv.indexOf('--out');
if (outAt >= 0) {
  const path = process.argv[outAt + 1];
  assert.ok(path, '--out needs a path');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(
  `PASS ${report.totalGames} seeded games; every player count and all three bot strengths`,
);
