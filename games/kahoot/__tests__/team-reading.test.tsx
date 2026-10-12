// Actual discussion UI text, including each visible roster, must fit the server's reading hold.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readingMs, wordCount } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { TalkScreen } from '../client/TalkScreen';
import { Tv } from '../client/Tv';
import { questionSchema } from '../content/schema';
import { game } from '../server/index';
import { enterTalk } from '../server/phases/talk';
import type { QuizMode, State } from '../server/types';

const QUESTION = questionSchema.parse({
  id: 'reading-capital',
  prompt: 'What is the capital of Japan?',
  options: ['Sapporo', 'Osaka', 'Kyoto', 'Tokyo'],
  correct: 3,
  explanation: "Tokyo is Japan's capital.",
  difficulty: 1,
});
const contentWords = wordCount([QUESTION.prompt, ...QUESTION.options].join(' '));
const duration = (state: State): number => state.phase.deadline! - state.phase.startedAt;

function room(mode: QuizMode, teamCount: number, longNames = true): State {
  const players = testPlayers(8).map((player, index) => ({
    ...player,
    // Twelve words is the maximum possible within a 24-character trimmed name.
    name: longNames
      ? [String.fromCharCode(65 + index).repeat(2), ...Array<string>(11).fill('a')].join(' ')
      : player.name,
  }));
  const state = testKit(game, {
    players,
    settings: { mode, teamCount, talkSeconds: 5, rounds: 5 },
  }).start();
  return enterTalk(
    { ...state, deck: [QUESTION, ...state.deck.slice(1)] },
    state.phase.startedAt,
    1,
  );
}

function textWords(html: string): number {
  // Count all visible text, including timer digits and the repeated round context.
  // Accessibility labels and decorative shape SVGs are not extra visual reading copy.
  return wordCount(
    html
      .replace(/<([a-z][a-z0-9-]*)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' '),
  );
}

function tvWords(state: State): number {
  const view = { ...game.tvView(state), vip: null };
  return textWords(
    renderToStaticMarkup(
      <ServerClockProvider offsetMs={state.phase.startedAt - Date.now()}>
        <Tv view={view} />
      </ServerClockProvider>,
    ),
  );
}

function phoneWords(state: State, playerId: string, phoneOnly: boolean): number {
  const view = { ...game.controllerView({ ...state, phoneOnly }, playerId), vip: null };
  return textWords(
    renderToStaticMarkup(
      <PhoneOnlyProvider value={phoneOnly}>
        <TalkScreen view={view} now={state.phase.startedAt} />
      </PhoneOnlyProvider>,
    ),
  );
}

describe('discussion reading budget', () => {
  it.each([{ teamCount: 2 }, { teamCount: 4 }])(
    'covers eight maximum-word names in $teamCount teams on actual TV and phone surfaces',
    ({ teamCount }) => {
      const state = room('teams', teamCount);
      expect(
        Object.values(state.players).every(
          (player) => player.name.length === 24 && wordCount(player.name) === 12,
        ),
      ).toBe(true);
      const actualTvWords = tvWords(state);
      const actualPhoneWords = Object.keys(state.players).flatMap((id) => [
        phoneWords(state, id, false),
        phoneWords(state, id, true),
      ]);
      expect(actualTvWords).toBeGreaterThan(contentWords + 22);
      for (const words of [actualTvWords, ...actualPhoneWords]) {
        expect(duration(state)).toBeGreaterThanOrEqual(readingMs(words, { ui: true }));
      }
      // The previous prompt + 22 budget cut off the visible TV roster before a slow reader finished.
      const previousHold = readingMs(contentWords + 22, { ui: true });
      expect(previousHold).toBeLessThan(readingMs(actualTvWords, { ui: true }));
      console.log(
        JSON.stringify({
          teamCount,
          tvWords: actualTvWords,
          phoneWords: Math.max(...actualPhoneWords),
          holdMs: duration(state),
          priorHoldMs: previousHold,
        }),
      );
    },
  );

  it('does not reserve an invisible eight-name roster in room vote', () => {
    const state = room('tv-vote', 4);
    expect(duration(state)).toBeGreaterThanOrEqual(readingMs(tvWords(state), { ui: true }));
    for (const id of Object.keys(state.players)) {
      for (const stage of [false, true])
        expect(duration(state)).toBeGreaterThanOrEqual(
          readingMs(phoneWords(state, id, stage), { ui: true }),
        );
    }
    expect(duration(state)).toBe(readingMs(contentWords + 22, { ui: true }));
    expect(duration(room('tv-vote', 4, false))).toBe(duration(state));
  });

  it('retains the configured minimum and leaves solo init outside discussion', () => {
    const state = room('tv-vote', 2);
    const twenty = enterTalk(
      { ...state, settings: { ...state.settings, talkSeconds: 20 } },
      1000,
      1,
    );
    expect(duration(twenty)).toBe(20_000);
    expect(
      testKit(game, { players: testPlayers(8), settings: { mode: 'solo' } }).start().phase.id,
    ).toBe('question');
  });
});
