// Static client snapshots exercise feedback transitions without running physics or a browser.
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import type { PaperTerritoryControllerView, PaperTerritoryTvView } from '../server/index';
import type { State } from '../server/types';
import { game } from '../server/index';
import readyFixture from '../fixtures/ready.json';
import { Controller } from './Controller';
import { Tv } from './Tv';

const fixture = readyFixture as unknown as State;
const NOW = 1_006_000;
type TvSnapshot = PaperTerritoryTvView & { vip: null };

function snapshot(areas = [30, 20, 20, 19, 18, 17, 16, 15]): TvSnapshot {
  return {
    gameId: 'paper-io',
    phaseId: 'play',
    phaseAt: NOW - 2000,
    deadline: NOW + 118_000,
    paused: false,
    vip: null,
    players: Object.values(fixture.players).map((player) => ({ ...player, status: 'active' })),
    width: fixture.world.width,
    height: fixture.world.height,
    began: NOW - 2000,
    endsAt: NOW + 118_000,
    checked: 2000,
    scores: Object.fromEntries(fixture.world.runners.map((runner, i) => [runner.id, areas[i]!])),
    owners: fixture.world.owners,
    runners: fixture.world.runners.map(({ respawnTick: _tick, queued, ...runner }, i) => ({
      ...runner,
      dir: queued,
      movingDir: runner.dir,
      area: areas[i]!,
      trail: [],
      alive: true,
      captures: 0,
      lastCapture: 0,
      cause: null,
      respawnAt: null,
    })),
  };
}

function phone(view: TvSnapshot, id = 'p1', only = true): string {
  const runner = view.runners.find((candidate) => candidate.id === id)!;
  const controller: PaperTerritoryControllerView & { vip: null } = {
    ...view,
    me: { id, role: 'player' },
    slot: runner.slot,
    area: runner.area,
    alive: runner.alive,
    dir: runner.dir,
    movingDir: runner.movingDir,
    deaths: runner.deaths,
    captures: runner.captures,
    lastCapture: runner.lastCapture,
    cause: runner.cause,
    respawnAt: runner.respawnAt,
    rank: null,
    tied: false,
  };
  if (!only) delete controller.owners;
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={NOW - Date.now()}>
      <PhoneOnlyProvider value={only}>
        <Controller view={controller} me={fixture.players[id]!} send={() => undefined} />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

function tv(view: TvSnapshot): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={NOW - Date.now()}>
      <Tv view={view} />
    </ServerClockProvider>,
  );
}

function spectator(view: TvSnapshot, only: boolean): string {
  const controller: PaperTerritoryControllerView & { vip: null } = {
    ...view,
    me: { id: 'audience', role: 'spectator' },
    slot: -1,
    area: 0,
    alive: false,
    dir: 0,
    movingDir: 0,
    deaths: 0,
    captures: 0,
    lastCapture: 0,
    cause: null,
    respawnAt: null,
    rank: null,
    tied: false,
  };
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={NOW - Date.now()}>
      <PhoneOnlyProvider value={only}>
        <Controller
          view={controller}
          me={{ id: 'audience', name: 'Audience', avatarId: 'fox' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}

describe('TV departure feedback', () => {
  it.each([undefined, 'left', 'kicked'] as const)(
    'distinguishes a temporary drop from permanent departure (%s)',
    (gone) => {
      const initial = game.init({
        players: Object.values(fixture.players),
        settings: {},
        seed: 7,
        now: NOW,
      });
      let state = game.reduce(initial, {
        type: 'timer',
        now: initial.phase.deadline!,
        phaseId: 'ready',
        startedAt: initial.phase.startedAt,
      });
      state = game.reduce(state, {
        type: 'player',
        now: state.began + 1000,
        playerId: 'p1',
        connected: false,
        ...(gone ? { gone } : {}),
      });
      const html = tv({ ...game.tvView(state), vip: null });
      expect(html).toContain(gone ? '>Left</span>' : '>Disconnected</span>');
      expect(html).not.toContain('>Returning</span>');
      if (gone) {
        for (const only of [false, true]) {
          const controller = { ...game.controllerView(state, 'p1'), vip: null };
          const leftPhone = renderToStaticMarkup(
            <PhoneOnlyProvider value={only}>
              <Controller view={controller} me={state.players['p1']!} send={() => undefined} />
            </PhoneOnlyProvider>,
          );
          expect(leftPhone).toContain('You left the race');
          expect(leftPhone).toContain('Watching now — this seat will not return');
          expect(leftPhone).toContain('role="img"');
          expect(leftPhone).toContain('Live standings');
          expect(leftPhone).not.toContain('<button');
          expect(leftPhone).not.toContain('Back home soon');
          expect(leftPhone).not.toContain('waiting to return home');
        }
      }
      if (!gone) {
        state = game.reduce(state, {
          type: 'player',
          now: state.began + 1100,
          playerId: 'p1',
          connected: true,
        });
        expect(tv({ ...game.tvView(state), vip: null })).toContain('>Returning</span>');
      }
    },
  );
});

describe('spectator live map and roster', () => {
  it('identifies all eight map seats with public names, current areas and tied ranks in either room', () => {
    const view = snapshot([90, 90, 44, 40, 30, 20, 10, 9]);
    for (const only of [false, true]) {
      const html = spectator(view, only);
      const roster = html.match(/<ul[^>]*aria-label="Live standings"[^>]*>([\s\S]+?)<\/ul>/)?.[1];
      expect(roster).toBeDefined();
      expect(roster?.match(/<li\b/g)).toHaveLength(8);
      for (const player of view.players) expect(roster).toContain(player.name);
      expect(roster?.match(/Place 1 · 90 cells/g)).toHaveLength(2);
      expect(roster).toContain('Place 3 · 44 cells');
      expect(roster).toContain('Place 8 · 9 cells');
      expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('aria-label="Live standings"'));
    }
  });

  it('keeps the public map and gives local and phone-only spectators no active controls', () => {
    const view = snapshot();
    for (const only of [false, true]) {
      const html = spectator(view, only);
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label="Live standings"');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('Direction controls');
      expect(html).not.toContain('on the TV');
    }
  });
});

describe('crash rules before the first move', () => {
  it.each([false, true])(
    'teaches every crash and extra-land loss on the phone (stage=%s)',
    (only) => {
      const view = snapshot();
      view.phaseId = 'ready';
      view.deadline = NOW + 4000;
      const html = phone(view, 'p1', only);
      expect(html).toContain('Walls, your own trail and head crashes cost all extra land.');
      expect(html).toMatch(/<b>4<\/b>/);
      expect(html).toContain('Loop back to your land to claim it.');
      expect(html).not.toContain('off lead');
    },
  );

  it('teaches all crash types in the existing TV ready legend', () => {
    const view = snapshot();
    view.phaseId = 'ready';
    expect(tv(view)).toContain(
      'Avoid walls, your own trail and head crashes. A crash clears all extra land.',
    );
  });
});

describe('honest closure feedback', () => {
  it.each([19, 123])('shows the actual +%i closure gain on the phone and TV', (gain) => {
    const view = snapshot();
    view.runners[0]!.captures = 1;
    view.runners[0]!.lastCapture = gain;
    expect(phone(view)).toContain(`Loop closed · +${gain} cells`);
    expect(tv(view)).toContain(`>+${gain} cells</span>`);
    expect(tv(view)).not.toContain('Loop closed');
    // A closure replaces the existing status rather than adding another play row.
    expect(phone(view).match(/role="status"/g)).toHaveLength(1);
  });

  it.each(['trail', 'death', 'paused'] as const)(
    'replaces capture feedback upon %s',
    (transition) => {
      const view = snapshot();
      const runner = view.runners[0]!;
      runner.captures = 1;
      runner.lastCapture = 19;
      if (transition === 'trail') runner.trail = [runner.cell];
      if (transition === 'death') {
        runner.alive = false;
        runner.cause = 'head';
        runner.respawnAt = NOW + 3000;
      }
      if (transition === 'paused') {
        view.paused = true;
        view.clockHeldAt = NOW;
      }
      expect(phone(view)).not.toContain('Loop closed');
      expect(tv(view)).not.toContain('>+19 cells</span>');
      if (transition === 'trail') {
        expect(phone(view)).toContain('1 trail cells — return to your land');
        expect(tv(view)).toContain('Trail out');
      }
      if (transition === 'death') {
        expect(phone(view)).toContain('Head collision');
        expect(tv(view)).toContain('Head crash');
      }
      if (transition === 'paused')
        expect(phone(view)).toContain('Paused — your trail is safe for now');
    },
  );

  it('does not invent a closure before the first capture', () => {
    const view = snapshot();
    expect(phone(view)).toContain('Inside your land · safe trail');
    expect(phone(view)).not.toContain('Loop closed');
    expect(tv(view)).not.toMatch(/>\+\d+ cells<\/span>/);
  });

  it('does not treat a zero-gain closure as a positive claim', () => {
    const view = snapshot();
    view.runners[0]!.captures = 1;
    view.runners[0]!.lastCapture = 0;
    expect(phone(view)).toContain('Inside your land · safe trail');
    expect(phone(view)).not.toContain('Loop closed');
    expect(tv(view)).not.toContain('>+0 cells</span>');
  });

  it('clears the old gain after a crash and keeps it cleared when the home runner returns', () => {
    const view = snapshot();
    const runner = view.runners[0]!;
    runner.captures = 12;
    runner.lastCapture = 19;
    expect(phone(view)).toContain('Loop closed · +19 cells');
    // Crash preserves lifetime captures, but removes extra land and resets the gain.
    runner.alive = false;
    runner.cause = 'cut';
    runner.area = view.scores['p1'] = 9;
    runner.trail = [];
    runner.lastCapture = 0;
    runner.respawnAt = NOW + 3000;
    expect(phone(view)).toContain('Trail cut');
    expect(phone(view)).not.toContain('Loop closed');
    runner.alive = true;
    runner.cause = null;
    runner.cell = runner.home;
    runner.respawnAt = null;
    expect(phone(view)).toContain('Inside your land · safe trail');
    expect(phone(view)).not.toContain('Loop closed');
    expect(tv(view)).not.toContain('>+0 cells</span>');
  });

  it('bounds TV gain copy to one ellipsized line without reducing typography', () => {
    const css = readFileSync(new URL('./Tv.module.css', import.meta.url), 'utf8');
    const status = css.match(/\.person span\s*\{([^}]+)\}/)?.[1];
    expect(status).toContain('white-space: nowrap');
    expect(status).toContain('text-overflow: ellipsis');
    expect(status).not.toContain('font-size');
  });
});

describe('live leaders from current owned cells', () => {
  it('preserves long player identities and four-digit score labels in the TV markup', () => {
    const view = snapshot([1057, 9, 9, 9, 9, 9, 9, 9]);
    view.players = view.players.map((player, index) => ({
      ...player,
      name: `LongUnbrokenPlayerName${index + 1}`,
    }));
    const html = tv(view);
    for (const player of view.players) expect(html).toContain(player.name);
    expect(html).toContain('1057 cells');
    expect(html).toContain('94.4%');
  });

  it('names the sole leader and exact margin in existing header space', () => {
    const view = snapshot([42, 30, 20, 19, 18, 17, 16, 15]);
    expect(phone(view)).toContain('Leading · 12 ahead');
    expect(phone(view, 'p2')).toContain('#1 leads · 12 off');
    expect(phone(view, 'p2')).toContain('<dt>Place</dt><dd>2</dd>');
    expect(tv(view)).toContain('Ana leads · 12 cells ahead');
  });

  it('respects tied leaders and competition ranks for everyone behind them', () => {
    const view = snapshot([45, 45, 20, 19, 18, 17, 16, 15]);
    expect(phone(view)).toContain('Tied for lead · 2');
    expect(phone(view, 'p2')).toContain('Tied for lead · 2');
    expect(phone(view, 'p3')).toContain('2 tied leaders · 25 off');
    expect(phone(view, 'p3')).toContain('<dt>Place</dt><dd>3</dd>');
    expect(tv(view)).toContain('2 share the lead · 45 cells');
    expect(tv(view).match(/>Tied lead<\/span>/g)).toHaveLength(2);
  });

  it('updates rank and gap after territory loss without treating the previous gain as the score', () => {
    const view = snapshot([72, 20, 20, 20, 20, 20, 20, 20]);
    view.runners[0]!.captures = 1;
    view.runners[0]!.lastCapture = 19;
    expect(phone(view)).toContain('Leading · 52 ahead');
    view.scores['p1'] = view.runners[0]!.area = 9;
    expect(phone(view)).toContain('7 tied leaders · 11 off');
    expect(phone(view)).toContain('<dt>Place</dt><dd>8</dd>');
    expect(tv(view)).toContain('7 share the lead · 20 cells');
    expect(phone(view)).toContain('Loop closed · +19 cells');
    expect(phone(view)).not.toContain('Leading · 52 ahead');
    expect(tv(view)).not.toContain('Ana leads');
  });

  it('changes the target seat when the previous leader loses ownership', () => {
    const view = snapshot([30, 20, 20, 19, 18, 42, 16, 15]);
    expect(phone(view)).toContain('#6 leads · 12 off');
    view.scores['p6'] = view.runners[5]!.area = 9;
    view.scores['p8'] = view.runners[7]!.area = 44;
    expect(phone(view)).toContain('#8 leads · 14 off');
    expect(phone(view)).not.toContain('#6 leads');
    expect(phone(view)).toContain('<dt>Place</dt><dd>2</dd>');
    expect(tv(view)).toContain('Hal leads · 14 cells ahead');
  });
});
