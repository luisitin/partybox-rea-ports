// Reading floors use rendered screens and the TV module's real host-strip visibility contract.
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PhoneOnlyProvider, PlayerChips, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PlayerInfo } from '@partybox/game-sdk';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Outcome } from '../client/ControllerBits';
import { Tv } from '../client/Tv';
import { tv as tvModule } from '../client/tv-entry';
import { QUESTIONS, QUESTIONS_ES } from '../server/content';
import { game } from '../server/index';
import { enterQuestion } from '../server/phases/question';
import { readMs, wordCount } from '../server/types';
import type { State } from '../server/types';
import type { Question } from '../content/schema';
import { input, phone, timer, tv } from './helpers';

const T0 = 2_000_000_000_000;
const language = vi.hoisted(() => ({ value: 'en' as 'en' | 'es' }));
vi.mock('../../../packages/game-sdk/src/ui/lang', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../packages/game-sdk/src/ui/lang')>();
  return {
    ...actual,
    useLang: () => language.value,
    useT: (table: Parameters<typeof actual.useT>[0]) =>
      Object.assign(
        (en: string, vars?: Readonly<Record<string, string | number>>) =>
          actual.translate(table, language.value, en, vars),
        {
          lang: language.value,
          sent: (value: string) => actual.translateSent(table, language.value, value),
        },
      ),
    ContentLang: (props: Parameters<typeof actual.ContentLang>[0]) =>
      actual.contentMark(language.value, props),
  };
});

afterEach(() => {
  vi.useRealTimers();
  language.value = 'en';
});
const metrics: Record<string, string | number>[] = [];
afterAll(() => {
  if (process.env.PB_WRITE_EVIDENCE === '1') {
    writeFileSync(
      resolve(import.meta.dirname, '../../../jobs/P01-quiz-rush/media/loop-2-reading.json'),
      JSON.stringify(
        {
          command: 'pnpm.cmd vitest run games/kahoot --maxWorkers=1 --pool=threads',
          screens: metrics,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }
});

const words = (html: string): number =>
  wordCount(
    html
      .replace(/<span\b[^>]*class="[^"]*pb-visually-hidden[^"]*"[^>]*>[\s\S]*?<\/span>/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' '),
  );

function longest(pack: readonly Question[], options: boolean): Question {
  const size = (q: Question): number =>
    wordCount(q.question) +
    (options
      ? q.choices.reduce((sum, choice) => sum + wordCount(choice), 0)
      : wordCount(q.choices[q.answerIndex] ?? ''));
  return pack.reduce((best, q) => (size(q) > size(best) ? q : best));
}

function reveal(
  q: Question,
  count: number,
  allCorrect: boolean,
  denseNames = false,
  contentLang: 'en' | 'es' = language.value,
): State {
  const players: PlayerInfo[] = Array.from({ length: count }, (_, index) => ({
    id: `seat-${index + 1}`,
    name: denseNames
      ? `${String(index + 1).padStart(2, '0')} ${'a '.repeat(19).trim()}`
      : `${String(index + 1).padStart(2, '0')} Maximiliana Guadalupe Washington Aster`.slice(0, 40),
    avatarId: 'fox',
    connected: true,
    canSeeTv: true,
    bot: index === count - 1,
  }));
  let state = game.init({
    players,
    settings: { quizMode: 'wager', questions: 5, answerSeconds: 15, category: 'all' },
    seed: 42,
    now: T0,
    contentLang,
  });
  state = enterQuestion(
    {
      ...state,
      questionIds: [q.id, ...state.questionIds.slice(1)],
      scores: Object.fromEntries(players.map((p, index) => [p.id, 10_000 + index])),
      streaks: Object.fromEntries(players.map((p) => [p.id, 19])),
    },
    T0 + 10_000,
  );
  const at = state.phase.startedAt + 500;
  for (const [index, player] of players.entries()) {
    if (!allCorrect && index % 3 === 2) continue;
    state = input(
      state,
      player.id,
      {
        type: 'pick',
        index: allCorrect || index % 3 === 1 ? q.answerIndex : (q.answerIndex + 1) % 4,
      },
      at,
    );
  }
  if (state.phase.id === 'question') state = timer(state);
  expect(state.phase.id).toBe('reveal');
  // A dropped seat retains its accepted answer and its reconnect glyph on the host strip.
  return game.reduce(state, {
    type: 'player',
    playerId: players[count - 1]!.id,
    connected: false,
    now: state.phase.startedAt + 100,
  });
}

function paint(state: State, at: number): { stage: number; strip: number; phones: number[] } {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
  const view = tv(state);
  expect(view.timerMode).toBe('quiet'); // The real host shows a bar, not Timer digits, in reveal.
  const stage = words(
    renderToStaticMarkup(
      <ServerClockProvider offsetMs={0}>
        <Tv view={{ ...view, vip: 'seat-1' }} skip={() => undefined} />
      </ServerClockProvider>,
    ),
  );
  const strip = tvModule.stripHidden?.includes(view.phaseId)
    ? 0
    : words(
        renderToStaticMarkup(
          <PlayerChips
            players={view.players}
            vip="seat-1"
            showScores
            botIds={Object.values(state.players)
              .filter((p) => p.bot)
              .map((p) => p.id)}
            autoFacesPastRows={2}
          />,
        ),
      );
  const phones: number[] = [];
  for (const id of ['seat-1', 'seat-2', 'seat-3', 'audience']) {
    for (const surface of ['beside-tv', 'phone-only', 'remote'] as const) {
      const shown: State = {
        ...state,
        phoneOnly: surface === 'phone-only',
        players: {
          ...state.players,
          ...(state.players[id]
            ? { [id]: { ...state.players[id]!, canSeeTv: surface !== 'remote' } }
            : {}),
        },
      };
      const controller = phone(shown, id);
      const html = renderToStaticMarkup(
        <ServerClockProvider offsetMs={0}>
          <PhoneOnlyProvider value={controller.phoneOnly === true}>
            <Controller
              view={{ ...controller, vip: 'seat-1' }}
              me={shown.players[id] ?? { id, name: 'Spectator', avatarId: 'owl' }}
              send={() => undefined}
              skip={id === 'seat-1' ? () => undefined : undefined}
            />
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      // SSR mounts directly in reveal, so it cannot carry the previous round's local streak.
      // Count the real longer Outcome markup that a continuously mounted phone can display.
      const receipt = (streakBefore: number): number =>
        words(renderToStaticMarkup(<Outcome view={controller} streakBefore={streakBefore} />));
      const carriedStreak = controller.participating ? receipt(19) - receipt(0) : 0;
      phones.push(words(html) + Math.max(0, carriedStreak));
    }
  }
  return { stage, strip, phones };
}

describe('wager reveal uses separate rendered reading floors', () => {
  it('the stage supplies the reveal roster while the generic strip is hidden', () => {
    expect(tvModule.stripHidden).toContain('reveal');
  });
  for (const lang of ['en', 'es'] as const) {
    for (const count of [8, 16]) {
      for (const options of [true, false]) {
        it(`${lang}, ${count} seats, longest ${options ? 'phone options' : 'TV answer'} fits both beats`, () => {
          language.value = lang;
          const q = longest(lang === 'es' ? QUESTIONS_ES : QUESTIONS, options);
          const state = reveal(q, count, !options);
          const view = tv(state);
          const race = paint(state, view.revealAt! + 2_000);
          const board = paint(state, view.leaderboardAt! + 1);
          const raceMs = view.leaderboardAt! - view.revealAt!;
          const boardMs = view.deadline! - view.leaderboardAt!;
          expect(raceMs - 2_000).toBeGreaterThanOrEqual(
            readMs(Math.max(race.stage + race.strip, ...race.phones)),
          );
          expect(boardMs).toBeGreaterThanOrEqual(
            readMs(Math.max(board.stage + board.strip, ...board.phones)),
          );
          expect(board.stage).toBeLessThan(race.stage);
          metrics.push({
            lang,
            count,
            question: q.id,
            raceStage: race.stage,
            strip: race.strip,
            racePhone: Math.max(...race.phones),
            standingsStage: board.stage,
            standingsPhone: Math.max(...board.phones),
            raceMs,
            boardMs,
          });
        });
      }
    }
  }

  it('also holds every word of legal forty-character, twenty-word roster names', () => {
    language.value = 'es'; // A Spanish phone also carries the English-content language marker.
    const state = reveal(longest(QUESTIONS, true), 16, false, true, 'en');
    expect(Object.values(state.players).every((p) => p.name.length === 40)).toBe(true);
    const view = tv(state);
    const race = paint(state, view.revealAt! + 2_000);
    const board = paint(state, view.leaderboardAt! + 1);
    expect(view.leaderboardAt! - view.revealAt! - 2_000).toBeGreaterThanOrEqual(
      readMs(Math.max(race.stage + race.strip, ...race.phones)),
    );
    expect(view.deadline! - view.leaderboardAt!).toBeGreaterThanOrEqual(
      readMs(Math.max(board.stage + board.strip, ...board.phones)),
    );
  });
});
