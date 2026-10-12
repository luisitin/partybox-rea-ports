// Real SDK events only: discussion timers open voting before bots are sampled.
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { QuizMode, State } from '../server/types';

export type GroupMode = Exclude<QuizMode, 'solo'>;
export const GROUP_MODES: GroupMode[] = ['teams', 'tv-vote'];
export const STRENGTHS = ['easy', 'normal', 'sharp'] as const;
export const NEW_PACKS = ['sports', 'music', 'custom'] as const;

export function simulateTeamMatch(players: number, seed: number, mode: GroupMode) {
  const rng = createRng(seed);
  const strength = STRENGTHS[Math.floor((seed - 1) / 3) % STRENGTHS.length]!;
  const pack = NEW_PACKS[(seed - 1) % NEW_PACKS.length]!;
  const maximum = seed % 10 === 0;
  const requestedRounds = maximum ? 20 : 10;
  let state = game.init({
    players: testPlayers(players, { bots: players }),
    settings: {
      mode,
      pack,
      rounds: requestedRounds,
      seconds: maximum ? 30 : 20,
      talkSeconds: maximum ? 20 : 5,
      teamCount: maximum ? 4 : 2 + (seed % 3),
    },
    seed,
    now: 0,
  });
  let now = 0;
  let roundBegan = 0;
  let closedRounds = 0;
  const roundMs: number[] = [];
  const answerMs: number[] = [];
  const tapMs: number[] = [];
  let events = 0;
  const observe = (before: State, after: State) => {
    if (before.phase.id === 'question' && after.phase.id === 'reveal') {
      answerMs.push(now - before.openedAt);
      tapMs.push(...Object.values(after.answers).map((answer) => answer.elapsed));
    }
    if (
      after.round > before.round ||
      (before.phase.id === 'reveal' && after.phase.id === 'podium')
    ) {
      roundMs.push(now - roundBegan);
      roundBegan = now;
      closedRounds++;
    }
  };
  for (; events < 4000 && state.phase.id !== 'done'; events++) {
    if (state.phase.deadline === null || state.phase.paused)
      throw new Error(`Unexpected untimed/paused simulation phase ${state.phase.id}`);
    if (state.phase.id === 'question') {
      now = Math.min(state.phase.deadline, now + rng.int(300, 1200));
      if (now < state.phase.deadline) {
        for (const player of rng.shuffle(Object.values(state.players))) {
          const input = game.bot.sampleInput(state, player.id, rng, strength);
          if (input !== null) {
            if (!game.inputSchema.safeParse(input).success)
              throw new Error('Invalid group bot input');
            const before = state;
            state = game.reduce(state, { type: 'input', playerId: player.id, now, input });
            observe(before, state);
          }
          if (state.phase.id !== 'question') break;
        }
      }
      if (state.phase.id !== 'question' || now !== state.phase.deadline) continue;
    } else {
      now = state.phase.deadline;
    }
    const before = state;
    state = game.reduce(state, {
      type: 'timer',
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
      now,
    });
    observe(before, state);
  }
  return {
    state,
    elapsed: now,
    roundMs,
    answerMs,
    tapMs,
    events,
    closedRounds,
    strength,
    pack,
    maximum,
    requestedRounds,
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
