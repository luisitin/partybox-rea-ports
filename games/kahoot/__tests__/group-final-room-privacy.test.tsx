// Final room totals must not be reconstructible from their prior bank and shared outcome.
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { game } from '../server/index';
import { questionById } from '../server/content';
import type { GroupMode, State } from '../server/types';
import { input, phone, timer, tv } from './helpers';

const T0 = 2_000_000_000_000;
const PLAYERS: PlayerInfo[] = Array.from({ length: 8 }, (_, i) => ({
  id: 'final-private-' + i,
  name: 'Player ' + i,
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
afterEach(() => vi.useRealTimers());

function start(mode: GroupMode): State {
  const state = game.init({
    players: PLAYERS,
    seed: 41,
    now: T0,
    settings: {
      quizMode: mode,
      classicPack: 'sports',
      questions: 5,
      answerSeconds: 30,
      talkSeconds: 5,
      teamCount: 4,
    },
  });
  // Distinctive canaries prove the final client uses a generic identity, not a hidden row.
  return {
    ...state,
    teams: state.teams!.map((team, i) => ({ ...team, name: 'Hidden final group name ' + i })),
  };
}
function question(state: State): State {
  for (let guard = 0; guard < 12 && state.phase.id !== 'question'; guard++) state = timer(state);
  if (state.phase.id !== 'question') throw new Error('Fixture must reach the next live question');
  return state;
}
function answered(state: State): State {
  state = question(state);
  const q = questionById(state.questionIds[state.index]!, state.contentLang);
  if (!q) throw new Error('Privacy fixture requires an actual authored question');
  for (const [i, player] of PLAYERS.entries()) {
    const stamp = phone(state, player.id).answerStamp;
    if (!stamp) throw new Error('Every final answer retains its canonical stamp');
    const wrongRoomVote = state.settings.quizMode === 'tv-vote' && i >= 5;
    state = input(
      state,
      player.id,
      { type: 'answer', ...stamp, index: wrongRoomVote ? (q.answerIndex + 1) % 4 : q.answerIndex },
      state.phase.startedAt + (i === 0 ? 300 : 1_200 + i * 20),
    );
  }
  if (state.phase.id === 'question') state = timer(state);
  if (state.phase.id !== 'reveal') throw new Error('Answers must enter the scored reveal');
  return state;
}
function finalFixture(mode: GroupMode): { before: State; final: State } {
  let state = start(mode);
  for (let round = 0; round < 4; round++) state = answered(state);
  const before = question(state);
  if (before.index !== 4) throw new Error('Fixture must reach the fifth/final ordinary question');
  return { before, final: answered(before) };
}
function paint(state: State, id: string): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  // The live final VIP window is inside the reveal, after every public reading beat.
  vi.setSystemTime(state.phase.deadline! - 100);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      <PhoneOnlyProvider value={false}>
        <Controller
          view={{ ...phone(state, id), vip: null }}
          me={state.players[id]!}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}
function footer(html: string): string {
  const bar = html.match(/<div[^>]*data-group-player-bar="true"[\s\S]*?<\/div>/)?.[0];
  if (!bar) throw new Error('Beside-TV final receipt needs its identity footer');
  return bar;
}

describe('hidden final room score has no numeric outcome side channel', () => {
  it('withholds a nonzero shared final gain from every controller while preserving correctness', () => {
    const { before, final } = finalFixture('tv-vote');
    const bank = before.teamScores!.room!;
    const gain = final.teamGains!.room!;
    const total = final.teamScores!.room!;
    expect(bank).toBeGreaterThan(0);
    expect(gain).toBeGreaterThan(0);
    expect(total).toBe(bank + gain);
    expect(tv(final).group?.teams).toEqual([]);
    expect(tv(final).players.every((player) => !Object.hasOwn(player, 'score'))).toBe(true);
    for (const player of PLAYERS) {
      const own = phone(final, player.id);
      expect(own.myScore).toBe(bank);
      expect(own.outcome).toMatchObject({ correct: true, answered: true, delta: 0 });
      expect(own.outcome).not.toHaveProperty('base');
      expect(own.outcome).not.toHaveProperty('bonus');
      expect(own.myScore + own.outcome!.delta).not.toBe(total);
      expect(own.group?.teams).toEqual([]);
      expect(own).not.toHaveProperty('myRank');
      expect(own).not.toHaveProperty('standings');
    }
  });

  it('shows a truthful final room verdict and placeholder without hidden name, gain, rank or total', () => {
    const { final } = finalFixture('tv-vote');
    for (const player of [PLAYERS[0]!, PLAYERS[7]!]) {
      const html = paint(final, player.id);
      expect(html).toContain('The room got it right!');
      expect(html).toContain('Your vote:');
      expect(html).toContain('Room score after the podium');
      expect(html).not.toContain('Hidden final group name');
      expect(html).not.toContain('The room is in place');
      expect(html).not.toContain('Room results');
      expect(html).not.toContain('+' + final.teamGains!.room! + ' points');
      expect(html).not.toContain(final.teamScores!.room! + ' total');
      expect(footer(html)).not.toMatch(/aria-label="\d+ room points"/);
      expect(footer(html)).not.toContain('>' + final.teamScores!.room! + '<');
    }
  });

  it('retains public gain and speed/streak fields on nonfinal room reveals', () => {
    const state = answered(start('tv-vote'));
    expect(tv(state).round?.last).toBe(false);
    for (const player of PLAYERS) {
      const own = phone(state, player.id);
      expect(own.outcome!.delta).toBe(state.teamGains!.room);
      expect(own.outcome!.delta).toBeGreaterThan(0);
      expect(own.outcome).toHaveProperty('base');
      expect(own.outcome).toHaveProperty('bonus');
      expect(own.outcome!.base! + own.outcome!.bonus!).toBe(own.outcome!.delta);
      expect(own.group?.teams[0]?.score).toBe(state.teamScores!.room);
    }
    const html = paint(state, PLAYERS[0]!.id);
    expect(html).toContain('+' + state.teamGains!.room! + ' points');
    expect(footer(html)).toContain('aria-label="' + state.teamScores!.room! + ' room points"');
    expect(html).not.toContain('Room score after the podium');
  });

  it('retains final Teams personal feedback while keeping shared team receipts and totals hidden', () => {
    const { before, final } = finalFixture('teams');
    const id = PLAYERS[0]!.id;
    const team = final.teams!.find((candidate) => candidate.members.includes(id))!;
    const own = phone(final, id);
    expect(own.myScore).toBe(before.teamScores![team.id]);
    expect(own.outcome!.delta).toBe(final.lastDelta[id]);
    expect(own.outcome!.delta).toBeGreaterThan(0);
    expect(own.outcome!.base).toBeGreaterThan(0);
    expect(own.outcome!.bonus).toBeGreaterThan(0);
    expect(own.outcome!.base! + own.outcome!.bonus!).toBe(own.outcome!.delta);
    expect(own.group?.teams).toEqual([]);
    expect(own).not.toHaveProperty('myRank');
    const html = paint(final, id);
    expect(html).toContain('+' + own.outcome!.delta + ' personal points');
    expect(html).toContain('Team score after the podium');
    expect(html).not.toContain('Hidden final group name');
    expect(html).not.toContain('Your team is in place');
    expect(html).not.toContain('Team results');
    expect(footer(html)).not.toMatch(/aria-label="\d+ team points"/);
  });
});
