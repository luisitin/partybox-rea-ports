// Rebuildable phase fixtures and static screen evidence, using the real React components.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import { game } from '../server/index';
import { sketchFor } from '../server/sketch';
import type { State } from '../server/types';

it('builds every declared phase from one real match and renders every surface', async () => {
  const kit = testKit(game, { players: testPlayers(8), settings: { rounds: 1 }, t0: 1_000_000 });
  const choose = kit.start({ seed: 44 });
  let draw = kit.input(choose, choose.drawerId, { type: 'choose', index: 0 });
  sketchFor(draw.word!).forEach((points, seq) => {
    draw = kit.input(
      draw,
      draw.drawerId,
      { type: 'stroke', stroke: { id: seq, seq, color: 0, size: 5, points } },
      draw.began + seq * 100 + 100,
    );
  });
  for (const id of Object.keys(draw.players)
    .filter((id) => id !== draw.drawerId)
    .slice(0, 4))
    draw = kit.input(draw, id, { type: 'guess', text: draw.word!.text }, draw.began + 6000);
  const reveal = kit.vip(draw, 'skip', draw.began + 8000);
  const done = kit.until(reveal, 'done');
  const states: Record<string, State> = { choose, draw, reveal, done };
  const cssPaths = [
    '../client/Board.module.css',
    '../client/Controller.module.css',
    '../client/Tv.module.css',
    '../../../packages/game-sdk/src/controller/Screen.module.css',
    '../../../packages/game-sdk/src/tv/Stage.module.css',
  ];
  const css =
    readFileSync(resolve('design/tokens.css'), 'utf8') +
    '\n' +
    (await Promise.all(cssPaths.map(async (path) => {
      const names = (await import(path)).default as Record<string, string>;
      const raw = readFileSync(resolve('games/draw-and-guess/__tests__', path), 'utf8');
      return raw.replace(/\.([a-zA-Z][\w-]*)/g, (match, name: string) => names[name] ? `.${names[name]}` : match)
        .replace(/global\(([^)]+)\)/g, '$1');
    }))).join('\n');
  const build = process.env['PB_BUILD_ARTIFACTS'] === '1';
  const media = resolve('jobs/P04-draw-and-guess/media');
  if (build) {
    mkdirSync(media, { recursive: true });
    mkdirSync(resolve('games/draw-and-guess/fixtures'), { recursive: true });
  }
  for (const [phase, state] of Object.entries(states)) {
    expect(game.phases).toContain(state.phase.id);
    if (build)
      writeFileSync(
        resolve(`games/draw-and-guess/fixtures/${phase}.json`),
        JSON.stringify(state, null, 2) + '\n',
      );
    for (const mode of [
      'tv',
      'phone-artist',
      'phone-guesser',
      'phone-only-artist',
      'phone-only-guesser',
      'phone-only-spectator',
    ]) {
      const only = mode.includes('only');
      const staged = { ...state, phoneOnly: only };
      const id = mode.includes('spectator')
        ? 'audience'
        : mode.includes('artist')
          ? state.drawerId
          : Object.keys(state.players).find((id) => id !== state.drawerId)!;
      const view = { ...game.controllerView(staged, id), vip: null };
      const body = renderToStaticMarkup(
        <ServerClockProvider offsetMs={state.phase.startedAt - Date.now()}>
          <PhoneOnlyProvider value={only}>
            {mode === 'tv' ? (
              <Tv view={{ ...game.tvView(state), vip: null }} />
            ) : (
              <Controller
                view={view}
                me={state.players[id] ?? { id, name: 'Audience', avatarId: 'fox', connected: true }}
                send={() => undefined}
              />
            )}
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      expect(body).toContain(mode === 'tv' ? 'Live drawing' : '<h2');
      if (mode.includes('spectator')) expect(body).not.toContain('<button');
      if (only) expect(body).not.toContain('on the TV');
      if (!build) continue;
      const tv = mode === 'tv';
      const html = `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${phase} ${mode}</title><style>${css}
        *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);font-size:16px}body{display:flex;flex-direction:column}main{display:flex;min-height:0;flex:1}button,input{font-family:inherit}h1,h2,h3,p{line-height:1.25}.shell{height:${tv ? 0 : 80}px;flex:none;padding:var(--pb-space-4);font-size:var(--pb-font-body);color:var(--pb-text-muted)}
        </style><body>${tv ? '' : '<div class="shell">PB · DRAW · Connected</div>'}<main>${body}</main>${tv ? '' : '<div class="shell">Draw and Guess · phone shell reserved space</div>'}</body></html>`;
      writeFileSync(resolve(media, `${phase}-${mode}.html`), html);
    }
  }
});
