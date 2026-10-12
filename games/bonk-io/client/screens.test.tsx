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

  it('holds clocks and disables controls during a pause', () => {
    const html = phone({ ...cv(), paused: true, clockHeldAt: 11_000 });
    expect(html).toContain('Paused — release your holds');
    expect(html).toContain('0:20');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it('an eliminated player is clearly out until next round', () => {
    const html = phone({ ...cv(), alive: false, cause: 'fall' });
    expect(html).toContain('Out until next round');
    expect(html).toContain('You return next round');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
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
