// Real synchronous host cadence, all three bot strengths; never launches a browser.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

describe('1,000 seeded bot races per strength and player count', () => {
  it('all 9,000 terminate within estimate × 2 and rank every original player', () => {
    const rows: {
      skill: string;
      players: number;
      runs: number;
      medianRoundMs: number;
      maxMatchMs: number;
      medianDepth: number;
    }[] = [];
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      for (const n of [2, 4, 8]) {
        const lengths: number[] = [],
          depths: number[] = [];
        let max = 0;
        for (let seed = 1; seed <= 1000; seed++) {
          const players = testPlayers(n, { bots: n });
          const rng = createRng(seed);
          let s = game.init({ players, settings: {}, seed, now: 1000 });
          let events = 0;
          while (game.results(s) === null && events < 10_000) {
            if (s.phase.deadline === null) throw new Error(`stalled ${skill}/${n}/${seed}`);
            const now = s.phase.deadline;
            if (s.phase.id === 'play')
              for (const p of players) {
                const input = game.bot.sampleInput(s, p.id, rng, skill);
                if (input !== null) {
                  if (!game.inputSchema.safeParse(input).success)
                    throw new Error('invalid bot input');
                  s = game.reduce(s, { type: 'input', now: now - 1, playerId: p.id, input });
                  events++;
                }
              }
            s = game.reduce(s, {
              type: 'timer',
              now,
              phaseId: s.phase.id,
              startedAt: s.phase.startedAt,
            });
            events++;
          }
          const result = game.results(s);
          if (!result || s.phase.startedAt - 1000 > game.manifest.estimatedMinutes * 120_000)
            throw new Error(`failed termination ${skill}/${n}/${seed}`);
          if (result.ranking.length !== n || result.ranking.some((r) => !Number.isFinite(r.score)))
            throw new Error('invalid results');
          max = Math.max(max, s.phase.startedAt - 1000);
          lengths.push(s.checked);
          depths.push(...s.runners.map((r) => r.best));
        }
        lengths.sort((a, b) => a - b);
        depths.sort((a, b) => a - b);
        const row = {
          skill,
          players: n,
          runs: 1000,
          medianRoundMs: (lengths[499]! + lengths[500]!) / 2,
          maxMatchMs: max,
          medianDepth: depths[Math.floor(depths.length / 2)]!,
        };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    expect(rows).toHaveLength(9);
    writeFileSync('jobs/P17-helix-drop/SIMULATION.json', JSON.stringify(rows, null, 2) + '\n');
  }, 180_000);
});
