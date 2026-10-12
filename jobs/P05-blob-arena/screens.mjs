// Real reducer views/components; authored stress setups are labelled in screens.json.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { format } from 'prettier';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { game } from '../../games/agar-io/server/index.ts';
import { Tv } from '../../games/agar-io/client/Tv.tsx';
import { Controller } from '../../games/agar-io/client/Controller.tsx';

const media = new URL('./media/', import.meta.url);
mkdirSync(media, { recursive: true });
const archive = (name) => {
  const from = new URL(name, import.meta.url),
    to = new URL(`r5-history-${name}`, import.meta.url);
  if (existsSync(from) && !existsSync(to)) copyFileSync(from, to);
};
archive('screens.json');
const prettierOptions = JSON.parse(
  readFileSync(new URL('../../.prettierrc', import.meta.url), 'utf8'),
);
const tokens = readFileSync(new URL('../../design/tokens.css', import.meta.url), 'utf8');
const css = [...globalThis.blobCaptureCss.values()].join('\n');
const stylesheet = await format(
  `${tokens}\n${css}\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--pb-bg);color:var(--pb-text);font-family:var(--pb-font-family);line-height:1.4}.capture-header{height:var(--capture-top);display:flex;align-items:center;padding:0 var(--pb-space-5);font-weight:900;font-size:var(--pb-font-body)}main{height:calc(100dvh - var(--capture-top) - var(--capture-bottom));display:flex;flex-direction:column;min-height:0;width:100%}.capture-game{flex:1;display:flex;flex-direction:column;min-height:0;width:100%}.capture-banner{position:relative;padding:var(--pb-space-2) var(--pb-space-4);background:var(--pb-surface-2);color:var(--pb-text-muted);text-align:center;font-size:var(--pb-font-caption)}#root[data-host-paused=true]{opacity:.5}html[data-surface=tv]{--pb-stage-top:12px;--pb-overscan-y:54px;--pb-overscan-x:96px}.capture-footer{height:var(--capture-bottom)}\n`,
  { ...prettierOptions, parser: 'css' },
);
writeFileSync(new URL('screens.css', media), stylesheet);
const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../games/agar-io/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
const timer = (state, now = state.phase.deadline) =>
  game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
const play = load('play'),
  score = load('score'),
  finalScore = load('score-last'),
  done = load('done');
if (finalScore.round !== 3 || finalScore.phase.id !== 'score')
  throw new Error('score-last must be the actual third-round reducer fixture.');
const cases = [
  { name: 'play', state: play, provenance: 'seeded reducer fixture' },
  { name: 'score', state: score, provenance: 'seeded reducer fixture' },
  { name: 'done', state: done, provenance: 'seeded reducer fixture' },
  { name: 'score-final', state: finalScore, provenance: 'actual third-round reducer fixture' },
];
const playSurfaces = ['tv', 'phone', 'phone-only'];
for (const [name, event] of [
  ['disconnected', { type: 'player', playerId: 'p1', connected: false }],
  ['left', { type: 'player', playerId: 'p1', connected: false, gone: 'left' }],
  ['paused', { type: 'vip', action: 'pause' }],
])
  cases.push({
    name: `play-${name}`,
    state: game.reduce(structuredClone(play), { ...event, now: play.began + play.world.time }),
    provenance: `real reducer ${event.type} event`,
    surfaces: playSurfaces,
  });
const overlap = structuredClone(play);
for (const cell of overlap.world.cells) {
  Object.assign(cell, { vx: 0, vy: 0, shieldUntil: 0 });
  if (cell.owner === 'p1') Object.assign(cell, { x: 80, y: 50, mass: 24 });
  else if (cell.owner === 'p2') Object.assign(cell, { x: 80, y: 50, mass: 192 });
  else Object.assign(cell, { x: 15 + Number(cell.owner.slice(1)) * 15, y: 85 });
}
for (const control of Object.values(overlap.world.controls)) Object.assign(control, { x: 0, y: 0 });
const respawn = timer(overlap);
if (!respawn.world.respawns.p1 || respawn.world.cells.some((cell) => cell.owner === 'p1'))
  throw new Error('Overlap did not yield an actual swallowed-player respawn verdict.');
cases.push({
  name: 'play-respawn',
  state: respawn,
  authoredStress: true,
  provenance: 'authored unshielded overlap; real timer resolves eating and schedules respawn',
  surfaces: playSurfaces,
});
const shield = structuredClone(play);
for (const cell of shield.world.cells.filter((cell) => cell.owner === 'p1'))
  Object.assign(cell, { mass: 60, shieldUntil: shield.world.time + 2000 });
Object.assign(shield.world.controls.p1, { x: 1, y: 0 });
cases.push({
  name: 'play-shield',
  state: shield,
  authoredStress: true,
  provenance: 'authored eligible-mass shield status',
  surfaces: playSurfaces,
});
const grow = structuredClone(play);
for (const cell of grow.world.cells.filter((cell) => cell.owner === 'p1'))
  Object.assign(cell, { mass: 24, shieldUntil: 0 });
Object.assign(grow.world.controls.p1, { x: 1, y: 0 });
cases.push({
  name: 'play-grow',
  state: grow,
  authoredStress: true,
  provenance: 'authored below-split-threshold status',
  surfaces: playSurfaces,
});
const neutral = game.reduce(structuredClone(play), {
  type: 'input',
  playerId: 'p1',
  input: { type: 'steer', x: 0, y: 0 },
  now: play.began + play.world.time,
});
cases.push({
  name: 'play-no-aim',
  state: neutral,
  provenance: 'real neutral-steering event',
  surfaces: playSurfaces,
});
const splitSetup = structuredClone(play);
for (const cell of splitSetup.world.cells.filter((cell) => cell.owner === 'p1'))
  Object.assign(cell, { mass: 120, shieldUntil: 0 });
Object.assign(splitSetup.world.controls.p1, { x: 1, y: 0, splitAt: splitSetup.world.time - 2000 });
const cooldown = game.reduce(splitSetup, {
  type: 'input',
  playerId: 'p1',
  input: { type: 'split' },
  now: splitSetup.began + splitSetup.world.time,
});
if (cooldown.world.cells.filter((cell) => cell.owner === 'p1').length < 2)
  throw new Error('Cooldown capture requires a successfully reduced split.');
cases.push({
  name: 'play-cooldown',
  state: cooldown,
  authoredStress: true,
  provenance: 'authored mass/aim setup; real split event starts cooldown/merge locks',
  surfaces: playSurfaces,
});
const crowded = structuredClone(play);
crowded.world.cells = Object.keys(crowded.players).flatMap((owner, slot) =>
  Array.from({ length: 4 }, (_, piece) => ({
    id: slot * 4 + piece + 1,
    owner,
    x: 64 + (slot % 4) * 8 + (piece % 2) * 2,
    y: 40 + Math.floor(slot / 4) * 8 + Math.floor(piece / 2) * 2,
    mass: 60,
    vx: 0,
    vy: 0,
    mergeAt: crowded.world.time + 8000,
    shieldUntil: 0,
  })),
);
crowded.world.serial = Math.max(crowded.world.serial, 33);
Object.assign(crowded.world.controls.p1, { x: 1, y: 0, splitAt: crowded.world.time - 2000 });
cases.push({
  name: 'play-crowded-cap',
  state: crowded,
  authoredStress: true,
  provenance: 'authored 32-piece identity/cell-cap stress; not a sampled match',
  surfaces: [...playSurfaces, 'phone-only-spectator'],
});
const lowClock = timer(structuredClone(play), play.endsAt - 4000);
if (lowClock.phase.id !== 'play' || lowClock.world.time < 86000)
  throw new Error('Low-clock capture must be settled by the real timer.');
cases.push({
  name: 'play-low-clock',
  state: lowClock,
  provenance: 'real late play timer, four seconds before the horn',
  surfaces: playSurfaces,
});
// PLAYER_NAME_MAX is16 in packages/shared/src/ids.ts; transport's64 allowance is different.
const longNames = [
  'Alexandria Montgomery',
  'Benedict Cunningham',
  'Cassandra Wellington',
  'Dominic Featherstone',
  'Elisabeth Rutherford',
  'Frederick Kensington',
  'Gabriella Worthington',
  'Harrison Chamberlain',
].map((name) => name.slice(0, 16).padEnd(16, 'W'));
const tie = structuredClone(done);
for (const [index, [id, player]] of Object.entries(tie.players).entries()) {
  player.name = longNames[index];
  tie.scores[id] = 777;
}
cases.push({
  name: 'done-long-eight-tie',
  state: tie,
  authoredStress: true,
  provenance:
    'authored maximum accepted16-character names/eight-way final tie; not a sampled outcome',
});
const longPlay = structuredClone(play);
for (const [index, player] of Object.values(longPlay.players).entries())
  player.name = longNames[index];
cases.push({
  name: 'play-long',
  state: longPlay,
  authoredStress: true,
  provenance: 'authored maximum accepted16-character names',
  surfaces: ['tv', 'phone-only-spectator'],
});

const allSurfaces = [
  'tv',
  'phone',
  'phone-only',
  'phone-remote',
  'phone-spectator',
  'phone-only-spectator',
];
const pages = [],
  frozenWall = Date.now(),
  realNow = Date.now;
const escape = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const scenario of cases)
  for (const surface of scenario.surfaces ?? allSurfaces) {
    const state = structuredClone(scenario.state);
    for (const player of Object.values(state.players)) player.canSeeTv = true;
    const isTv = surface === 'tv',
      phoneOnly = surface.startsWith('phone-only'),
      spectator = surface.endsWith('spectator');
    if (phoneOnly) state.phoneOnly = true;
    else delete state.phoneOnly;
    if (surface === 'phone-remote') state.players.p1.canSeeTv = false;
    const viewer = spectator ? 'spectator' : 'p1';
    const view = { ...(isTv ? game.tvView(state) : game.controllerView(state, viewer)), vip: null };
    const screen = isTv
      ? createElement(Tv, { view })
      : createElement(
          PhoneOnlyProvider,
          { value: phoneOnly },
          createElement(Controller, {
            view,
            me: state.players[viewer] ?? { id: viewer, name: 'Spectator', avatarId: 'fox' },
            send: () => undefined,
          }),
        );
    let html;
    // The SDK provider is offset-only: freeze its wall clock only inside this SSR harness.
    Date.now = () => frozenWall;
    try {
      html = renderToStaticMarkup(
        createElement(
          ServerClockProvider,
          { offsetMs: state.began + state.world.time - frozenWall },
          screen,
        ),
      );
    } finally {
      Date.now = realNow;
    }
    const width = isTv ? 1920 : 390,
      height = isTv ? 1080 : 844,
      // Authored local shell matches the pinned owner geometry (0a977).
      // TV top: compact header133.2 +empty strip12 +quiet timer22; HostBar80 is below.
      // The actual game's Stage then owns its padding; do not subtract it twice.
      // Phone: ordinary header56 +quiet row27.6; the game owns its safe bottom.
      top = isTv ? (view.deadline === null ? 145.2 : 167.2) : 83.6,
      bottom = isTv ? 80 : 0;
    const name = `${scenario.name}-${surface}.html`;
    const payload = JSON.stringify({
      state,
      surface,
      viewer,
      scenario: scenario.name,
      provenance: scenario.provenance,
      authoredStress: Boolean(scenario.authoredStress),
    }).replaceAll('<', '\\u003c');
    const pausedHost = !isTv && Boolean(state.phase.paused);
    const vipName = Object.values(state.players).find((player) => player.isVip)?.name ?? 'VIP';
    const banner = `Paused — ${vipName} will resume the game`;
    const document = await format(
      `<!doctype html><html lang="en" data-surface="${isTv ? 'tv' : 'phone'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(scenario.name + ' ' + surface)}</title><link rel="stylesheet" href="screens.css"></head><body style="--capture-top:${top}px;--capture-bottom:${bottom}px"><header class="capture-header">${isTv ? 'TV · Agar.io' : `PB · AGAR · ${escape(spectator ? 'Spectator' : state.players.p1.name)}`}</header><main><div id="p05-owner-banner" class="capture-banner" ${pausedHost ? '' : 'hidden'}>${escape(banner)}</div><div id="root" class="capture-game" data-ready="false" data-host-paused="${pausedHost}" ${pausedHost ? 'inert' : ''}>${html}</div></main><footer class="capture-footer"></footer><script type="application/json" id="p05-source">${payload}</script><script type="module" src="/jobs/P05-blob-arena/interactive.tsx"></script></body></html>`,
      { ...prettierOptions, parser: 'html' },
    );
    const file = new URL(name, media),
      bytes = readdirSync(media).reduce(
        (sum, entry) => sum + statSync(new URL(entry, media)).size,
        0,
      );
    if (
      bytes - (existsSync(file) ? statSync(file).size : 0) + Buffer.byteLength(document) >=
      10_000_000
    )
      throw new Error('P05 media would exceed 10 MB.');
    writeFileSync(file, document);
    pages.push({
      name,
      width,
      height,
      surface,
      phase: state.phase.id,
      scenario: scenario.name,
      provenance: scenario.provenance,
      authoredStress: Boolean(scenario.authoredStress),
      shell: {
        top,
        bottom,
        ownerPin: '0a977',
        authoredLocalFrame: true,
        phoneFooter: false,
        mountedBeforeCapture: true,
        quietDeadlineRow: isTv && view.deadline !== null ? 22 : 0,
      },
      viewer,
      frozenServerNow: state.began + state.world.time,
      viewStatus: isTv
        ? null
        : {
            member: view.member,
            departed: view.departed,
            connected: view.connected,
            mass: view.mass,
            canSplit: view.canSplit,
            splitReason: view.splitReason,
            respawnIn: view.respawnIn,
          },
    });
  }
writeFileSync(new URL('./screens.json', import.meta.url), JSON.stringify(pages, null, 2) + '\n');
console.log(
  `Rendered ${pages.length} frozen-clock real-component screens with one shared local stylesheet.`,
);
