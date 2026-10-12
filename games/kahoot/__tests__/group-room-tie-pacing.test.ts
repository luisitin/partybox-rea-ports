// Extra reading time follows only the tie text rendered on each actual surface.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { classicRevealBeats } from '../server/pacing';
import { readMs, wordCount } from '../server/types';
import type { State } from '../server/types';
import { tvView } from '../server/views';
import { STRINGS } from '../client/strings';

const CUE = 'Tie — random choice among tied answers';
function receipt(tied: boolean, final = false): State {
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: 'p' + i,
    name: 'One two three four',
    avatarId: 'fox',
    connected: true,
  }));
  const state = game.init({
    players,
    seed: 41,
    now: 100_000,
    settings: { quizMode: 'tv-vote', classicPack: 'sports', questions: 5, answerSeconds: 30 },
  });
  const choice = final ? 3 : 1;
  return {
    ...state,
    phase: { id: 'reveal', startedAt: 100_000, deadline: 200_000 },
    questionIds: Array(5).fill(final ? 'sports-15' : 'sports-09'),
    index: final ? 4 : 0,
    picks: Object.fromEntries(
      players.map((p, i) => [
        p.id,
        { index: tied && i >= 4 ? (choice + 1) % 4 : choice, elapsedMs: 100 },
      ]),
    ),
    lastDelta: Object.fromEntries(players.map((p) => [p.id, 995])),
    scores: Object.fromEntries(players.map((p) => [p.id, 995])),
    streaks: Object.fromEntries(players.map((p) => [p.id, 1])),
    teamScores: { room: 995 },
    teamGains: { room: 995 },
    roomDecision: choice,
    roomStreak: 1,
  };
}

describe('room tie reading budget', () => {
  it.each([false, true])(
    'adds one actual translated cue to the limiting chart (final=%s)',
    (final) => {
      expect(wordCount(CUE)).toBe(7);
      expect(wordCount(STRINGS.es?.[CUE] ?? '')).toBe(8);
      const plain = receipt(false, final);
      const tied = receipt(true, final);
      const baseChartWords = final ? 50 : 56;
      expect(classicRevealBeats(plain).chartMs).toBe(readMs(baseChartWords));
      expect(classicRevealBeats(tied).chartMs).toBe(readMs(baseChartWords + 8));
      // TV members still limit this board; hidden finals retain their existing VIP window.
      expect(classicRevealBeats(tied).standingsMs).toBe(classicRevealBeats(plain).standingsMs);
      expect(tvView(tied, 'kahoot').answerDistribution?.counts.filter((n) => n === 4)).toHaveLength(
        2,
      );
    },
  );

  it('keeps clear pluralities and nobody-voted wording on their existing budgets', () => {
    const plain = receipt(false);
    const ids = Object.keys(plain.players);
    const plurality: State = {
      ...plain,
      picks: Object.fromEntries(
        ids.map((id, i) => [id, { index: i >= 5 ? 2 : 1, elapsedMs: 100 }]),
      ),
    };
    expect(classicRevealBeats(plurality)).toEqual(classicRevealBeats(plain));
    const { roomDecision: _decision, ...prior } = plain;
    const empty: State = { ...prior, picks: {}, teamGains: { room: 0 } };
    expect(classicRevealBeats(empty).chartMs).toBe(readMs(58));
  });

  it('does not add group tie copy to the inherited Classic reveal', () => {
    const classic = (state: State): State => ({
      ...state,
      settings: { ...state.settings, quizMode: 'classic' },
    });
    expect(classicRevealBeats(classic(receipt(true)))).toEqual(
      classicRevealBeats(classic(receipt(false))),
    );
  });
});
