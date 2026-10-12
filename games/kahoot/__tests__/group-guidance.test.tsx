// Group guidance and waiting progress use real reducer states and only the public stage.
import { renderToStaticMarkup } from 'react-dom/server';
import { testKit } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider, ServerClockProvider, translate } from '@partybox/game-sdk/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { STRINGS } from '../client/strings';
import manifest from '../manifest.json' with { type: 'json' };
import manifestEs from '../manifest.es.json' with { type: 'json' };
import { game } from '../server/index';
import { classicIntroMs, questionReadingMs, wagerIntroMs } from '../server/pacing';
import { readMs, wordCount } from '../server/types';
import type { GroupMode, State } from '../server/types';
import { phone, tv } from './helpers';

const T0 = 2_000_000_000_000;
const kit = testKit(game, { t0: T0 });
type Surface = 'tv' | 'phone-tv' | 'phone-only' | 'remote';
const PLAYERS = Array.from({ length: 8 }, (_, index) => ({
  id: 'p' + index,
  name: 'Player ' + (index + 1) + ' Willow',
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
const TEAM_RULE = 'Everyone answers; team points are the average, and nobody is eliminated.';
const ROOM_RULE = 'Everyone votes for one shared answer and score; nobody is eliminated.';
const escape = (text: string): string => renderToStaticMarkup(<>{text}</>);
afterEach(() => vi.useRealTimers());

function start(mode: GroupMode | 'classic' | 'wager', surface: Surface = 'phone-tv'): State {
  return game.init({
    players: PLAYERS.map((player) => ({
      ...player,
      canSeeTv: surface !== 'remote' || player.id !== 'p0',
    })),
    settings: {
      quizMode: mode,
      classicPack: 'general',
      category: 'all',
      questions: 5,
      answerSeconds: 10,
      talkSeconds: 5,
      teamCount: 2,
    },
    seed: 23,
    now: T0,
    presence: { mode: 'together', phoneOnly: surface === 'phone-only' },
  });
}

function paint(state: State, surface: Surface, id = 'p0'): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(state.phase.startedAt + 1_000);
  const view = phone(state, id);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      {surface === 'tv' ? (
        <Tv view={{ ...tv(state), vip: null }} />
      ) : (
        <PhoneOnlyProvider value={view.phoneOnly === true}>
          <Controller
            view={{ ...view, vip: null }}
            me={state.players[id] ?? { id, name: 'Audience', avatarId: 'owl' }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
}

function answer(state: State, id: string, choice: number, elapsed = 100): State {
  const stamp = phone(state, id).answerStamp;
  if (!stamp) throw new Error('Progress fixtures need the production answer stamp');
  return kit.input(
    state,
    id,
    { type: 'answer', ...stamp, index: choice },
    state.phase.startedAt + elapsed,
  );
}

function progress(html: string): string | undefined {
  return html.match(/<p[^>]*data-group-progress="true"[^>]*>([^<]+)<\/p>/)?.[1];
}

function privateQuestionFieldsStayHidden(state: State, id: string): void {
  const view = phone(state, id);
  expect(tv(state)).not.toHaveProperty('correctIndex');
  expect(tv(state)).not.toHaveProperty('answerDistribution');
  expect(tv(state).group).not.toHaveProperty('decision');
  expect(view).not.toHaveProperty('correctIndex');
  expect(view).not.toHaveProperty('outcome');
  expect(view).not.toHaveProperty('explanation');
  if (view.stage) {
    expect(view.stage).not.toHaveProperty('correctIndex');
    expect(view.stage).not.toHaveProperty('answerDistribution');
    expect(view.stage).not.toHaveProperty('explanation');
  }
}

describe.each(['teams', 'tv-vote'] as const)(
  '%s explains the selected format before play',
  (mode) => {
    it.each(['tv', 'phone-tv', 'phone-only', 'remote'] as const)(
      '%s gives one concise rule sentence with no input controls',
      (surface) => {
        const state = start(mode, surface);
        const html = paint(state, surface);
        expect(html).toContain('data-group-intro-rules="' + mode + '"');
        expect(html.split('data-group-intro-rules=')).toHaveLength(2);
        expect(html).toContain(escape(mode === 'teams' ? TEAM_RULE : ROOM_RULE));
        expect(html).not.toContain(escape(mode === 'teams' ? ROOM_RULE : TEAM_RULE));
        expect(html).not.toContain('<button');
        expect(progress(html)).toBeUndefined();
        expect(phone(state, 'p0')).not.toHaveProperty('answerStamp');
        expect(tv(state)).not.toHaveProperty('correctIndex');
      },
    );

    it('gives spectators the same public format guidance without suggesting an answer control', () => {
      const state = start(mode, 'phone-only');
      const html = paint(state, 'phone-only', 'audience');
      expect(phone(state, 'audience').participating).toBe(false);
      expect(html).toContain(escape(mode === 'teams' ? TEAM_RULE : ROOM_RULE));
      expect(html).not.toContain('<button');
    });

    it('budgets the actual longer EN/ES intro rather than adding both devices together', () => {
      const state = start(mode);
      // Eight three-word names + Team 1/Team 2 or The room. TV is one word longer
      // than the spectator phone in Spanish; participating own-team phones are shorter.
      const expectedWords = mode === 'teams' ? 49 : 48;
      expect(classicIntroMs(state)).toBe(readMs(expectedWords));
      expect(state.phase.deadline! - state.phase.startedAt).toBe(readMs(expectedWords));
      expect(translate(STRINGS, 'es', mode === 'teams' ? TEAM_RULE : ROOM_RULE)).toBe(
        mode === 'teams'
          ? 'Todos responden; los puntos del equipo son el promedio y nadie queda eliminado.'
          : 'Todos votan por una respuesta y puntuación compartidas; nadie queda eliminado.',
      );
      expect(wordCount(translate(STRINGS, 'es', mode === 'teams' ? TEAM_RULE : ROOM_RULE))).toBe(
        mode === 'teams' ? 13 : 11,
      );
    });
  },
);

describe.each(['teams', 'tv-vote'] as const)(
  '%s staged waiting shows public live progress',
  (mode) => {
    it.each(['phone-only', 'remote'] as const)(
      '%s updates after a lock and another player answer without revealing results',
      (surface) => {
        const question = kit.timer(kit.timer(start(mode, surface)));
        expect(question.phase.id).toBe('question');
        expect(progress(paint(question, surface))).toBe(
          mode === 'teams' ? '0 of 8 answered' : '0 of 8 voted',
        );
        const locked = answer(question, 'p0', 0, 100);
        const html = paint(locked, surface);
        expect(progress(html)).toBe(mode === 'teams' ? '1 of 8 answered' : '1 of 8 voted');
        expect(html).toContain(mode === 'teams' ? 'Answer locked in' : 'Your vote is locked in');
        const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
        expect(buttons).toHaveLength(4);
        expect(buttons.every((button) => button.includes('disabled'))).toBe(true);
        const another = answer(locked, 'p1', 1, 200);
        expect(another.phase.id).toBe('question');
        expect(progress(paint(another, surface))).toBe(
          mode === 'teams' ? '2 of 8 answered' : '2 of 8 voted',
        );
        expect(phone(another, 'p0').myPickIndex).toBe(0);
        expect(phone(another, 'p0')).not.toHaveProperty('picks');
        privateQuestionFieldsStayHidden(another, 'p0');
        expect(html).not.toContain('Room answer:');
        expect(html).not.toContain('personal points');
      },
    );

    it('spectators see the aggregate count with no buttons or personal pick', () => {
      const state = answer(kit.timer(kit.timer(start(mode))), 'p0', 2);
      const view = phone(state, 'audience');
      const html = paint(state, 'phone-tv', 'audience');
      expect(view.participating).toBe(false);
      expect(view.myPickIndex).toBeNull();
      expect(progress(html)).toBe(mode === 'teams' ? '1 of 8 answered' : '1 of 8 voted');
      expect(html).not.toContain('<button');
      privateQuestionFieldsStayHidden(state, 'audience');
    });

    it('tracks disconnect, permanent departure and reconnect through SDK player events', () => {
      let state = kit.timer(kit.timer(start(mode, 'phone-only')));
      state = answer(state, 'p0', 0, 100);
      state = answer(state, 'p1', 1, 200);
      state = kit.player(state, 'p2', false, undefined, state.phase.startedAt + 300);
      expect(progress(paint(state, 'phone-only'))).toBe(
        mode === 'teams' ? '2 of 7 answered' : '2 of 7 voted',
      );
      state = kit.player(state, 'p3', false, 'left', state.phase.startedAt + 400);
      state = kit.player(state, 'p3', true, undefined, state.phase.startedAt + 500);
      expect(state.players.p3?.connected).toBe(true);
      expect(phone(state, 'p3').participating).toBe(false);
      expect(progress(paint(state, 'phone-only'))).toBe(
        mode === 'teams' ? '2 of 6 answered' : '2 of 6 voted',
      );
      state = kit.player(state, 'p2', true, undefined, state.phase.startedAt + 600);
      expect(progress(paint(state, 'phone-only'))).toBe(
        mode === 'teams' ? '2 of 7 answered' : '2 of 7 voted',
      );
      privateQuestionFieldsStayHidden(state, 'p0');
    });

    it('keeps the beside-TV phone shape-only and clears the live count at reveal', () => {
      const question = kit.timer(kit.timer(start(mode)));
      expect(progress(paint(question, 'phone-tv'))).toBeUndefined();
      const locked = answer(question, 'p0', 0);
      expect(progress(paint(locked, 'phone-tv'))).toBeUndefined();
      const reveal = kit.timer(locked);
      expect(reveal.phase.id).toBe('reveal');
      expect(progress(paint(reveal, 'phone-tv'))).toBeUndefined();
      expect(phone(reveal, 'p0').outcome).toBeDefined();
    });
  },
);

it('keeps individual Classic/Wager intro copy and timings unchanged', () => {
  for (const mode of ['classic', 'wager'] as const) {
    const state = start(mode, 'phone-only');
    const html = paint(state, 'phone-only');
    expect(html).not.toContain('data-group-intro-rules');
    expect(html).not.toContain(escape(TEAM_RULE));
    expect(html).not.toContain(escape(ROOM_RULE));
    expect(classicIntroMs(state)).toBe(readMs(7));
    expect(wagerIntroMs(state)).toBe(readMs(7));
    expect(state.phase.deadline! - state.phase.startedAt).toBe(readMs(7));
    const question = kit.timer(state);
    expect(question.phase.id).toBe('question');
    expect(progress(paint(question, 'phone-only'))).toBeUndefined();
    const q = tv(question).question!;
    const contentWords =
      wordCount(q.text) + q.choices.reduce((n, choice) => n + wordCount(choice), 0);
    // Prior visible TV budget: 13 clock/ordinal/count/shape words + eight 3-word names/statuses.
    const topic =
      mode === 'wager' ? wordCount(`${q.categoryLabel} ${q.subcategoryLabel} ${q.difficulty}`) : 0;
    expect(questionReadingMs(question)).toBe(readMs(contentWords + 45 + topic));
  }
});

it('translates group selection guidance and preserves the three-step picker contract', () => {
  const guidance =
    'Choose Teams for team averages or Room vote for a shared answer; tap your choice.';
  expect(manifest.howToPlay).toHaveLength(3);
  expect(manifest.howToPlay.every((step) => step.length <= 90)).toBe(true);
  expect(manifest.howToPlay[0]).toBe(guidance);
  expect(Object.hasOwn(manifestEs, guidance)).toBe(true);
  expect(manifest.howToPlay.slice(1)).toEqual([
    'Answer fast for more points; a streak of right answers earns a bonus.',
    'Classic reveals the podium; Wager adds a final bet. Highest score wins.',
  ]);
  expect(translate(STRINGS, 'es', '{n} of {m} answered', { n: 2, m: 7 })).toBe(
    '2 de 7 respondieron',
  );
  expect(translate(STRINGS, 'es', '{n} of {m} voted', { n: 2, m: 7 })).toBe('2 de 7 votaron');
});
