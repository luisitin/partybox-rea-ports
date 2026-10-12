// Retained group answers stay visible in aggregate progress and remain real scoring inputs.
import { renderToStaticMarkup } from 'react-dom/server';
import { testKit } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import { questionById } from '../server/content';
import { questionPoints } from '../server/scoring';
import { answerWindowOf } from '../server/types';
import type { GroupMode, State } from '../server/types';
import { phone, tv } from './helpers';

const T0 = 2_000_000_000_000;
const kit = testKit(game, { t0: T0 });
type Surface = 'tv' | 'phone-only' | 'remote' | 'spectator';
const PLAYERS = Array.from({ length: 8 }, (_, index) => ({
  id: 'p' + index,
  name: 'Retained player ' + index + ' Falcon',
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
afterEach(() => vi.useRealTimers());

function question(mode: GroupMode | 'classic' | 'wager', surface: Surface = 'tv'): State {
  const initial = game.init({
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
  const state =
    mode === 'teams' || mode === 'tv-vote' ? kit.timer(kit.timer(initial)) : kit.timer(initial);
  expect(state.phase.id).toBe('question');
  return state;
}

function answered(state: State, correct = true): State {
  const current = questionById(state.questionIds[state.index]!, state.contentLang)!;
  const choice = correct ? current.answerIndex : (current.answerIndex + 1) % 4;
  const stamp = phone(state, 'p0').answerStamp;
  if (state.settings.quizMode !== 'wager' && !stamp)
    throw new Error('Retained answer requires a canonical answer stamp');
  return kit.input(
    state,
    'p0',
    state.settings.quizMode === 'wager'
      ? { type: 'pick', index: choice }
      : { type: 'answer', ...stamp!, index: choice },
    state.phase.startedAt + 100,
  );
}

function lifecycle(state: State): {
  accepted: State;
  away: State;
  back: State;
  left: State;
  permanentBack: State;
  unansweredAway: State;
  unansweredBack: State;
} {
  const accepted = state;
  const at = state.phase.startedAt;
  const away = kit.player(accepted, 'p0', false, undefined, at + 200);
  const back = kit.player(away, 'p0', true, undefined, at + 300);
  const left = kit.player(back, 'p0', false, 'left', at + 400);
  const permanentBack = kit.player(left, 'p0', true, undefined, at + 500);
  const unansweredAway = kit.player(permanentBack, 'p1', false, undefined, at + 600);
  const unansweredBack = kit.player(unansweredAway, 'p1', true, undefined, at + 700);
  return { accepted, away, back, left, permanentBack, unansweredAway, unansweredBack };
}

function paint(state: State, surface: Surface): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(state.phase.startedAt + 1_000);
  const id = surface === 'spectator' ? 'audience' : 'p0';
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

function progress(html: string, surface: Surface): string | undefined {
  return surface === 'tv'
    ? html.match(/data-position="right"[^>]*aria-label="([^"]+)"/)?.[1]
    : html.match(/<p[^>]*data-group-progress="true"[^>]*>([^<]+)<\/p>/)?.[1];
}

function noOpenAnswerLeak(state: State, id: string): void {
  const publicView = tv(state);
  const own = phone(state, id);
  for (const key of [
    'picks',
    'voterIds',
    'answeredIds',
    'answerDistribution',
    'correctIndex',
    'explanation',
    'explanationAt',
  ])
    expect(publicView).not.toHaveProperty(key);
  for (const key of [
    'picks',
    'voterIds',
    'answeredIds',
    'answerDistribution',
    'correctIndex',
    'explanation',
    'explanationAt',
    'outcome',
  ])
    expect(own).not.toHaveProperty(key);
  expect(publicView.group).not.toHaveProperty('decision');
  if (own.stage) {
    for (const key of [
      'picks',
      'voterIds',
      'answeredIds',
      'answerDistribution',
      'correctIndex',
      'explanation',
      'explanationAt',
    ])
      expect(own.stage).not.toHaveProperty(key);
  }
}

describe.each(['teams', 'tv-vote'] as const)('%s retained progress', (mode) => {
  it.each(['tv', 'phone-only', 'remote', 'spectator'] as const)(
    '%s counts accepted answers once through temporary and permanent presence changes',
    (surface) => {
      const states = lifecycle(answered(question(mode, surface)));
      expect(states.away.players.p0?.connected).toBe(false);
      expect(states.away.left).not.toContain('p0');
      expect(states.back.players.p0?.connected).toBe(true);
      expect(states.permanentBack.players.p0?.connected).toBe(true);
      expect(states.permanentBack.left).toContain('p0');
      expect(phone(states.permanentBack, 'p0').participating).toBe(false);
      for (const [step, state] of Object.entries(states)) {
        const total = step === 'unansweredAway' ? 7 : 8;
        expect(state.phase.id).toBe('question');
        expect(state.picks.p0).toEqual(states.accepted.picks.p0);
        expect(tv(state).answeredCount).toBe(1);
        expect(tv(state).totalCount).toBe(total);
        const html = paint(state, surface);
        expect(progress(html, surface)).toBe(
          '1 of ' + total + (mode === 'tv-vote' ? ' voted' : ' answered'),
        );
        for (const player of PLAYERS) expect(html).not.toContain(player.name);
        noOpenAnswerLeak(state, surface === 'spectator' ? 'audience' : 'p1');
        if (surface === 'spectator' || state.left?.includes('p0'))
          expect(html).not.toContain('<button');
      }
      const returned = states.unansweredBack;
      const stamp = phone(returned, 'p0').answerStamp!;
      // A reconnecting permanent leaver cannot revise the retained pick or add another vote.
      expect(
        kit.input(
          returned,
          'p0',
          { type: 'answer', ...stamp, index: (returned.picks.p0!.index + 1) % 4 },
          returned.phase.startedAt + 800,
        ),
      ).toBe(returned);
      expect(
        kit.input(
          returned,
          'audience',
          { type: 'answer', ...stamp, index: 0 },
          returned.phase.startedAt + 900,
        ),
      ).toBe(returned);
      expect(returned.picks).not.toHaveProperty('audience');
    },
  );

  it.each(['away', 'permanentBack'] as const)(
    '%s retains the accepted result in the reveal distribution and scoring',
    (step) => {
      const original = question(mode, 'phone-only');
      const current = questionById(original.questionIds[original.index]!, original.contentLang)!;
      const retained = lifecycle(answered(original))[step];
      const expectedPoints = questionPoints(100, answerWindowOf(original) / 1000, 1);
      // Reveal fixtures are isolated: none of the other seven seats has gone away.
      for (const player of PLAYERS.filter((player) => player.id !== 'p0')) {
        expect(retained.players[player.id]?.connected).toBe(true);
        expect(retained.left).not.toContain(player.id);
      }
      const ownTeam = retained.teams!.find((team) => team.members.includes('p0'))!;
      const reveal = kit.timer(retained);
      expect(reveal.phase.id).toBe('reveal');
      expect(reveal.picks.p0?.index).toBe(current.answerIndex);
      expect(tv(reveal).answerDistribution?.counts).toEqual(
        Array.from({ length: 4 }, (_, index) => (index === current.answerIndex ? 1 : 0)),
      );
      expect(tv(reveal).answerDistribution?.missed).toBe(7);
      expect(reveal.lastDelta.p0).toBe(expectedPoints);
      if (mode === 'teams') {
        // Fixed four-player team: three connected non-answers are zero, retained p0 still counts.
        expect(ownTeam.members).toHaveLength(4);
        expect(reveal.teamGains?.[ownTeam.id]).toBe(Math.round(expectedPoints / 4));
        expect(reveal.teamAccuracy?.[ownTeam.id]).toEqual({ correct: 1, total: 4 });
        expect(tv(reveal).group?.teams.find((team) => team.id === ownTeam.id)?.correctPercent).toBe(
          25,
        );
      } else {
        expect(reveal.roomDecision).toBe(current.answerIndex);
        expect(reveal.roomElapsedMs).toBe(100);
        expect(reveal.teamGains?.room).toBe(expectedPoints);
        expect(Object.values(reveal.scores)).toEqual(Array(8).fill(expectedPoints));
        expect(phone(reveal, 'p1').outcome?.correct).toBe(true);
        expect(phone(reveal, 'p1').myPickIndex).toBeNull();
      }
      expect(paint(reveal, 'phone-only')).not.toContain('data-group-progress');
    },
  );

  it('starts the next question with no carried answer and excludes the permanent leaver', () => {
    const retained = lifecycle(answered(question(mode, 'phone-only'))).permanentBack;
    const reveal = kit.timer(retained);
    const talk = kit.timer(reveal);
    expect(talk.phase.id).toBe('talk');
    const next = kit.timer(talk);
    expect(next.phase.id).toBe('question');
    expect(next.index).toBe(retained.index + 1);
    expect(next.questionIds[next.index]).not.toBe(retained.questionIds[retained.index]);
    expect(next.picks).toEqual({});
    expect(next.left).toContain('p0');
    expect(phone(next, 'p0').participating).toBe(false);
    expect(tv(next).answeredCount).toBe(0);
    expect(tv(next).totalCount).toBe(7);
    expect(progress(paint(next, 'phone-only'), 'phone-only')).toBe(
      mode === 'tv-vote' ? '0 of 7 voted' : '0 of 7 answered',
    );
    noOpenAnswerLeak(next, 'audience');
  });

  it('aggregate progress does not identify another player’s answer even after a departure', () => {
    const original = question(mode, 'phone-only');
    const correct = lifecycle(answered(original, true)).permanentBack;
    const wrong = lifecycle(answered(original, false)).permanentBack;
    expect(correct.picks.p0?.index).not.toBe(wrong.picks.p0?.index);
    expect(tv(correct)).toEqual(tv(wrong));
    for (const id of ['p1', 'audience']) {
      expect(phone(correct, id)).toEqual(phone(wrong, id));
      expect(phone(correct, id).myPickIndex).toBeNull();
      noOpenAnswerLeak(correct, id);
    }
    expect(progress(paint(correct, 'spectator'), 'spectator')).toBe(
      mode === 'tv-vote' ? '1 of 8 voted' : '1 of 8 answered',
    );
  });
});

it.each(['classic', 'wager'] as const)(
  'individual %s retains its connected-only live counter and established scoring',
  (mode) => {
    const original = question(mode, 'phone-only');
    const accepted = answered(original);
    expect(tv(accepted).answeredCount).toBe(1);
    expect(tv(accepted).totalCount).toBe(8);
    const states = lifecycle(accepted);
    expect(tv(states.back).answeredCount).toBe(1);
    expect(tv(states.back).totalCount).toBe(8);
    expect(phone(states.back, 'p0').participating).toBe(true);
    expect(states.permanentBack.players.p0?.connected).toBe(true);
    expect(states.permanentBack.left).toContain('p0');
    expect(phone(states.permanentBack, 'p0').participating).toBe(false);
    for (const state of [states.away, states.left, states.permanentBack]) {
      expect(tv(state).answeredCount).toBe(0);
      expect(tv(state).totalCount).toBe(7);
      expect(tv(state)).not.toHaveProperty('group');
      expect(paint(state, 'phone-only')).not.toContain('data-group-progress');
    }
    const reveal = kit.timer(states.permanentBack);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.lastDelta.p0).toBe(questionPoints(100, answerWindowOf(original) / 1000, 1));
    expect(tv(reveal)).not.toHaveProperty('group');
  },
);
