// Reproducible phase fixtures and styled static screens from one actual eight-player match.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import type { Direction, State } from '../server/types';
import { neighbour } from '../server/world';

const LONG_NAMES = [
  'Alexandria Montgomery',
  'Benedict Cunningham',
  'Cassandra Wellington',
  'Dominic Featherstone',
  'Elisabeth Rutherford',
  'Frederick Kensington',
  'Gabriella Worthington',
  'Harrison Chamberlain',
] as const;

function adjacentFixture(fixture: State, horizontal: boolean): State {
  const { width, homes } = fixture.world;
  const rivalHome = fixture.world.runners[1]!.home;
  const axis = horizontal ? 1 : width;
  const dir: Direction = horizontal ? 0 : 1;
  const owners = homes.map((owner) => (owner < 0 ? 0 : owner));
  const runners = fixture.world.runners.map((runner) => ({
    ...runner,
    cell:
      runner.slot === 0 ? rivalHome - axis * 2 : runner.slot === 1 ? rivalHome - axis : runner.home,
    dir,
    queued: dir,
    trail: [],
    alive: true,
    respawnTick: null,
    cause: null,
    area: owners.filter((owner) => owner === runner.slot).length,
    captures: runner.slot === 0 ? 1 : 0,
    lastCapture: runner.slot === 0 ? 1048 : 0,
  }));
  return {
    ...fixture,
    players: Object.fromEntries(
      runners.map((runner) => [
        runner.id,
        { ...fixture.players[runner.id]!, name: LONG_NAMES[runner.slot] ?? '' },
      ]),
    ),
    world: { ...fixture.world, owners, runners },
    scores: Object.fromEntries(runners.map((runner) => [runner.id, runner.area])),
  };
}

function pageHtml(body: string, title: string, css: string, tv: boolean): string {
  return `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:16px}body{display:flex;flex-direction:column}main{display:flex;min-height:0;flex:1}button,input{font-family:inherit}h1,h2,h3,p{line-height:1.25}.shell{height:${tv ? 0 : 80}px;flex:none;padding:var(--pb-space-4);font-size:var(--pb-font-body);color:var(--pb-text-muted)}
      </style><body>${tv ? '' : '<div class="shell">PB · TERRITORY · Connected</div>'}<main>${body}</main>${tv ? '' : '<div class="shell">Paper Territory · phone shell reserved space</div>'}</body></html>`;
}

it('renders every phase for TV, player, stage, remote and spectator from a real match', async () => {
  const players = testPlayers(8, { bots: 8 });
  const kit = testKit(game, { players, t0: 1_000_000 });
  const rng = createRng(73);
  const ready = kit.start({ seed: 73 });
  let state = kit.timer(ready);
  let play = state;
  while (state.phase.id === 'play') {
    const at = state.phase.deadline!;
    for (const p of players) {
      const input = game.bot.sampleInput(state, p.id, rng, 'normal');
      if (input) state = kit.input(state, p.id, input, at - 1);
    }
    state = kit.timer(state, at);
    if (state.phase.id === 'play' && state.checked <= 16_000) play = state;
  }
  const score = state;
  const done = kit.timer(score);
  const states: Record<string, State> = { ready, play, score, done };
  const cssPaths = [
    '../client/Map.module.css',
    '../client/OwnershipPattern.module.css',
    '../client/SeatBadge.module.css',
    '../client/Controller.module.css',
    '../client/Tv.module.css',
    '../../../packages/game-sdk/src/controller/Screen.module.css',
    '../../../packages/game-sdk/src/tv/Stage.module.css',
  ];
  const css =
    readFileSync(resolve('design/tokens.css'), 'utf8') +
    '\n' +
    (
      await Promise.all(
        cssPaths.map(async (path) => {
          const names = (await import(path)).default as Record<string, string>;
          return readFileSync(resolve('games/paper-territory/__tests__', path), 'utf8')
            .replace(/\.([a-zA-Z][\w-]*)/g, (match, name: string) =>
              names[name] ? `.${names[name]}` : match,
            )
            .replace(/global\(([^)]+)\)/g, '$1');
        }),
      )
    ).join('\n');
  const build = process.env['PB_BUILD_ARTIFACTS'] === '1';
  const media = resolve('jobs/P07-paper-territory/media');
  if (build) {
    mkdirSync(media, { recursive: true });
    mkdirSync(resolve('games/paper-territory/fixtures'), { recursive: true });
  }
  for (const [phase, fixture] of Object.entries(states)) {
    expect(fixture.phase.id).toBe(phase);
    if (build)
      writeFileSync(
        resolve(`games/paper-territory/fixtures/${phase}.json`),
        JSON.stringify(fixture, null, 2) + '\n',
      );
    for (const mode of [
      'tv',
      'phone',
      'phone-only',
      'phone-remote',
      'phone-spectator',
      'phone-only-spectator',
      ...(phase === 'play'
        ? ['phone-out', 'phone-only-out', 'phone-paused', 'phone-only-paused']
        : []),
    ]) {
      const only = mode.includes('only');
      const id = mode.includes('spectator')
        ? 'audience'
        : (fixture.world.runners.find((r) => (mode.includes('out') ? !r.alive : r.alive))?.id ??
          players[0]!.id);
      let staged: State = {
        ...fixture,
        phoneOnly: only,
        players:
          mode === 'phone-remote'
            ? { ...fixture.players, [id]: { ...fixture.players[id]!, canSeeTv: false } }
            : fixture.players,
      };
      if (mode.includes('paused')) staged = kit.vip(staged, 'pause', staged.began + staged.checked);
      const view = { ...game.controllerView(staged, id), vip: null };
      const now = phase === 'play' ? fixture.began + fixture.checked : fixture.phase.startedAt;
      const body = renderToStaticMarkup(
        <ServerClockProvider offsetMs={now - Date.now()}>
          <PhoneOnlyProvider value={only}>
            {mode === 'tv' ? (
              <Tv view={{ ...game.tvView(fixture), vip: null }} />
            ) : (
              <Controller
                view={view}
                me={
                  fixture.players[id] ?? { id, name: 'Audience', avatarId: 'fox', connected: true }
                }
                send={() => undefined}
              />
            )}
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      expect(body).toContain('<h2');
      if (mode.includes('spectator')) expect(body).not.toContain('<button');
      if (only || mode === 'phone-remote') expect(body).not.toContain('on the TV');
      if (!build) continue;
      const tv = mode === 'tv';
      writeFileSync(
        resolve(media, `${phase}-${mode}.html`),
        pageHtml(body, `${phase} ${mode}`, css, tv),
      );
    }
  }
  if (build) {
    for (const mode of ['phone-only', 'phone-only-spectator'] as const) {
      const fixture: State = {
        ...done,
        phoneOnly: true,
        players: Object.fromEntries(
          Object.entries(done.players).map(([id, player], index) => [
            id,
            { ...player, name: LONG_NAMES[index] ?? '' },
          ]),
        ),
      };
      const id = mode.includes('spectator') ? 'audience' : players[0]!.id;
      const body = renderToStaticMarkup(
        <PhoneOnlyProvider value>
          <Controller
            view={{ ...game.controllerView(fixture, id), vip: null }}
            me={fixture.players[id] ?? { id, name: 'Audience', avatarId: 'fox' }}
            send={() => undefined}
          />
        </PhoneOnlyProvider>,
      );
      expect(body).toContain('data-compact="true"');
      for (const name of LONG_NAMES) expect(body).toContain(name);
      writeFileSync(
        resolve(media, `done-long-${mode}.html`),
        pageHtml(body, `done long ${mode}`, css, false),
      );
    }
    for (const mode of ['tv', 'phone-only-spectator'] as const) {
      const tv = mode === 'tv';
      // One legal pair per surface: isolated protected homes and 1057/9×7 land
      // cannot support two disjoint trail-free pairs in the same snapshot.
      const fixture = adjacentFixture(play, tv);
      expect(fixture.world.runners.map((runner) => runner.area)).toEqual([
        1057, 9, 9, 9, 9, 9, 9, 9,
      ]);
      expect(new Set(fixture.world.runners.map((runner) => runner.cell)).size).toBe(8);
      expect(fixture.world.runners[1]!.cell - fixture.world.runners[0]!.cell).toBe(
        tv ? 1 : fixture.world.width,
      );
      for (const runner of fixture.world.runners) {
        expect(runner.alive).toBe(true);
        expect(runner.trail).toEqual([]);
        expect(fixture.world.owners[runner.cell]).toBe(runner.slot);
      }
      expect(
        fixture.world.homes.every((home, cell) => home < 0 || fixture.world.owners[cell] === home),
      ).toBe(true);
      const next = fixture.world.runners.map((runner) => neighbour(runner.cell, runner.dir));
      expect(next).not.toContain(-1);
      expect(new Set(next).size).toBe(8);
      const body = renderToStaticMarkup(
        <ServerClockProvider offsetMs={fixture.began + fixture.checked - Date.now()}>
          <PhoneOnlyProvider value={!tv}>
            {tv ? (
              <Tv view={{ ...game.tvView(fixture), vip: null }} />
            ) : (
              <Controller
                view={{
                  ...game.controllerView({ ...fixture, phoneOnly: true }, 'audience'),
                  vip: null,
                }}
                me={{ id: 'audience', name: 'Audience', avatarId: 'fox' }}
                send={() => undefined}
              />
            )}
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      expect(body.match(/data-head-layer="label"/g)).toHaveLength(8);
      for (const name of LONG_NAMES) expect(body).toContain(name);
      if (!tv) expect(body).not.toContain('<button');
      writeFileSync(
        resolve(media, `play-adjacent-${mode}.html`),
        pageHtml(body, `play adjacent ${mode}`, css, tv),
      );
    }
  }
});
