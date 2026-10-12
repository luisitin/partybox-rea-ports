// Real reducer traces drive the public chart -> explanation -> standings clocks and role privacy.
import { renderToStaticMarkup } from 'react-dom/server';
import { testKit } from '@partybox/game-sdk/testing';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { GroupAnswerChart } from '../client/GroupAnswerChart';
import { GroupExplanation } from '../client/GroupExplanation';
import { REVEAL_BEAT_MS } from '../client/timing';
import { game } from '../server/index';
import { questionById } from '../server/content';
import { classicRevealBeats, groupRevealTiming } from '../server/pacing';
import type { GroupMode, State } from '../server/types';
import { phone, tv } from './helpers';

const T0 = 2_000_000_000_000;
const kit = testKit(game, { t0: T0 });
const PLAYERS = Array.from({ length: 8 }, (_, index) => ({
  id: 'p' + index,
  name: 'Player ' + (index + 1) + ' Willow',
  avatarId: 'fox',
  connected: true,
  canSeeTv: true,
}));
type Surface = 'tv' | 'phone-tv' | 'phone-only' | 'remote' | 'spectator';
const STAGES = ['tv', 'phone-only', 'remote', 'spectator'] as const;
const SHAPES = ['Triangle', 'Diamond', 'Circle', 'Square'] as const;
const escape = (text: string): string => renderToStaticMarkup(<>{text}</>);
const buttons = (html: string): string[] => html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
afterEach(() => vi.useRealTimers());

function start(mode: GroupMode | 'classic' | 'wager', surface: Surface = 'tv'): State {
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

function paint(state: State, surface: Surface, at: number, vip = false): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
  const id = surface === 'spectator' ? 'audience' : 'p0';
  const view = phone(state, id);
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={0}>
      {surface === 'tv' ? (
        <Tv view={{ ...tv(state), vip: null }} skip={vip ? () => undefined : undefined} />
      ) : (
        <PhoneOnlyProvider value={view.phoneOnly === true}>
          <Controller
            view={{ ...view, vip: null }}
            me={state.players[id] ?? { id, name: 'Audience', avatarId: 'owl' }}
            send={() => undefined}
            skip={vip && surface !== 'spectator' ? () => undefined : undefined}
          />
        </PhoneOnlyProvider>
      )}
    </ServerClockProvider>,
  );
}

function submitted(question: State, allCorrect = false): State {
  expect(question.phase.id).toBe('question');
  const current = questionById(question.questionIds[question.index]!, question.contentLang);
  if (!current) throw new Error('The sequence requires a real compiled question');
  let state = question;
  for (const [index, player] of PLAYERS.entries()) {
    const stamp = phone(state, player.id).answerStamp;
    const choice = allCorrect ? current.answerIndex : index < 4 ? 0 : index < 6 ? 1 : index - 4;
    const value =
      state.settings.quizMode === 'wager'
        ? { type: 'pick' as const, index: choice }
        : { type: 'answer' as const, ...stamp!, index: choice };
    if (state.settings.quizMode !== 'wager' && !stamp)
      throw new Error('The sequence requires a real answer stamp');
    state = kit.input(state, player.id, value, question.phase.startedAt + 100 + index * 50);
  }
  expect(Object.keys(state.picks)).toHaveLength(8);
  // The words still get their reading hold even when the last live player has answered.
  expect(state.phase.id).toBe('question');
  return state;
}

function firstReveal(mode: GroupMode | 'classic' | 'wager', surface: Surface = 'tv'): State {
  const initial = start(mode, surface);
  const question =
    mode === 'teams' || mode === 'tv-vote' ? kit.timer(kit.timer(initial)) : kit.timer(initial);
  const reveal = kit.timer(submitted(question));
  expect(reveal.phase.id).toBe('reveal');
  expect(reveal.index).toBe(0);
  return reveal;
}

function finalReveal(mode: GroupMode, surface: Surface): State {
  let state = start(mode, surface);
  for (let steps = 0; steps < 100; steps++) {
    if (state.phase.id === 'question') state = kit.timer(submitted(state, true));
    if (state.phase.id === 'reveal' && state.index === state.questionIds.length - 1) return state;
    state = kit.timer(state);
  }
  throw new Error('Canonical group trace did not reach its final reveal');
}

function cuts(state: State): { start: number; explanation: number; standings: number } {
  const view = tv(state);
  if (
    view.revealAt === undefined ||
    view.explanationAt === undefined ||
    view.leaderboardAt === undefined
  )
    throw new Error('A nonfinal group reveal needs its three public beat timestamps');
  return { start: view.revealAt, explanation: view.explanationAt, standings: view.leaderboardAt };
}

function pane(html: string): 'chart' | 'explanation' | 'standings' | 'none' {
  const chart = html.includes('data-group-answer-chart="vertical"');
  const explanation = html.includes('data-group-explanation="true"');
  const standings = html.includes('aria-label="Standings"');
  expect(Number(chart) + Number(explanation) + Number(standings)).toBeLessThanOrEqual(1);
  return chart ? 'chart' : explanation ? 'explanation' : standings ? 'standings' : 'none';
}

describe.each(['teams', 'tv-vote'] as const)('%s public reveal sequence', (mode) => {
  it.each(STAGES)('%s changes panes exactly at both server cut points', (surface) => {
    const state = firstReveal(mode, surface);
    const beat = cuts(state);
    const view = tv(state);
    const q = view.question!;
    expect(view.answerDistribution?.counts).toEqual([4, 2, 1, 1]);
    expect(beat.start).toBe(state.phase.startedAt);
    expect(beat.start).toBeLessThan(beat.explanation);
    expect(beat.explanation).toBeLessThan(beat.standings);
    expect(beat.standings).toBeLessThan(state.phase.deadline!);
    const clock = groupRevealTiming(state);
    expect(beat.explanation - beat.start).toBe(clock.answersMs);
    expect(beat.standings - beat.explanation).toBe(clock.explanationMs);
    expect(classicRevealBeats(state)).toEqual({
      chartMs: clock.answersMs + clock.explanationMs,
      standingsMs: clock.standingsMs,
    });
    for (const at of [beat.start, beat.explanation - 1]) {
      const html = paint(state, surface, at);
      expect(pane(html)).toBe('chart');
      expect(html).toContain(escape(q.text));
      expect(html).not.toContain(escape(view.explanation!));
      const graph = html.match(
        /<ol[^>]*aria-label="(?:Answer|Vote) distribution"[\s\S]*?<\/ol>/,
      )?.[0];
      expect(graph).toBeDefined();
      expect(graph!.match(/<li\b/g)).toHaveLength(4);
      expect(graph!.match(/data-correct="true"/g)).toHaveLength(1);
      for (const [index, count] of view.answerDistribution!.counts.entries()) {
        expect(graph).toContain(
          escape(
            `${SHAPES[index]}: ${q.choices[index]} · ${count} ${mode === 'tv-vote' ? 'votes' : 'answers'}`,
          ),
        );
      }
      for (const share of [1, 0.5, 0.25])
        expect(graph).toContain('--pb-group-chart-share:' + share);
      const options = html.match(/<ol[^>]*aria-label="Answer choices"[\s\S]*?<\/ol>/)?.[0];
      expect(options).toBeDefined();
      for (const choice of q.choices) expect(options).toContain('>' + escape(choice) + '</span>');
      expect(buttons(html)).toHaveLength(0);
    }
    for (const at of [beat.explanation, beat.explanation + 1, beat.standings - 1]) {
      const html = paint(state, surface, at);
      expect(pane(html)).toBe('explanation');
      expect(html).toContain(escape(q.text));
      expect(html).toContain(escape(q.choices[view.correctIndex!]!));
      expect(html).toContain(escape(view.explanation!));
      expect(html).not.toContain('aria-label="Answer choices"');
      expect(buttons(html)).toHaveLength(0);
    }
    for (const at of [beat.standings, beat.standings + 1]) {
      const html = paint(state, surface, at);
      expect(pane(html)).toBe('standings');
      expect(html).not.toContain(escape(view.explanation!));
      expect(html).toContain(mode === 'teams' ? 'Team scoreboard' : 'Room score');
      expect(buttons(html)).toHaveLength(0);
    }
  });

  it('uses compact feedback only for participants on a staged phone', () => {
    const state = firstReveal(mode, 'phone-only');
    const beat = cuts(state);
    const before = paint(state, 'phone-only', beat.start + REVEAL_BEAT_MS - 1);
    expect(before).not.toContain('data-group-stage-verdict');
    expect(before).toContain('Your result is coming');
    for (const at of [beat.start + REVEAL_BEAT_MS, beat.explanation, beat.standings]) {
      const html = paint(state, 'phone-only', at);
      expect(html.split('data-group-stage-verdict="true"')).toHaveLength(2);
      expect(html).not.toContain('data-beside-tv="true"');
    }
    for (const at of [beat.start, beat.explanation, beat.standings]) {
      const audience = paint(state, 'spectator', at, true);
      expect(audience).not.toContain('data-group-stage-verdict');
      expect(audience).not.toContain('data-group-player-bar');
      expect(buttons(audience)).toHaveLength(0);
    }
    let departed = kit.player(state, 'p0', false, 'left', beat.start + 100);
    departed = kit.player(departed, 'p0', true, undefined, beat.start + 200);
    expect(phone(departed, 'p0').participating).toBe(false);
    const watched = paint(departed, 'phone-only', tv(departed).explanationAt!);
    expect(pane(watched)).toBe('explanation');
    expect(watched).not.toContain('data-group-stage-verdict');
    expect(buttons(watched)).toHaveLength(0);
  });

  it('an empty answer round keeps zero bars finite and explains the actual room abstention', () => {
    const state = kit.timer(kit.timer(kit.timer(start(mode, 'phone-only'))));
    expect(state.phase.id).toBe('reveal');
    const view = tv(state);
    const beat = cuts(state);
    expect(view.answerDistribution).toEqual({ counts: [0, 0, 0, 0], missed: 8 });
    expect(view.group).not.toHaveProperty('decision');
    const chart = paint(state, 'phone-only', beat.start + REVEAL_BEAT_MS);
    expect(pane(chart)).toBe('chart');
    expect(chart).not.toMatch(/NaN|Infinity/);
    expect(chart.match(/--pb-group-chart-share:0(?:;|")/g)).toHaveLength(4);
    expect(chart).toContain(mode === 'tv-vote' ? 'No room answer' : 'Too slow');
    const explanation = paint(state, 'phone-only', beat.explanation);
    expect(pane(explanation)).toBe('explanation');
    expect(explanation).toContain(escape(view.explanation!));
    expect(phone(state, 'p0').outcome?.delta).toBe(0);
  });

  it('keeps beside-TV receipts through every beat without duplicating the public stage', () => {
    const state = firstReveal(mode, 'phone-tv');
    const beat = cuts(state);
    for (const at of [beat.start + REVEAL_BEAT_MS, beat.explanation, beat.standings]) {
      const html = paint(state, 'phone-tv', at);
      expect(pane(html)).toBe('none');
      expect(html).toContain('data-beside-tv="true"');
      expect(html).toContain('data-group-player-bar="true"');
      expect(html).not.toContain('data-group-stage-verdict');
      expect(html).toContain(mode === 'teams' ? 'Team results' : 'Room results');
    }
  });

  it.each(['explanation', 'standings'] as const)(
    'pause holds the pane just before %s, then resume shifts all cut points together',
    (boundary) => {
      for (const surface of STAGES) {
        const state = firstReveal(mode, surface);
        const beat = cuts(state);
        const at = beat[boundary] - 1;
        const paused = kit.vip(state, 'pause', at);
        const before = boundary === 'explanation' ? 'chart' : 'explanation';
        expect(pane(paint(paused, surface, at + 10_000))).toBe(before);
        const resumed = kit.vip(paused, 'resume', at + 10_000);
        const shifted = cuts(resumed);
        expect(resumed.phase.id).toBe('reveal');
        expect(shifted).toEqual({
          start: beat.start + 10_000,
          explanation: beat.explanation + 10_000,
          standings: beat.standings + 10_000,
        });
        expect(tv(resumed).nextAt).toBe(tv(state).nextAt! + 10_000);
        expect(resumed.phase.deadline).toBe(state.phase.deadline! + 10_000);
        expect(pane(paint(resumed, surface, shifted[boundary] - 1))).toBe(before);
        expect(pane(paint(resumed, surface, shifted[boundary]))).toBe(boundary);
      }
    },
  );

  it('holds VIP Next until both shared reading beats finish', () => {
    for (const surface of ['tv', 'phone-tv', 'phone-only', 'remote'] as const) {
      const state = firstReveal(mode, surface);
      const beat = cuts(state);
      const ready = phone(state, 'p0').nextAt!;
      expect(ready).toBe(beat.standings);
      expect(ready).toBeLessThan(state.phase.deadline!);
      for (const at of [beat.explanation - 1, beat.explanation, ready - 1])
        expect(buttons(paint(state, surface, at, true))).toHaveLength(0);
      expect(buttons(paint(state, surface, ready, true))).toHaveLength(1);
      const next = kit.vip(state, 'skip', ready + 1);
      expect(next.phase.id).toBe('talk');
      expect(next.index).toBe(1);
    }
  });

  it('publishes no answer chart, explanation or outcome while all inputs wait for their reading hold', () => {
    const question = kit.timer(kit.timer(start(mode, 'phone-only')));
    const waiting = submitted(question);
    expect(waiting.phase.id).toBe('question');
    expect(Object.keys(waiting.picks)).toHaveLength(8);
    for (const id of ['p0', 'audience']) {
      const view = phone(waiting, id);
      for (const key of [
        'correctIndex',
        'explanation',
        'explanationAt',
        'answerDistribution',
        'outcome',
      ])
        expect(view).not.toHaveProperty(key);
      for (const key of ['correctIndex', 'explanation', 'explanationAt', 'answerDistribution'])
        expect(view.stage).not.toHaveProperty(key);
      expect(view.group).not.toHaveProperty('decision');
      const html = paint(
        waiting,
        id === 'audience' ? 'spectator' : 'phone-only',
        waiting.phase.startedAt + 500,
      );
      expect(pane(html)).toBe('none');
      expect(html).toContain(mode === 'teams' ? '8 of 8 answered' : '8 of 8 voted');
    }
    expect(renderToStaticMarkup(<GroupAnswerChart view={tv(waiting)} />)).toBe('');
    expect(renderToStaticMarkup(<GroupExplanation view={tv(waiting)} />)).toBe('');
  });

  it.each(['tv', 'phone-tv', 'phone-only', 'remote', 'spectator'] as const)(
    '%s final explanation gives a live podium window without revealing final standings',
    (surface) => {
      const state = finalReveal(mode, surface);
      const stage = tv(state);
      const own = phone(state, 'p0');
      const explanation = stage.explanationAt!;
      const ready = stage.nextAt!;
      expect(explanation).toBeGreaterThan(stage.revealAt!);
      expect(ready).toBeGreaterThan(explanation);
      expect(ready + 1).toBeLessThan(state.phase.deadline!);
      expect(stage.leaderboardAt).toBeUndefined();
      expect(own.leaderboardAt).toBeUndefined();
      expect(stage.group?.teams).toHaveLength(0);
      expect(own.group?.teams).toHaveLength(0);
      expect(stage).not.toHaveProperty('standings');
      expect(own).not.toHaveProperty('standings');
      expect(own.myRank).toBeUndefined();
      expect(own.myScore).toBeLessThan(state.scores.p0!);
      if (mode === 'tv-vote') {
        expect(state.lastDelta.p0).toBeGreaterThan(0);
        expect(own.outcome?.delta).toBe(0);
        expect(own.outcome).not.toHaveProperty('base');
        expect(own.outcome).not.toHaveProperty('bonus');
      }
      for (const at of [explanation - 1, explanation, ready - 1, ready]) {
        const html = paint(state, surface, at, true);
        expect(pane(html)).toBe(
          surface === 'phone-tv' ? 'none' : at < explanation ? 'chart' : 'explanation',
        );
        expect(html).not.toContain('aria-label="Standings"');
        expect(html).not.toContain('<meter');
        if (mode === 'teams') {
          for (const team of state.teams!) expect(html).not.toContain(escape(team.name));
        }
        if (surface === 'phone-only' || surface === 'remote')
          expect(html).toContain('data-final-hidden="true"');
        const hasVip = surface !== 'spectator';
        expect(buttons(html)).toHaveLength(hasVip && at >= ready ? 1 : 0);
      }
      expect(kit.vip(state, 'skip', ready + 1).phase.id).toBe('podium');
      expect(kit.timer(state).phase.id).toBe('podium');
    },
  );
});

it('individual Classic keeps its inline explanation and Wager receives no new group beat fields', () => {
  for (const mode of ['classic', 'wager'] as const) {
    const state = firstReveal(mode, 'phone-only');
    const stage = tv(state);
    const own = phone(state, 'p0');
    expect(stage).not.toHaveProperty('group');
    expect(stage).not.toHaveProperty('explanationAt');
    expect(own).not.toHaveProperty('explanationAt');
    expect(own.stage).not.toHaveProperty('explanationAt');
    const at = stage.revealAt! + REVEAL_BEAT_MS;
    const html = paint(state, 'phone-only', at);
    expect(html).not.toContain('data-group-answer-chart');
    expect(html).not.toContain('data-group-explanation');
    expect(html).not.toContain('data-group-stage-verdict');
    if (mode === 'classic') {
      expect(html).toContain('aria-label="Answer distribution"');
      expect(html).toContain('--pb-classic-share');
      expect(html).toContain(escape(stage.explanation!));
      expect(stage.leaderboardAt! - stage.revealAt!).toBe(classicRevealBeats(state).chartMs);
    }
  }
});
