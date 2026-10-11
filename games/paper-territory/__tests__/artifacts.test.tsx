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
import type { State } from '../server/types';

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
      const html = `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${phase} ${mode}</title><style>${css}
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:16px}body{display:flex;flex-direction:column}main{display:flex;min-height:0;flex:1}button,input{font-family:inherit}h1,h2,h3,p{line-height:1.25}.shell{height:${tv ? 0 : 80}px;flex:none;padding:var(--pb-space-4);font-size:var(--pb-font-body);color:var(--pb-text-muted)}
      </style><body>${tv ? '' : '<div class="shell">PB · TERRITORY · Connected</div>'}<main>${body}</main>${tv ? '' : '<div class="shell">Paper Territory · phone shell reserved space</div>'}</body></html>`;
      writeFileSync(resolve(media, `${phase}-${mode}.html`), html);
    }
  }
});
