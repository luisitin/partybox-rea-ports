// One process, no browser: 1,000 matches at every legal count and every skill.
// pnpm tsx jobs/P12-flappy-lanes/tools/simulate.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent } from '@partybox/game-sdk';
import { game } from '../../../games/flappy-lanes/server/index';
import type { State } from '../../../games/flappy-lanes/server/types';
import type { Input } from '../../../games/flappy-lanes/server/world';

const runs = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(runs) || runs < 1) throw new Error('Run count must be a positive integer');
const T0 = 1_000_000;
const skills: BotSkill[] = ['easy', 'normal', 'sharp'];
const budget = game.manifest.estimatedMinutes * 2 * 60_000;
const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  return (
    (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2
  );
};

function match(
  players: number,
  seed: number,
  skill: BotSkill,
): { ms: number; rounds: number[]; flaps: number; gates: number[] } {
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const rngs = ids.map((_, i) => createRng(seed * 31 + i * 997));
  let state: State = game.init({
    now: T0,
    seed,
    settings: { rounds: 3 },
    players: ids.map((id) => ({ id, name: id, avatarId: 'fox', connected: true, bot: true })),
  });
  const rounds: number[] = [];
  const gates: number[] = [];
  let flaps = 0;
  let now = T0;
  let events = 0;
  const apply = (event: GameEvent<Input>): void => {
    const phase = state.phase.id;
    state = game.reduce(state, event);
    events++;
    if (phase === 'play' && state.phase.id === 'score') {
      rounds.push(state.world.checked);
      gates.push(...state.world.birds.map((b) => b.passed));
    }
  };
  while (!game.results(state)) {
    if (now - T0 > budget || events > 20_000)
      throw new Error(`stuck n=${players} seed=${seed} skill=${skill}`);
    if (state.phase.deadline === null) throw new Error(`no deadline in ${state.phase.id}`);
    now = state.phase.deadline;
    if (state.phase.id === 'play') {
      // Sample all seats from one judged state, then deliver at the same beat.
      // Seat ordering can never give later seats a look at a later course.
      const inputs = ids.map((id, i) => game.bot.sampleInput(state, id, rngs[i]!, skill));
      for (const [i, input] of inputs.entries()) {
        if (!input || state.phase.id !== 'play') continue;
        if (!game.inputSchema.safeParse(input).success) throw new Error('Schema-invalid bot input');
        apply({ type: 'input', now, playerId: ids[i]!, input });
        flaps++;
      }
    }
    apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
  }
  const results = game.results(state)!;
  if (results.ranking.length !== players || results.winnerIds.length < 1)
    throw new Error('Incomplete results');
  if (ids.some((id) => !Number.isFinite(results.scores[id])))
    throw new Error('Nonfinite/missing score');
  if (rounds.length !== 3) throw new Error('Missing round samples');
  return { ms: now - T0, rounds, flaps, gates };
}

const rows = [];
for (const skill of skills) {
  for (let players = 2; players <= 8; players++) {
    const matches = Array.from({ length: runs }, (_, i) => match(players, i + 1, skill));
    const row = {
      skill,
      players,
      runs,
      terminated: matches.length,
      medianRoundMs: median(matches.flatMap((r) => r.rounds)),
      medianMatchMs: median(matches.map((r) => r.ms)),
      maximumMatchMs: Math.max(...matches.map((r) => r.ms)),
      medianClearedGates: median(matches.flatMap((r) => r.gates)),
      medianFlaps: median(matches.map((r) => r.flaps)),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
const target = fileURLToPath(new URL('../simulation.json', import.meta.url));
writeFileSync(
  target,
  `${JSON.stringify({ seedRange: [1, runs], budgetMs: budget, rows }, null, 2)}\n`,
  'utf8',
);
