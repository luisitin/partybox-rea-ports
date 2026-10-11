// Render the playable question, spectator stage and staged podium without a browser process.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { TriviaControllerView } from '../server/index';
import { Controller } from './Controller';
import { Podium } from './Podium';
import { Tv } from './Tv';

const players = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Racer ${i + 1}`,
  avatarId: 'fox',
  connected: true,
}));
const state = game.init({ players, settings: {}, seed: 3, now: 1000 });
const view = game.controllerView(state, 'p1');

function phone(value: TriviaControllerView, phoneOnly: boolean): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller
        view={{ ...value, vip: null, deadline: 2000000000000 }}
        me={players[0]!}
        send={() => undefined}
      />
    </PhoneOnlyProvider>,
  );
}

describe('Trivia Lightning screens', () => {
  it.each([false, true])('questions are on active phones (phone-only=%s)', (phoneOnly) => {
    const html = phone(view, phoneOnly);
    expect(html).toContain(renderToStaticMarkup(<h2>{view.question!.prompt}</h2>));
    for (const answer of view.question!.options) expect(html).toContain(answer);
    expect(html).toContain('Choose an answer');
    expect(html).toContain('Earn a power every 3 correct');
    expect(html.match(/class="[^"]*letter/g)).toHaveLength(4);
    expect(html).not.toContain('on the TV');
  });

  it.each([false, true])(
    'spectators get the public track and no buttons (phone-only=%s)',
    (phoneOnly) => {
      const html = phone(game.controllerView(state, 'spectator'), phoneOnly);
      expect(html).not.toContain('<button');
      expect(html).not.toContain('<select');
      expect(html).not.toContain(view.question!.prompt);
      expect(html.match(/role="progressbar"/g)).toHaveLength(8);
      for (const player of players) expect(html).toContain(player.name);
    },
  );

  it('TV shows progress and score without a question or answer', () => {
    const html = renderToStaticMarkup(<Tv view={{ ...game.tvView(state), vip: null }} />);
    expect(html).toContain('Highest score wins');
    expect(html).not.toContain(view.question!.prompt);
    for (const answer of view.question!.options) expect(html).not.toContain(`>${answer}<`);
    expect(html.match(/role="progressbar"/g)).toHaveLength(8);
  });

  it('private feedback names the correct previous answer and a next action', () => {
    const html = phone(
      {
        ...view,
        question: null,
        answered: 1,
        feedback: {
          correct: false,
          points: 0,
          answer: 'Previous answer',
          explanation: 'A useful explanation.',
        },
      },
      true,
    );
    expect(html).toContain('Previous answer');
    expect(html).toContain('A useful explanation.');
    expect(html).toContain('Next question');
    expect(html).not.toContain(view.question!.prompt);
  });

  it.each([false, true])('podium retains the final answer verdict (correct=%s)', (correct) => {
    const html = phone(
      {
        ...view,
        phaseId: 'podium',
        podiumStep: 1,
        question: null,
        answered: view.total,
        finished: true,
        feedback: {
          correct,
          points: correct ? 160 : 0,
          answer: 'Final answer text',
          explanation: 'The final explanation remains readable.',
        },
      },
      true,
    );
    expect(html).toContain(correct ? '✓ Final answer correct' : '✗ Final answer incorrect');
    expect(html).toContain(correct ? '+160 pts' : '+0 pts');
    expect(html).toContain('Final answer text');
    expect(html).toContain('The final explanation remains readable.');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Next question');
  });

  it('third and second are visible before the winner on both surfaces', () => {
    const lanes = view.lanes.slice(0, 3).map((lane, i) => ({
      ...lane,
      name: ['UnshownWinner', 'UnshownSecond', 'ThirdPlace'][i]!,
      score: [300, 200, 100][i]!,
    }));
    for (const compact of [false, true]) {
      const third = renderToStaticMarkup(<Podium lanes={lanes} step={1} compact={compact} />);
      expect(third).toContain('ThirdPlace');
      expect(third).not.toContain('UnshownWinner');
      expect(third).not.toContain('UnshownSecond');
      const second = renderToStaticMarkup(<Podium lanes={lanes} step={2} compact={compact} />);
      expect(second).toContain('UnshownSecond');
      expect(second).not.toContain('UnshownWinner');
      expect(renderToStaticMarkup(<Podium lanes={lanes} step={3} compact={compact} />)).toContain(
        'UnshownWinner',
      );
    }
  });

  it('all eight tied racers share first place', () => {
    const html = phone({ ...view, phaseId: 'done', podiumStep: 3, rank: 1 }, true);
    expect(html).toContain('Shared first place!');
    expect(html).toContain('Tied');
    for (const player of players) expect(html).toContain(player.name);
    expect(html).not.toContain('<button');
  });

  it('an eight-way podium tie reveals every full-length name together', () => {
    const lanes = view.lanes.map((lane, i) => ({
      ...lane,
      name: `Alexandria Robertson ${String(i + 1).padStart(3, '0')}`,
    }));
    for (const compact of [false, true]) {
      const before = renderToStaticMarkup(<Podium lanes={lanes} step={2} compact={compact} />);
      const after = renderToStaticMarkup(<Podium lanes={lanes} step={3} compact={compact} />);
      for (const lane of lanes) {
        expect(lane.name).toHaveLength(24);
        expect(before).not.toContain(lane.name);
        expect(after).toContain(lane.name);
      }
      expect(after).toContain('Tied');
      expect(after).not.toContain('aria-label="Place 2"');
      expect(after).not.toContain('aria-label="Place 3"');
    }
  });

  it('final standings include lower-ranked racers and hide gameplay controls', () => {
    const lanes = view.lanes.map((lane, i) => ({ ...lane, score: 800 - i * 100 }));
    const html = phone({ ...view, lanes, phaseId: 'done', podiumStep: 3, rank: 1 }, true);
    for (const player of players) expect(html).toContain(player.name);
    expect(html).toContain('Place 8');
    expect(html).not.toContain('<button');
    expect(html.match(/role="progressbar"/g)).toHaveLength(8);
  });

  it('a powers-disabled game promises no unavailable powers', () => {
    const html = phone({ ...view, powersEnabled: false }, true);
    expect(html).not.toContain('Power-ups');
    expect(html).not.toContain('Earn a power');
    expect(html).not.toContain('<select');
  });
});
