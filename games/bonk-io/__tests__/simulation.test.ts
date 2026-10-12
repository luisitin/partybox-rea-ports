import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOT_SKILLS, createRng, hashString } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { ROUNDS } from '../server/types';
import { ROUND_MS, TICK_MS } from '../server/world';

const requestedGames = Number(process.env.PB_SIM_GAMES ?? 1000);
if (!Number.isInteger(requestedGames) || requestedGames < 1 || requestedGames > 1000)
  throw new Error('PB_SIM_GAMES must be an integer from 1 to 1000');

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

describe('Bonk.io seeded bot matches', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'finishes every %i-seat match with finite complete rankings',
    (players) => {
      const kit = testKit(game, {
        t0: 1_000_000,
        players: testPlayers(players, { bots: players }),
      });
      const ids = testPlayers(players).map((player) => player.id);
      const matchLimit = game.manifest.estimatedMinutes * 60_000 * 2;
      const roundLengths: number[] = [];
      const matchLengths: number[] = [];
      const matchWins = Object.fromEntries(ids.map((id) => [id, 0]));
      const roundWins = Object.fromEntries(ids.map((id) => [id, 0]));
      const skillCounts = { easy: 0, normal: 0, sharp: 0 };
      const roundOutcomes = { 'last-standing': 0, draw: 0, timeout: 0 };
      let sharedMatchWins = 0;

      for (let seed = 1; seed <= requestedGames; seed++) {
        const skill = BOT_SKILLS[(seed - 1) % BOT_SKILLS.length]!;
        skillCounts[skill]++;
        let state = kit.start({ seed });
        const orderRng = createRng(hashString(`bonk-order:${players}:${seed}`));
        const botRng = Object.fromEntries(
          ids.map((id) => [id, createRng(hashString(`bonk-bot:${players}:${seed}:${id}`))]),
        );
        const scoredRounds = new Set<number>();
        let eventTime = kit.t0;
        let turns = 0;

        while (state.phase.id !== 'done') {
          if (++turns > 2000 || eventTime - kit.t0 > matchLimit)
            throw new Error(`non-terminating match: n=${players} seed=${seed} ${state.phase.id}`);

          if (state.phase.id === 'score' && !scoredRounds.has(state.round)) {
            scoredRounds.add(state.round);
            roundLengths.push(state.checked);
            if (state.roundOutcome === null)
              throw new Error(`missing round verdict: n=${players} seed=${seed}`);
            roundOutcomes[state.roundOutcome]++;
            if (state.checked < 0 || state.checked > ROUND_MS)
              throw new Error(`invalid play length: n=${players} seed=${seed} ms=${state.checked}`);
          }

          if (state.phase.id === 'play') {
            // Everyone decides from one public snapshot, before any seat receives a new hold.
            // Bot RNGs are per seat; the separate ordering RNG cannot influence decisions.
            const snapshot = state;
            const now = state.began + state.checked;
            const decisions = ids.flatMap((id) => {
              const input = game.bot.sampleInput(snapshot, id, botRng[id]!, skill);
              if (input === null) return [];
              if (!game.inputSchema.safeParse(input).success)
                throw new Error(`invalid bot action: n=${players} seed=${seed} seat=${id}`);
              return [{ id, input }];
            });
            for (const { id, input } of orderRng.shuffle(decisions))
              state = kit.input(state, id, input, now);
            // There is deliberately no timer or time advance between seat inputs.
          }

          const deadline = state.phase.deadline;
          if (deadline === null || !Number.isFinite(deadline) || deadline <= eventTime)
            throw new Error(`invalid next wake: n=${players} seed=${seed} phase=${state.phase.id}`);
          eventTime = deadline;
          state = kit.timer(state, eventTime);
        }

        const results = game.results(state);
        expect(results, `n=${players} seed=${seed}`).not.toBeNull();
        expect(results!.ranking.map((row) => row.playerId).sort()).toEqual([...ids].sort());
        expect(results!.scores).toEqual(state.scores);
        expect(scoredRounds.size).toBe(ROUNDS);
        expect(state.round).toBe(ROUNDS);
        expect(eventTime - kit.t0).toBeLessThanOrEqual(matchLimit);

        for (const row of results!.ranking) {
          if (
            !Number.isFinite(row.score) ||
            !Number.isInteger(row.score) ||
            row.score < 0 ||
            row.score > ROUNDS ||
            !Number.isInteger(row.rank) ||
            row.rank < 1 ||
            row.rank > players
          )
            throw new Error(`invalid ranking: n=${players} seed=${seed} ${JSON.stringify(row)}`);
          roundWins[row.playerId]! += row.score;
        }
        const rankedWinners = results!.ranking
          .filter((row) => row.rank === 1)
          .map((row) => row.playerId);
        expect([...results!.winnerIds].sort()).toEqual(rankedWinners.sort());
        for (const id of results!.winnerIds) matchWins[id]!++;
        if (results!.winnerIds.length > 1) sharedMatchWins++;
        matchLengths.push(eventTime - kit.t0);
      }

      expect(TICK_MS).toBe(200);
      expect(roundLengths).toHaveLength(requestedGames * ROUNDS);
      const report = {
        players,
        games: requestedGames,
        seedRange: [1, requestedGames],
        skillCounts,
        botDecisionMs: TICK_MS,
        shuffledSeatInputs: true,
        medianRoundMs: median(roundLengths),
        maxRoundMs: Math.max(...roundLengths),
        medianMatchMs: median(matchLengths),
        maxMatchMs: Math.max(...matchLengths),
        matchLimitMs: matchLimit,
        roundOutcomes,
        matchWinsBySeat: matchWins,
        roundWinsBySeat: roundWins,
        sharedMatchWins,
      };
      console.log(`P23 SIM n=${players}: ${JSON.stringify(report)}`);
      if (process.env.PB_RECORD_VERIFY === '1') {
        const folder = new URL(
          '../../../jobs/P23-bonk-io/tools/simulation-results/',
          import.meta.url,
        );
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          new URL(`${players}.json`, folder),
          `${JSON.stringify(report, null, 2)}\n`,
          'utf8',
        );
      }
    },
    300_000,
  );
});
