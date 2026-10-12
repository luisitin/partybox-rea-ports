import { expect, it } from 'vitest';
import { game } from '../server/index';
import { questionById } from '../server/content';
import { input, phone, timer, tv } from './helpers';

it('freezes the team correctness gauge at scoring and never sends it before the reveal', () => {
  let state = game.init({
    players: Array.from({ length: 4 }, (_, n) => ({
      id: `p${n}`,
      name: `Guest ${n}`,
      avatarId: 'fox',
      connected: true,
    })),
    settings: { quizMode: 'teams', questions: 5, answerSeconds: 30, teamCount: 2 },
    now: 100_000,
    seed: 41,
  });
  state = timer(timer(state));
  state = {
    ...state,
    teams: [
      { id: 'team-1', name: 'Team 1', members: ['p0', 'p1'] },
      { id: 'team-2', name: 'Team 2', members: ['p2', 'p3'] },
    ],
    teamScores: { 'team-1': 0, 'team-2': 0 },
  };
  const question = questionById(state.questionIds[state.index]!, state.contentLang)!;
  const stamp = phone(state, 'p0').answerStamp!;
  const at = state.phase.startedAt;
  state = input(state, 'p0', { type: 'answer', ...stamp, index: question.answerIndex }, at + 100);
  expect(JSON.stringify(tv(state))).not.toContain('correctPercent');
  expect(JSON.stringify(phone(state, 'p0'))).not.toContain('correctPercent');
  state = timer(state); // p1's connected miss contributes zero to the team mean.
  expect(tv(state).group?.teams.find((team) => team.id === 'team-1')?.correctPercent).toBe(50);
  const score = state.teamScores!['team-1'];
  state = game.reduce(state, {
    type: 'player',
    playerId: 'p1',
    connected: false,
    now: state.phase.startedAt + 200,
  });
  expect(tv(state).group?.teams.find((team) => team.id === 'team-1')?.correctPercent).toBe(50);
  expect(state.teamScores!['team-1']).toBe(score);
  state = timer(state);
  expect(state.phase.id).toBe('talk');
  expect(JSON.stringify(tv(state))).not.toContain('correctPercent');
});
