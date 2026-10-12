// Render the playable question, spectator stage and staged podium without a browser process.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { TriviaControllerView } from '../server/index';
import { Controller } from './Controller';
import { Podium } from './Podium';
import { RaceTrack } from './RaceTrack';
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

function threeCorrect(): ReturnType<typeof game.init> {
  let current = state;
  for (let i = 0; i < 3; i++) {
    const question = current.deck[current.runners.p1!.answered]!;
    current = game.reduce(current, {
      type: 'input',
      now: 1100 + i * 200,
      playerId: 'p1',
      input: {
        type: 'answer',
        questionId: question.id,
        index: current.runners.p1!.answered,
        choice: question.correctIndex,
      },
    });
    if (i < 2)
      current = game.reduce(current, {
        type: 'input',
        now: 1200 + i * 200,
        playerId: 'p1',
        input: { type: 'next', index: current.runners.p1!.answered },
      });
  }
  return current;
}

describe('Quizizz screens', () => {
  it.each([false, true])('questions are on active phones (phone-only=%s)', (phoneOnly) => {
    const html = phone(view, phoneOnly);
    expect(html).toContain(renderToStaticMarkup(<h2>{view.question!.prompt}</h2>));
    for (const answer of view.question!.options) expect(html).toContain(answer);
    expect(html).toContain('Choose an answer');
    expect(html).toContain('Earn a power every 3 correct');
    expect(html.match(/class="[^"]*letter/g)).toHaveLength(4);
    expect(html).not.toContain('on the TV');
  });

  const rankingLanes = view.lanes.map((lane) => {
    if (lane.id === 'p1') return { ...lane, answered: 12, correct: 0, score: 0, finished: true };
    if (lane.id === 'p2' || lane.id === 'p3')
      return { ...lane, answered: 3, correct: 3, score: 360 };
    if (lane.id === 'p7') return { ...lane, answered: 6, correct: 6, score: 840 };
    return lane;
  });
  const rankingView: TriviaControllerView = {
    ...view,
    me: { ...view.me, id: 'p2' },
    lanes: rankingLanes,
    answered: 3,
    correct: 3,
    score: 360,
    streak: 3,
    energy: 1,
  };

  it.each([
    { name: 'normal', patch: {} },
    { name: 'high streak', patch: { streak: 12 } },
    { name: 'powers disabled', patch: { powersEnabled: false } },
    { name: 'frozen', patch: { paused: true, clockHeldAt: 1000, freezeUntil: 4000 } },
  ])('live place follows scores, including shared places ($name)', ({ name, patch }) => {
    const html = phone({ ...rankingView, ...patch }, true);
    expect(html).toContain('Tied 2/8');
    expect(html).toContain('> pts</small>');
    expect(html).toContain('>360<small');
    expect(html).not.toContain('Place 1/8');
    if (name === 'powers disabled') expect(html).not.toContain('Power-ups');
    if (name === 'frozen') expect(html).toContain('Frozen · Back in 3s');
    if (name === 'high streak') expect(html).toContain('12 correct in a row');
  });

  it('a points leader outranks a racer who has answered more questions', () => {
    const html = phone(
      {
        ...rankingView,
        me: { ...view.me, id: 'p7' },
        answered: 6,
        correct: 6,
        score: 840,
      },
      true,
    );
    expect(html).toContain('Place 1/8');
    expect(html).toContain('>840<small');
  });

  it('live place still includes scores held by disconnected racers', () => {
    const html = phone(
      {
        ...rankingView,
        lanes: rankingLanes.map((lane) =>
          lane.id === 'p7' ? { ...lane, connected: false } : lane,
        ),
      },
      true,
    );
    expect(html).toContain('Tied 2/8');
  });

  it('freeze choices show score and public place with the highest-scoring rival selected', () => {
    const html = phone(rankingView, true);
    const choices = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)];
    expect(choices.map((choice) => choice[1])).toEqual(['p7', 'p3', 'p4', 'p5', 'p6', 'p8']);
    expect(choices.map((choice) => choice[2])).toEqual([
      '1 · 840 pts · Racer 7',
      '2 · 360 pts · Racer 3',
      '4 · 0 pts · Racer 4',
      '4 · 0 pts · Racer 5',
      '4 · 0 pts · Racer 6',
      '4 · 0 pts · Racer 8',
    ]);
    expect(html).toContain('<option value="p7" selected="">');
    expect(html).toContain('aria-label="Rival to freeze"');
    expect(html).toContain('Racer 7 · Place 1 · 840 points');
    expect(html).toContain('×2 Next correct');
  });

  it('freeze choices exclude self, finished, disconnected and already frozen rivals', () => {
    const html = phone(
      {
        ...rankingView,
        lanes: rankingLanes.map((lane) =>
          lane.id === 'p7'
            ? { ...lane, connected: false }
            : lane.id === 'p3'
              ? { ...lane, frozen: true }
              : lane,
        ),
      },
      true,
    );
    const choices = [...html.matchAll(/<option value="([^"]+)"/g)].map((choice) => choice[1]);
    expect(choices).toEqual(['p4', 'p5', 'p6', 'p8']);
    expect(html).toContain('<option value="p4" selected="">');
    expect(html).toContain('4 · 0 pts · Racer 4');
  });

  it('freeze has a clear disabled empty state when no eligible rival remains', () => {
    const html = phone(
      {
        ...rankingView,
        lanes: rankingLanes.map((lane) => (lane.id === 'p2' ? lane : { ...lane, finished: true })),
      },
      true,
    );
    expect(html).toContain('No rival available');
    expect(html).toMatch(/<select[^>]+disabled=""/);
  });

  it('a permanent leaver who returns sees retained points and the whole race without controls', () => {
    const before = threeCorrect();
    const prompt = before.deck[3]!.prompt;
    const left = game.reduce(before, {
      type: 'player',
      now: 1800,
      playerId: 'p1',
      connected: false,
      gone: 'left',
    });
    const returned = game.reduce(left, {
      type: 'player',
      now: 1900,
      playerId: 'p1',
      connected: true,
    });
    const value = game.controllerView(returned, 'p1');
    expect(value.departed).toBe(true);
    expect(value.question).toBeNull();
    const html = phone(value, true);
    expect(html).toContain('You left this race');
    expect(html).toContain('360 points');
    expect(html).toContain('Your score stays · Watch the race here');
    expect(html).toContain('★ Leader · Left race');
    expect(html).not.toContain('Final answer');
    expect(html).not.toContain(renderToStaticMarkup(<h2>{prompt}</h2>));
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<select');
    expect(html.match(/role="progressbar"/g)).toHaveLength(8);
    for (const player of players) expect(html).toContain(player.name);
  });

  it('a temporary disconnect returns to playable controls', () => {
    const before = game.reduce(threeCorrect(), {
      type: 'input',
      now: 1700,
      playerId: 'p1',
      input: { type: 'next', index: 3 },
    });
    const disconnected = game.reduce(before, {
      type: 'player',
      now: 1800,
      playerId: 'p1',
      connected: false,
    });
    const returned = game.reduce(disconnected, {
      type: 'player',
      now: 1900,
      playerId: 'p1',
      connected: true,
    });
    const value = game.controllerView(returned, 'p1');
    expect(value.departed).toBe(false);
    expect(value.question).not.toBeNull();
    const html = phone(value, true);
    expect(html).toContain(renderToStaticMarkup(<h2>{value.question!.prompt}</h2>));
    expect(html).toContain('<button');
    expect(html).toContain('<select');
    expect(html).not.toContain('You left this race');
  });

  it.each([false, true])(
    'a frozen phone names its rival without exposing a private answer (phone-only=%s)',
    (phoneOnly) => {
      const ready = threeCorrect();
      const frozen = game.reduce(ready, {
        type: 'input',
        now: 1700,
        playerId: 'p1',
        input: { type: 'power', power: 'freeze', target: 'p2', charge: 1 },
      });
      const value = game.controllerView(frozen, 'p2');
      const html = phone({ ...value, paused: true, clockHeldAt: 1700 }, phoneOnly);
      expect(html).toContain('Racer 1 froze you · 3s');
      expect(html.match(/<button[^>]+disabled=""/g)).toHaveLength(6);
      expect(html).not.toContain('Final answer');
      expect(html).toContain(renderToStaticMarkup(<h2>{value.question!.prompt}</h2>));
    },
  );

  it('permanent departure takes priority over frozen and reconnecting labels', () => {
    const lanes = rankingLanes.map((lane) =>
      lane.id === 'p3'
        ? { ...lane, score: 840, departed: true, connected: false, frozen: true }
        : lane,
    );
    const html = renderToStaticMarkup(<RaceTrack lanes={lanes} total={12} compact />);
    expect(html).toContain('★ Tied · Left race');
    const row = html.slice(html.indexOf('title="Racer 3"'), html.indexOf('title="Racer 4"'));
    expect(row).not.toContain('Frozen');
    expect(row).not.toContain('Reconnecting');
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
    expect(html).toContain('Track = answered questions');
  });

  it.each([false, true])('zero-point finishing creates no leader cue (compact=%s)', (compact) => {
    const lanes = view.lanes.map((lane) =>
      lane.id === 'p1' ? { ...lane, answered: 12, finished: true } : lane,
    );
    const html = renderToStaticMarkup(<RaceTrack lanes={lanes} total={12} compact={compact} />);
    expect(html).toContain('✓ Finished');
    expect(html).not.toContain('★ Leader');
    expect(html).not.toContain('★ Tied lead');
    expect(html).toContain('aria-valuenow="12"');
  });

  it.each([
    { label: 'Frozen', patch: { frozen: true } },
    { label: 'Offline', patch: { connected: false } },
    { label: 'Finished', patch: { finished: true, answered: 12 } },
  ])('a positive-score leader keeps its $label state visible', ({ label, patch }) => {
    const lanes = view.lanes.map((lane) =>
      lane.id === 'p7' ? { ...lane, score: 840, answered: 6, ...patch } : lane,
    );
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(<RaceTrack lanes={lanes} total={12} compact={compact} />);
      expect(html.match(/★ Leader/g)).toHaveLength(1);
      expect(html).toContain(`★ Leader · ${label}`);
      expect(html).not.toContain('★ Tied lead');
      expect(html.match(/role="progressbar"/g)).toHaveLength(8);
    }
  });

  it.each([false, true])('positive tied leaders are marked distinctly (compact=%s)', (compact) => {
    const lanes = view.lanes.map((lane) =>
      lane.id === 'p2' || lane.id === 'p3' ? { ...lane, score: 360, answered: 3 } : lane,
    );
    const html = renderToStaticMarkup(<RaceTrack lanes={lanes} total={12} compact={compact} />);
    expect(html.match(/★ Tied lead/g)).toHaveLength(2);
    expect(html).toContain('★ Tied lead · 3/12');
    expect(html).not.toContain('★ Leader');
    expect(html).toContain('aria-valuenow="3"');
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

  it.each([false, true])(
    'terminal standings retain the last explanation without a reading deadline (phone-only=%s)',
    (phoneOnly) => {
      const value = game.controllerView(threeCorrect(), 'p1');
      const html = phone({ ...value, phaseId: 'done', podiumStep: 3, rank: 1 }, phoneOnly);
      expect(html).toContain(value.feedback!.answer);
      expect(html).toContain(value.feedback!.explanation);
      expect(html).toContain('Final answer correct');
      expect(html.match(/role="progressbar"/g)).toHaveLength(8);
      expect(html).not.toContain('<button');
    },
  );

  it.each([false, true])(
    'track colours follow seats when scores reorder the final board (compact=%s)',
    (compact) => {
      const lanes = rankingLanes.map((lane) => ({ ...lane, frozen: false }));
      const colors = (items: typeof lanes) =>
        [
          ...renderToStaticMarkup(
            <RaceTrack lanes={items} total={12} compact={compact} ranked />,
          ).matchAll(
            /style="--pb-lane-color:var\(--pb-player-(\d+)\)[^"]*"[^>]*>.*?title="([^"]+)"/g,
          ),
        ]
          .map((entry) => [entry[2], entry[1]])
          .sort();
      expect(colors(lanes)).toHaveLength(8);
      expect(colors([...lanes].sort((a, b) => b.score - a.score))).toEqual(colors(lanes));
    },
  );

  it('a powers-disabled game promises no unavailable powers', () => {
    const html = phone({ ...view, powersEnabled: false }, true);
    expect(html).not.toContain('Power-ups');
    expect(html).not.toContain('Earn a power');
    expect(html).not.toContain('<select');
  });
});
