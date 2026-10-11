// Local-only seeded driver: one game's bots, always interleaved with real deadlines.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import type { State } from '../server/types';

const runs = Number(process.env['SNAKE_SIM_RUNS'] ?? 1000);
const counts = process.env['SNAKE_SIM_ALL_COUNTS'] === '1' ? [2, 3, 4, 5, 6, 7, 8] : [2, 4, 8];
const skills: BotSkill[] = ['easy', 'normal', 'sharp'];

export function simulate(
  count: number,
  seed: number,
  skill: BotSkill,
): { state: State; roundLengths: number[]; maxBytes: number } {
  const rng = createRng(seed);
  let s = game.init({
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      avatarId: 'fox',
      connected: true,
      bot: true,
    })),
    seed,
    now: 1000,
    settings: {},
  });
  const roundLengths: number[] = [];
  let maxBytes = 0;
  let events = 0;
  while (s.phase.id !== 'done' && events++ < 600) {
    const now = s.phase.deadline!;
    if (s.phase.id === 'play') {
      for (const id of Object.keys(s.players)) {
        const input = game.bot.sampleInput(s, id, rng, skill);
        if (input) {
          if (!game.inputSchema.safeParse(input).success) throw new Error('Invalid bot input');
          s = game.reduce(s, { type: 'input', playerId: id, input, now: now - 1 });
        }
      }
    }
    const phase = s.phase.id;
    s = game.reduce(s, { type: 'timer', now, phaseId: s.phase.id, startedAt: s.phase.startedAt });
    if (phase === 'play' && s.phase.id === 'score') {
      roundLengths.push(s.world.elapsed);
      maxBytes = Math.max(maxBytes, JSON.stringify(s).length);
    }
  }
  if (s.phase.id !== 'done') throw new Error(`Nontermination: ${count}/${seed}/${skill}`);
  return { state: s, roundLengths, maxBytes };
}

describe('seeded bot completion', () => {
  it.each(counts)(
    '%i players finish within twice the manifest estimate',
    (count) => {
      const lengths: number[] = [];
      let maxBytes = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const run = simulate(count, seed, skills[(seed - 1) % skills.length]!);
        const result = game.results(run.state)!;
        expect(result.ranking).toHaveLength(count);
        expect(run.state.phase.startedAt - 1000).toBeLessThanOrEqual(
          game.manifest.estimatedMinutes * 120_000,
        );
        expect(Object.values(result.scores).every(Number.isFinite)).toBe(true);
        lengths.push(...run.roundLengths);
        maxBytes = Math.max(maxBytes, run.maxBytes);
      }
      expect(maxBytes).toBeLessThan(256 * 1024);
      lengths.sort((a, b) => a - b);
      const summary = {
        players: count,
        runs,
        skillCounts: skills.map((skill, i) => ({ skill, runs: Math.floor((runs + 2 - i) / 3) })),
        terminated: runs,
        medianRoundMs: lengths[Math.floor(lengths.length / 2)],
        maxStateBytes: maxBytes,
      };
      console.log(JSON.stringify(summary));
      if (process.env['SNAKE_WRITE_REPORTS'] === '1') {
        const dir = 'jobs/P06-snake-royale/media';
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/sim-${count}.json`, JSON.stringify(summary, null, 2) + '\n');
      }
    },
    1_200_000,
  );
});
