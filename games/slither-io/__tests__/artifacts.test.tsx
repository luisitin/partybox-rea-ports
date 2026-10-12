// Reproducible phase fixtures and static, offline review screens (opt-in writes).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { createRng } from '@partybox/game-sdk';
import { Controller } from '../client/Controller';
import { Tv } from '../client/Tv';
import arenaStyles from '../client/Arena.module.css';
import tvStyles from '../client/Tv.module.css';
import phoneStyles from '../client/Controller.module.css';
import controlsStyles from '../client/Controls.module.css';
import standingsStyles from '../client/Standings.module.css';
import stageStyles from '../../../packages/game-sdk/src/tv/Stage.module.css';
import { game } from '../server/index';
import type { State } from '../server/types';

function snapshots(): Record<string, State> {
  let s = game.init({
    players: Array.from({ length: 8 }, (_, i) => ({
      id: `p${i + 1}`,
      name: ['Alex', 'Bailey', 'Cameron', 'Devon', 'Emerson', 'Frankie', 'Gray', 'Harper'][i]!,
      avatarId: 'fox',
      connected: true,
    })),
    settings: {},
    seed: 42,
    now: 1_000_000,
  });
  const rng = createRng(42);
  const out: Record<string, State> = { play: s };
  while (s.phase.id !== 'done') {
    const now = s.phase.deadline!;
    if (s.phase.id === 'play')
      for (const id of Object.keys(s.players)) {
        const input = game.bot.sampleInput(s, id, rng);
        if (input) s = game.reduce(s, { type: 'input', now: now - 1, playerId: id, input });
      }
    const old = s.phase.id;
    s = game.reduce(s, { type: 'timer', now, phaseId: s.phase.id, startedAt: s.phase.startedAt });
    if (s.phase.id === 'play' && s.round === 1 && s.world.elapsed === 7800) out['play'] = s;
    if (old === 'play' && s.phase.id === 'score') out[s.round === 3 ? 'score-last' : 'score'] ??= s;
  }
  out['done'] = s;
  return out;
}

const modules = [
  ['Arena.module.css', arenaStyles],
  ['Tv.module.css', tvStyles],
  ['Controller.module.css', phoneStyles],
  ['Controls.module.css', controlsStyles],
  ['Standings.module.css', standingsStyles],
] as const;
const mappedCss = (source: string, map: Record<string, string>): string =>
  source.replace(/\.([a-zA-Z][\w-]*)/g, (full, key: string) => (map[key] ? `.${map[key]}` : full));
const css = (): string =>
  readFileSync('design/tokens.css', 'utf8') +
  mappedCss(readFileSync('packages/game-sdk/src/tv/Stage.module.css', 'utf8'), stageStyles) +
  modules
    .map(([name, map]) => mappedCss(readFileSync(`games/slither-io/client/${name}`, 'utf8'), map))
    .join('\n');

function documentHtml(body: string, surface: string): string {
  const tv = surface === 'tv';
  return `<!doctype html><html lang="en" data-surface="${tv ? 'tv' : 'phone'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slither.io ${surface}</title><style>${css()}\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family)}#root{width:100%;height:100%;display:flex;flex-direction:column}button{font:inherit;color:inherit}</style></head><body><div id="root">${body}</div></body></html>`;
}

it('every phase renders a real arena for TV, phone-only and spectators', () => {
  const states = snapshots();
  const dir = 'jobs/P06-snake-royale/media';
  const write = process.env['SNAKE_WRITE_ARTIFACTS'] === '1';
  if (write) {
    mkdirSync(dir, { recursive: true });
    mkdirSync('games/slither-io/fixtures', { recursive: true });
  }
  for (const [phase, s] of Object.entries(states)) {
    if (write)
      writeFileSync(`games/slither-io/fixtures/${phase}.json`, JSON.stringify(s, null, 2) + '\n');
    const offset =
      (s.phase.id === 'play' ? s.began + s.world.elapsed : s.phase.startedAt) - Date.now();
    const tv = renderToStaticMarkup(
      <ServerClockProvider offsetMs={offset}>
        <Tv view={{ ...game.tvView(s), vip: null }} />
      </ServerClockProvider>,
    );
    expect(tv).toContain('<svg');
    if (write) writeFileSync(`${dir}/${phase}-tv.html`, documentHtml(tv, 'tv'));
    for (const mode of ['phone', 'phone-only', 'spectator'] as const) {
      const state = { ...s, phoneOnly: mode === 'phone-only' };
      const id = mode === 'spectator' ? 'spectator' : 'p1';
      const view = { ...game.controllerView(state, id), vip: null };
      const html = renderToStaticMarkup(
        <ServerClockProvider offsetMs={offset}>
          <PhoneOnlyProvider value={mode === 'phone-only'}>
            <Controller
              view={view}
              me={state.players[id] ?? { id, name: 'Guest', avatarId: 'fox' }}
              send={() => undefined}
            />
          </PhoneOnlyProvider>
        </ServerClockProvider>,
      );
      if (mode !== 'phone') {
        expect(html).toContain('<svg');
        expect(html).not.toMatch(/Look at the TV|on the TV/);
      }
      if (mode === 'spectator') expect(html).not.toContain('aria-label="Boost"');
      if (write) writeFileSync(`${dir}/${phase}-${mode}.html`, documentHtml(html, mode));
    }
  }
}, 30_000);
