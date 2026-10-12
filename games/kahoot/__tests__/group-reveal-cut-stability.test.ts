// Presence updates change identity/status, never the scored reveal's reading cuts.
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { questionById } from '../server/content';
import { groupRevealTiming } from '../server/pacing';
import type { State } from '../server/types';
import { input, phone, timer, tv } from './helpers';

const T0 = 2_000_000_000_000;
const kit = testKit(game, { t0: T0 });
const missingId = 'cut-7';
const players = Array.from({ length: 8 }, (_, i) => ({
  id: 'cut-' + i,
  name: 'One two three four',
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));

function reveal(): State {
  let state = game.init({
    players,
    seed: 41,
    now: T0,
    settings: {
      quizMode: 'teams',
      classicPack: 'sports',
      questions: 5,
      teamCount: 4,
      answerSeconds: 30,
      talkSeconds: 5,
    },
  });
  for (let guard = 0; guard < 4 && state.phase.id !== 'question'; guard++) state = timer(state);
  if (state.phase.id !== 'question') throw new Error('Fixture needs a live stamped question');
  const q = questionById(state.questionIds[state.index]!, state.contentLang);
  if (!q) throw new Error('Fixture needs an actual authored question');
  for (const [i, player] of players.slice(0, 7).entries()) {
    const stamp = phone(state, player.id).answerStamp;
    if (!stamp) throw new Error('Every correct answer must carry the current stamp');
    state = input(
      state,
      player.id,
      { type: 'answer', ...stamp, index: q.answerIndex },
      state.phase.startedAt + 300 + i * 20,
    );
  }
  state = timer(state);
  expect(state.phase.id).toBe('reveal');
  expect(Object.keys(state.picks)).toHaveLength(7);
  expect(state.picks).not.toHaveProperty(missingId);
  expect(phone(state, missingId).outcome?.answered).toBe(false);
  expect(state.groupRevealBeats).toBeDefined();
  expect(tv(state).round?.last).toBe(false);
  return state;
}
function pickCuts(view: ReturnType<typeof tv> | ReturnType<typeof phone>) {
  return {
    revealAt: view.revealAt,
    explanationAt: view.explanationAt,
    leaderboardAt: view.leaderboardAt,
    nextAt: view.nextAt,
    deadline: view.deadline,
  };
}
function cuts(state: State) {
  const host = pickCuts(tv(state));
  const own = pickCuts(phone(state, missingId));
  expect(own).toEqual(host);
  for (const value of Object.values(host)) expect(typeof value).toBe('number');
  expect(host.revealAt!).toBeLessThan(host.explanationAt!);
  expect(host.explanationAt!).toBeLessThan(host.leaderboardAt!);
  expect(host.nextAt).toBe(host.leaderboardAt);
  expect(host.nextAt!).toBeLessThan(host.deadline!);
  return host;
}
function shiftCuts(before: ReturnType<typeof cuts>, elapsed: number) {
  return Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value! + elapsed]));
}
function unchangedScore(before: State, after: State): void {
  expect(after.teams).toEqual(before.teams);
  expect(after.teamScores).toEqual(before.teamScores);
  expect(after.teamGains).toEqual(before.teamGains);
  expect(after.teamAccuracy).toEqual(before.teamAccuracy);
  expect(after.lastDelta).toEqual(before.lastDelta);
  expect(after.groupRevealBeats).toEqual(before.groupRevealBeats);
  expect(groupRevealTiming(after)).toEqual(groupRevealTiming(before));
}

describe('group reveal freezes shared answer, explanation and standings cuts', () => {
  it('keeps every cut fixed after the longest missing receipt leaves and reconnects permanently', () => {
    const state = reveal();
    const before = cuts(state);
    const departed = kit.player(state, missingId, false, 'left', state.phase.startedAt + 100);
    expect(departed.players[missingId]?.connected).toBe(false);
    expect(phone(departed, missingId).participating).toBe(false);
    expect(phone(departed, missingId).group?.leftMembers).toContain(missingId);
    expect(cuts(departed)).toEqual(before);
    unchangedScore(state, departed);
    const reconnected = kit.player(
      departed,
      missingId,
      true,
      undefined,
      state.phase.startedAt + 200,
    );
    expect(reconnected.players[missingId]?.connected).toBe(true);
    // Permanent departures still watch this match after their connection returns.
    expect(phone(reconnected, missingId).participating).toBe(false);
    expect(cuts(reconnected)).toEqual(before);
    unchangedScore(state, reconnected);
  });

  it('keeps the same cuts while a temporary disconnection returns to its participating seat', () => {
    const state = reveal();
    const before = cuts(state);
    const absent = kit.player(state, missingId, false, undefined, state.phase.startedAt + 100);
    expect(absent.players[missingId]?.connected).toBe(false);
    expect(phone(absent, missingId).participating).toBe(true);
    expect(cuts(absent)).toEqual(before);
    const back = kit.player(absent, missingId, true, undefined, state.phase.startedAt + 200);
    expect(back.players[missingId]?.connected).toBe(true);
    expect(phone(back, missingId).participating).toBe(true);
    expect(cuts(back)).toEqual(before);
    unchangedScore(state, back);
  });

  it('shifts all cuts uniformly on SDK resume even if a player leaves while paused', () => {
    const state = reveal();
    const before = cuts(state);
    const pauseAt = state.phase.startedAt + 100;
    const elapsed = 4_000;
    const paused = kit.vip(state, 'pause', pauseAt);
    expect(tv(paused).clockHeldAt).toBe(pauseAt);
    expect(cuts(paused)).toEqual(before);
    const departed = kit.player(paused, missingId, false, 'left', pauseAt + 1_000);
    expect(phone(departed, missingId).participating).toBe(false);
    expect(cuts(departed)).toEqual(before);
    const resumed = kit.vip(departed, 'resume', pauseAt + elapsed);
    expect(resumed.phase.id).toBe('reveal');
    expect(tv(resumed).paused).toBe(false);
    expect(cuts(resumed)).toEqual(shiftCuts(before, elapsed));
    unchangedScore(state, resumed);
    const back = kit.player(resumed, missingId, true, undefined, pauseAt + elapsed + 100);
    expect(cuts(back)).toEqual(shiftCuts(before, elapsed));
    unchangedScore(state, back);
  });
});
