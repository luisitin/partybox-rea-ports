// Semantic reading-budget regressions for the canonical group layouts.
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { classicRevealBeats } from '../server/pacing';
import { readMs, wordCount } from '../server/types';
import type { GroupMode, State } from '../server/types';
import { controllerView, tvView } from '../server/views';

const kit = testKit(game, { t0: 100_000 });
const finalWindowMs = readMs(Math.max(wordCount('Show podium'), wordCount('Mostrar el podio')));

function receiptState(mode: GroupMode): State {
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    name: 'One two three four',
    avatarId: 'fox',
    connected: true,
  }));
  const s = game.init({
    players,
    seed: 41,
    now: 100_000,
    settings: {
      quizMode: mode,
      classicPack: 'sports',
      teamCount: 4,
      questions: 5,
      answerSeconds: 30,
    },
  });
  const numbered = Object.fromEntries(players.map((p) => [p.id, 995]));
  return {
    ...s,
    phase: { id: 'reveal', startedAt: 100_000, deadline: 200_000 },
    questionIds: Array(5).fill('sports-09'),
    index: 0,
    picks: Object.fromEntries(players.map((p) => [p.id, { index: 1, elapsedMs: 100 }])),
    lastDelta: numbered,
    scores: numbered,
    streaks: Object.fromEntries(players.map((p) => [p.id, 1])),
    teamScores: Object.fromEntries(s.teams!.map((team) => [team.id, 995])),
    teamGains: Object.fromEntries(s.teams!.map((team) => [team.id, 995])),
    ...(mode === 'tv-vote' ? { roomDecision: 1, roomStreak: 1 } : {}),
  };
}

describe('group reveal budgets match actual screens', () => {
  it.each(['teams', 'tv-vote'] as const)(
    'does not budget invisible personal streak/speed receipts in %s',
    (mode) => {
      const s = receiptState(mode);
      const hot = {
        ...s,
        streaks: Object.fromEntries(Object.keys(s.players).map((id) => [id, 9])),
      };
      expect(classicRevealBeats(hot)).toEqual(classicRevealBeats(s));
      // Classic still displays its streak receipt and keeps its prior timing rule.
      const classic = { ...s, settings: { ...s.settings, quizMode: 'classic' as const } };
      expect(classicRevealBeats({ ...classic, streaks: hot.streaks }).chartMs).toBeGreaterThan(
        classicRevealBeats(classic).chartMs,
      );
    },
  );
  it.each([
    ['teams', 58, 65],
    ['tv-vote', 56, 51],
  ] as const)(
    '%s budgets the longest actual EN/ES chart and board, including the VIP cue',
    (mode, chartWords, boardWords) => {
      // Four-word names and sports-09: independently counted rendered text/shape marks.
      // Spanish averaging/total/heading copy is included; room phones have no team meter.
      expect(classicRevealBeats(receiptState(mode))).toEqual({
        chartMs: readMs(chartWords),
        standingsMs: readMs(boardWords),
      });
    },
  );
  it.each([
    ['teams', 40],
    ['tv-vote', 50],
  ] as const)(
    '%s final chart excludes the hidden team receipt, gauge and final rank',
    (mode, words) => {
      const final: State = {
        ...receiptState(mode),
        index: 4,
        questionIds: Array(5).fill('sports-15'),
        picks: Object.fromEntries(
          Object.keys(receiptState(mode).players).map((id) => [id, { index: 3, elapsedMs: 100 }]),
        ),
        ...(mode === 'tv-vote' ? { roomDecision: 3 } : {}),
      };
      expect(classicRevealBeats(final)).toEqual({
        chartMs: readMs(words),
        standingsMs: finalWindowMs,
      });
      const hidden = {
        ...final,
        teams: final.teams!.map((team) => ({
          ...team,
          name: 'Hidden final team name that must never enter this receipt',
        })),
        streaks: Object.fromEntries(Object.keys(final.players).map((id) => [id, 999])),
      };
      expect(classicRevealBeats(hidden)).toEqual(classicRevealBeats(final));
    },
  );
  it('budgets long TV member rows and the longest possible VIP name instead of clipping its cue', () => {
    const s = receiptState('teams');
    const long: State = {
      ...s,
      players: Object.fromEntries(
        Object.entries(s.players).map(([id, p]) => [
          id,
          { ...p, name: 'One two three four five six seven eight' },
        ]),
      ),
    };
    expect(classicRevealBeats(long).standingsMs).toBe(readMs(101));
    expect(classicRevealBeats(long).standingsMs).toBeGreaterThan(classicRevealBeats(s).standingsMs);
  });
  it('budgets the actual no-vote/absent-voter wording and missing-count chart', () => {
    const { roomDecision: _decision, ...prior } = receiptState('tv-vote');
    const empty: State = { ...prior, picks: {}, teamGains: { room: 0 } };
    expect(classicRevealBeats(empty).chartMs).toBe(readMs(58));
  });
  it.each(['teams', 'tv-vote'] as const)(
    '%s gives the VIP a real final window before automatic podium',
    (mode) => {
      const prior = receiptState(mode);
      const leader = prior.teams![0]!.members[0]!;
      const teamScores = Object.fromEntries(
        prior.teams!.map((team, i) => [team.id, (prior.teams!.length - i) * 1000]),
      );
      const scores = Object.fromEntries(
        prior.teams!.flatMap((team) => team.members.map((id) => [id, teamScores[team.id]!])),
      );
      const finalQuestion: State = {
        ...prior,
        index: 4,
        questionIds: Array(5).fill('sports-15'),
        phase: { id: 'question', startedAt: 100_000, deadline: 110_000 },
        picks: {},
        lastDelta: {},
        teamGains: {},
        teamScores,
        scores,
      };
      const final = kit.timer(finalQuestion);
      expect(final.phase.id).toBe('reveal');
      const phone = controllerView(final, 'kahoot', leader);
      expect(phone.next).toBe('podium');
      expect(final.phase.deadline! - phone.nextAt!).toBe(finalWindowMs);
      const readyAt = phone.nextAt! + 100;
      expect(readyAt).toBeLessThan(final.phase.deadline!);
      expect(kit.timer(final, readyAt)).toBe(final);
      expect(tvView(final, 'kahoot').group?.teams).toEqual([]);
      expect(phone).not.toHaveProperty('myRank');
      const skipped = kit.vip(final, 'skip', readyAt);
      expect(skipped.phase.id).toBe('podium');
      expect(skipped.podiumRank).toBe(mode === 'teams' ? 3 : 1);
      const stage = tvView(skipped, 'kahoot');
      expect(stage.podium?.entries).toHaveLength(1);
      expect(stage.podium?.entries.every((row) => row.rank === skipped.podiumRank)).toBe(true);
      expect(stage.group?.teams.every((team) => team.rank === skipped.podiumRank)).toBe(true);
      expect(stage.players.every((player) => !Object.hasOwn(player, 'score'))).toBe(true);
      if (mode === 'teams')
        expect(controllerView(skipped, 'kahoot', leader)).not.toHaveProperty('myRank');
      expect(game.results(skipped)).toBeNull();
      let automatic = kit.timer(final);
      expect(automatic.phase.id).toBe('podium');
      expect(automatic.podiumRank).toBe(skipped.podiumRank);
      for (let beat = 0; beat < 4 && automatic.phase.id !== 'done'; beat++)
        automatic = kit.timer(automatic);
      expect(automatic.phase.id).toBe('done');
      expect(game.results(automatic)?.ranking).toHaveLength(8);
      // The inherited Classic final still has no added group interaction window.
      const classic = { ...final, settings: { ...final.settings, quizMode: 'classic' as const } };
      expect(classicRevealBeats(classic).standingsMs).toBe(0);
    },
  );
});
