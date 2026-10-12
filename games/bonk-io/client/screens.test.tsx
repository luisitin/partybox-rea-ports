import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider } from '@partybox/game-sdk/ui';
import type { BonkControllerView, BonkTvView } from '../server/index';
import type { Ball } from '../server/types';
import { Controller } from './Controller';
import { Tv } from './Tv';

const players = Array.from({ length: 8 }, (_, slot) => ({
  id: `p${slot + 1}`,
  name: `Player ${slot + 1}`,
  avatarId: 'fox',
  connected: true,
  status: 'active' as const,
}));
const balls: Ball[] = players.map((player, slot) => ({
  id: player.id,
  slot,
  x: 150 + slot * 85,
  y: 300,
  vx: 0,
  vy: 0,
  alive: true,
  heavy: slot === 0,
  move: 0,
  grounded: true,
  controlAt: 0,
  coyote: 0,
  jumpQueued: false,
  diedAt: null,
  cause: null,
}));
const base = {
  gameId: 'bonk-io',
  phaseId: 'play',
  phaseAt: 1000,
  deadline: 31_000,
  paused: false,
  players,
  round: 1,
  rounds: 5,
  began: 1000,
  endsAt: 31_000,
  checked: 0,
  scores: { p1: 2, p2: 2, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0 },
  lastPoints: { p1: 1 },
  lastWinners: ['p1'],
  roundOutcome: 'last-standing' as const,
  aliveCount: 8,
  total: 8,
  platforms: [{ id: 'main', x: 100, y: 340, width: 760, height: 20 }],
  arenaWidth: 960,
  arenaHeight: 540,
  hazard: false,
};
const cv = (phaseId = 'play', stage = true): BonkControllerView => ({
  ...base,
  phaseId,
  me: { id: 'p1', role: 'player' },
  slot: 0,
  alive: true,
  heavy: true,
  move: 0,
  grounded: true,
  departed: false,
  rank: phaseId === 'done' ? 1 : null,
  tied: phaseId === 'done',
  cause: null,
  ...(stage ? { balls } : {}),
});

function phone(view: BonkControllerView, phoneOnly = true): string {
  return renderToStaticMarkup(
    <PhoneOnlyProvider value={phoneOnly}>
      <Controller view={{ ...view, vip: null }} me={players[0]!} send={() => undefined} />
    </PhoneOnlyProvider>,
  );
}

describe('phone stage', () => {
  it.each(['ready', 'play', 'score', 'done'])(
    '%s is a real phone stage without a TV instruction',
    (phase) => {
      const html = phone(cv(phase));
      expect(html).toContain('<svg');
      expect(html).toContain('role="img"');
      expect(html).not.toMatch(/on the TV|Look at the TV|One moment/);
      if (phase === 'score' || phase === 'done') {
        for (const player of players) expect(html).toContain(player.name);
        expect(html).not.toContain('<button');
      }
    },
  );

  it('offers four real hold/tap buttons for an active player and previews them disabled while ready', () => {
    const active = phone(cv());
    expect(active.match(/<button /g)).toHaveLength(4);
    for (const label of ['Hold Left', 'Hold Right', 'Tap Jump', 'Hold Heavy'])
      expect(active).toContain(`aria-label="${label}"`);
    expect(active).not.toContain('disabled=""');
    expect(phone(cv('ready')).match(/disabled=""/g)).toHaveLength(4);
  });

  it.each([
    ['active', {}],
    ['spectator', { me: { id: 'spectator', role: 'spectator' as const }, alive: false }],
    ['out', { alive: false, cause: 'fall' as const }],
    ['left', { alive: false, departed: true, cause: 'left' as const }],
    ['paused', { paused: true, clockHeldAt: 11_000 }],
  ] as const)('the %s play phone identifies the current round after a refresh', (mode, changes) => {
    const html = phone({ ...cv(), round: 3, ...changes });
    expect(html).toContain('Round 3 of 5 · Platforms');
    expect(html.match(/Round 3 of 5/g)).toHaveLength(1);
    if (mode === 'out') expect(html).toContain('You return next round');
    if (mode === 'left') expect(html).toContain('this seat will not return');
    if (mode === 'paused') {
      expect(html).toContain('Paused — release your holds');
      expect(html).toContain('0:20');
    }
    if (mode === 'spectator' || mode === 'left') expect(html).not.toContain('<button');
  });

  it('ready phones identify the round once without repeating it in the get-ready clock', () => {
    const html = phone({ ...cv('ready'), round: 3 });
    const text = html.replace(/<[^>]*>/g, '');
    expect(text.match(/Round 3 of 5/g)).toHaveLength(1);
    expect(html).toContain('Get ready');
  });

  it('a retired ready phone still identifies the round while keeping its permanent-departure message', () => {
    const html = phone({ ...cv('ready'), round: 3, alive: false, departed: true, cause: 'left' });
    expect(html).toContain('You left the match');
    expect(html).toContain('this seat will not return');
    expect(html).toContain('Round 3 of 5 · Get ready');
    expect(html.match(/Round 3 of 5/g)).toHaveLength(1);
    expect(html).not.toContain('<button');
  });

  it('holds clocks and disables controls during a pause', () => {
    const html = phone({ ...cv(), paused: true, clockHeldAt: 11_000 });
    expect(html).toContain('Paused — release your holds');
    expect(html).toContain('0:20');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it('an alive disconnected phone disables its controls until the same pose reconnects', () => {
    const connected = {
      ...cv(),
      heavy: false,
      balls: balls.map((ball) => (ball.id === 'p1' ? { ...ball, heavy: false } : ball)),
    };
    const disconnected = {
      ...connected,
      players: connected.players.map((item) =>
        item.id === 'p1' ? { ...item, connected: false } : item,
      ),
    };
    const offlineHtml = phone(disconnected);
    const restoredHtml = phone({ ...disconnected, players: connected.players });
    expect(offlineHtml).toContain('Disconnected — controls released');
    expect(offlineHtml.match(/disabled=""/g)).toHaveLength(4);
    expect(restoredHtml).not.toContain('Disconnected — controls released');
    expect(restoredHtml).not.toContain('disabled=""');
    expect(restoredHtml.match(/<button /g)).toHaveLength(4);
    expect(offlineHtml.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]).toBe(
      restoredHtml.match(/<svg\b[\s\S]*?<\/svg>/)?.[0],
    );
  });

  it('a disconnected final-round eliminated seat retains its truthful results-watching copy', () => {
    const html = phone({
      ...cv(),
      round: 5,
      alive: false,
      cause: 'fall',
      players: players.map((item) => (item.id === 'p1' ? { ...item, connected: false } : item)),
    });
    expect(html).toContain('Out of the final round');
    expect(html).toContain('Final results are next');
    expect(html).not.toContain('You return next round');
    expect(html).not.toContain('<button');
  });

  it.each([true, false])(
    'an eliminated player watches the public roster until next round (phone-only %s)',
    (phoneOnly) => {
      const html = phone({ ...cv('play', phoneOnly), alive: false, cause: 'fall' }, phoneOnly);
      expect(html).toContain('Out until next round');
      expect(html).toContain('You return next round');
      expect(html).not.toContain('<button');
      for (const player of players) expect(html).toContain(player.name);
      expect(html).toContain('Wins');
      const ownRow = html.match(/<li\b[^>]*data-me="true"[^>]*>[\s\S]*?<\/li>/)?.[0];
      expect(ownRow).toContain('data-out="true"');
      expect(ownRow).toContain('Player 1');
      expect(ownRow).toContain('>Out</span>');
      expect(html.includes('role="img"')).toBe(phoneOnly);
      const nextReady = phone({ ...cv('ready', phoneOnly), round: 2 }, phoneOnly);
      expect(nextReady.match(/<button /g)).toHaveLength(4);
      expect(nextReady.match(/disabled=""/g)).toHaveLength(4);
      const nextPlay = phone({ ...cv('play', phoneOnly), round: 2 }, phoneOnly);
      expect(nextPlay.match(/<button /g)).toHaveLength(4);
      expect(nextPlay).not.toContain('disabled=""');
    },
  );

  it.each([4, 5])(
    'round %i eliminated phone and TV copy only promise a return when a round remains',
    (round) => {
      const outBalls = balls.map((ball) =>
        ball.id === 'p1'
          ? {
              ...ball,
              alive: false,
              heavy: false,
              cause: 'fall' as const,
            }
          : ball,
      );
      const common = { round, balls: outBalls, aliveCount: 7 };
      const phoneHtml = phone({ ...cv(), ...common, alive: false, cause: 'fall' });
      const tvView: BonkTvView = { ...base, ...common };
      const tvHtml = renderToStaticMarkup(<Tv view={{ ...tvView, vip: null }} />);
      if (round === 5) {
        expect(phoneHtml).toContain('Out of the final round');
        expect(phoneHtml).toContain('Final results are next');
        expect(tvHtml).toContain('Out · final round');
        for (const html of [phoneHtml, tvHtml]) expect(html).not.toContain('next round');
      } else {
        expect(phoneHtml).toContain('Out until next round');
        expect(phoneHtml).toContain('You return next round');
        expect(tvHtml).toContain('Out · next round');
      }
      expect(phoneHtml).not.toContain('<button');
    },
  );

  it('a retired final-round seat watches without any promise of a return', () => {
    const leftBalls = balls.map((ball) =>
      ball.id === 'p1'
        ? {
            ...ball,
            alive: false,
            heavy: false,
            cause: 'left' as const,
          }
        : ball,
    );
    const html = phone({
      ...cv(),
      round: 5,
      balls: leftBalls,
      aliveCount: 7,
      alive: false,
      departed: true,
      cause: 'left',
    });
    expect(html).toContain('You left the match');
    expect(html).toContain('this seat will not return');
    expect(html).not.toContain('next round');
    expect(html).not.toContain('<button');
  });

  it('spectators and permanent departures watch the stage and all eight standings without controls', () => {
    for (const view of [
      { ...cv(), me: { id: 'spectator', role: 'spectator' as const }, alive: false },
      { ...cv(), departed: true, alive: false, cause: 'left' as const },
    ]) {
      const html = phone(view, false);
      expect(html).toContain('<svg');
      expect(html).not.toContain('<button');
      for (const player of players) expect(html).toContain(player.name);
      if (view.departed) {
        expect(html).toContain('this seat will not return');
        expect(html).not.toContain('You return next round');
      }
    }
  });

  it('keeps shared ranks visible instead of breaking a tied match by seat order', () => {
    const html = phone(cv('done'));
    expect(html).toContain('Shared victory!');
    expect(html).toContain('Place 1 · tied · 2 wins');
    expect(html).toContain('Place 1, tied');
    expect(html.match(/>1=</g)).toHaveLength(2);
    expect(html).toContain('Place · = tied');
    expect(html).toContain('Wins');
  });

  it('final-round score spectators are told results are coming rather than another round', () => {
    const html = phone({
      ...cv('score'),
      round: 5,
      me: { id: 'spectator', role: 'spectator' },
      alive: false,
    });
    expect(html).toContain('Final results in');
    expect(html).not.toContain('Next round in');
    expect(html).not.toContain('Next in');
    for (const player of players) expect(html).toContain(player.name);
    expect(html).not.toContain('<button');
  });

  it('local play keeps a large identity and four controls without sending players away to a TV', () => {
    const html = phone({ ...cv('play', false), heavy: false }, false);
    expect(html).toContain('Ball 1 · Player 1');
    expect(html).toContain('Your ball');
    expect(html).not.toContain('role="img"');
    expect(html.match(/<button /g)).toHaveLength(4);
  });
});

describe('TV stage', () => {
  it('labels the frozen final round when its winner differs from the overall match winner', () => {
    const finalBalls = balls.map((ball) => ({
      ...ball,
      alive: ball.id === 'p7',
      y: ball.id === 'p7' ? 300 : 600,
      cause: ball.id === 'p7' ? null : ('fall' as const),
    }));
    const common = {
      phaseId: 'done',
      round: 5,
      scores: { p4: 3, p7: 1 },
      lastPoints: { p7: 1 },
      lastWinners: ['p7'],
      roundOutcome: 'last-standing' as const,
      balls: finalBalls,
      aliveCount: 1,
    };
    const tvView: BonkTvView = { ...base, ...common };
    const tvHtml = renderToStaticMarkup(<Tv view={{ ...tvView, vip: null }} />);
    const phoneHtml = phone({
      ...cv('done'),
      ...common,
      me: { id: 'p4', role: 'player' },
      slot: 3,
      rank: 1,
      tied: false,
    });
    for (const html of [tvHtml, phoneHtml]) {
      expect(html).toContain('Player 4 wins!');
      expect(html).toContain('Final round: ball 7 · Player 7 wins +1');
      expect(html).toContain('data-seat-number="7"');
      expect(html).not.toContain('data-seat-number="4"');
    }
    expect(phoneHtml).toContain('Place 1 · 3 wins');
    expect(phoneHtml).toContain('title="Player 4"');
  });

  it.each([
    ['draw', [], 'Final round: drawn — no points'],
    ['timeout', ['p7', 'p2'], 'Final round: balls 2, 7 share +1'],
  ] as const)(
    'labels a final %s without inventing a lone round winner',
    (outcome, winners, label) => {
      const common = { phaseId: 'done', roundOutcome: outcome, lastWinners: [...winners] };
      const tvView: BonkTvView = { ...base, balls, ...common };
      const tvHtml = renderToStaticMarkup(<Tv view={{ ...tvView, vip: null }} />);
      const phoneHtml = phone({ ...cv('done'), ...common });
      for (const html of [tvHtml, phoneHtml]) expect(html).toContain(label);
      expect(phoneHtml).toContain('Place 1 · tied · 2 wins');
    },
  );

  it.each(['ready', 'play', 'score', 'done'])(
    '%s keeps the arena and every seat inspectable',
    (phaseId) => {
      const view: BonkTvView = { ...base, phaseId, balls };
      const html = renderToStaticMarkup(<Tv view={{ ...view, vip: null }} />);
      expect(html).toContain('role="img"');
      for (const player of players) expect(html).toContain(player.name);
      expect(html).toContain('data-seat-number="8"');
      if (phaseId === 'play') expect(html).toContain('Platforms shrink in');
      if (phaseId === 'done') expect(html).toContain('Shared victory');
    },
  );

  it('a skipped round with eight surviving balls reports a draw without claiming nobody survived', () => {
    const common = {
      phaseId: 'score',
      roundOutcome: 'draw' as const,
      aliveCount: 8,
      lastPoints: {},
      lastWinners: [],
    };
    const tvView: BonkTvView = { ...base, balls, ...common };
    const tvHtml = renderToStaticMarkup(<Tv view={{ ...tvView, vip: null }} />);
    const phoneHtml = phone({ ...cv('score'), ...common });
    for (const html of [tvHtml, phoneHtml]) {
      expect(html).toContain('Round drawn — no points');
      expect(html).not.toContain('No survivor');
      expect(html).toContain('8 balls still in');
      for (const player of players) expect(html).toContain(player.name);
    }
  });

  it('explains a shrinking arena and identifies heavy and permanently departed seats in words', () => {
    const view: BonkTvView = {
      ...base,
      balls: balls.map((ball) =>
        ball.slot === 1
          ? {
              ...ball,
              alive: false,
              cause: 'left',
            }
          : ball,
      ),
      hazard: true,
    };
    const html = renderToStaticMarkup(<Tv view={{ ...view, vip: null }} />);
    expect(html).toContain('Platforms shrinking — keep moving!');
    expect(html).toContain('Heavy ▰');
    expect(html).toContain('Left');
    expect(html).toContain('data-hazard="true"');
  });
});
