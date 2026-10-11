// Actual components on every fixture; the same output is the static visual QA artifact.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { Tv } from '../client/Tv';
import { Controller } from '../client/Controller';
import { game } from '../server/index';
import type { State } from '../server/types';
import boardStyles from '../client/Board.module.css';
import phoneStyles from '../client/Controller.module.css';
import tvStyles from '../client/Tv.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';

const media = resolve('jobs/P14-crossy-streets/media');
const modules = [
  ['packages/game-sdk/src/tv/Stage.module.css', stageStyles],
  ['games/crossy-streets/client/Board.module.css', boardStyles],
  ['games/crossy-streets/client/Controller.module.css', phoneStyles],
  ['games/crossy-streets/client/Tv.module.css', tvStyles],
] as const;
function css(): string {
  return (
    readFileSync(resolve('design/tokens.css'), 'utf8') +
    modules
      .map(([path, names]) =>
        readFileSync(resolve(path), 'utf8')
          .replace(/:global\(([^)]+)\)/g, '$1')
          .replace(/\.([a-zA-Z][\w-]*)/g, (full, name: string) =>
            names[name] ? `.${names[name]}` : full,
          ),
      )
      .join('\n')
  );
}
function state(phase: string): State {
  return JSON.parse(
    readFileSync(resolve(`games/crossy-streets/fixtures/${phase}.json`), 'utf8'),
  ) as State;
}
function markup(s: State, surface: 'tv' | 'phone', phoneOnly: boolean, id = 'p1'): string {
  const offsetMs = s.began + s.checked - Date.now();
  const fixture: State = { ...s, ...(phoneOnly ? { phoneOnly: true as const } : {}) };
  const component =
    surface === 'tv' ? (
      <Tv view={{ ...game.tvView(fixture), vip: null }} />
    ) : (
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller
          view={{ ...game.controllerView(fixture, id), vip: null }}
          me={fixture.players[id] ?? { id, name: 'Spectator', avatarId: 'fox' }}
          send={() => undefined}
        />
      </PhoneOnlyProvider>
    );
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={offsetMs}>{component}</ServerClockProvider>,
  );
}
function html(body: string, surface: 'tv' | 'phone'): string {
  return `<!doctype html><html lang="en" data-surface="${surface}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crossy Streets fixture</title><style>${css()}\n*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:var(--pb-font-family);color:var(--pb-text);background:var(--pb-bg)}.host{height:100dvh;display:flex;flex-direction:column}.chrome{height:${surface === 'tv' ? 72 : 64}px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 var(--pb-space-5);font-size:var(--pb-font-body);background:var(--pb-surface)}main{flex:1;display:flex;min-height:0;overflow:hidden}.footer{height:${surface === 'tv' ? 64 : 24}px;flex:none;font-size:var(--pb-font-caption);color:var(--pb-text-muted);display:flex;align-items:center;padding:0 var(--pb-space-5)}</style></head><body><div class="host"><header class="chrome"><b>PartyBox · Crossy Streets</b><span>${surface === 'tv' ? 'ABCD' : 'Racer 1'}</span></header><main>${body}</main><footer class="footer">${surface === 'tv' ? '★ Pause · Finish race' : 'Connected'}</footer></div></body></html>`;
}

describe.each(['play', 'score', 'done'])('screen fixture: %s', (phase) => {
  it('renders the actual TV, phone and phone-only surfaces with all eight players', () => {
    const s = state(phase);
    mkdirSync(media, { recursive: true });
    const tv = markup(s, 'tv', false);
    expect(tv).toContain('Crossing map');
    for (const p of Object.values(s.players)) expect(tv).toContain(p.name);
    writeFileSync(resolve(media, `${phase}-tv.html`), html(tv, 'tv'), 'utf8');
    for (const phoneOnly of [false, true]) {
      const rendered = markup(s, 'phone', phoneOnly);
      if (phase === 'play') {
        expect(rendered).toContain('Crossing map');
        for (const label of ['Hop forward', 'Hop left', 'Hop back', 'Hop right'])
          expect(rendered).toContain(label);
      } else {
        for (const p of Object.values(s.players)) expect(rendered).toContain(p.name);
      }
      if (phoneOnly) expect(rendered).not.toMatch(/Look at the TV|on the TV|One moment/);
      writeFileSync(
        resolve(media, `${phase}-phone${phoneOnly ? '-only' : ''}.html`),
        html(rendered, 'phone'),
        'utf8',
      );
    }
    const spectator = markup(s, 'phone', true, 'a-spectator');
    expect(spectator).toContain('Crossing map');
    expect(spectator).not.toContain('<button');
    writeFileSync(resolve(media, `${phase}-spectator.html`), html(spectator, 'phone'), 'utf8');
  });

  it('keeps the remote personal camera and returns no spectator controls', () => {
    const s = state(phase);
    s.players.p1 = { ...s.players.p1!, canSeeTv: false };
    expect(game.controllerView(s, 'p1').phoneStage).toBe(true);
    expect(markup(s, 'phone', false)).toContain('Crossing map');
    expect(game.controllerView(s, 'a-spectator').own).toBeNull();
  });
});
