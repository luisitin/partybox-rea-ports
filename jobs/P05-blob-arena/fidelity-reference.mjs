// Network-free reference harness. The archived client and quadtree bytes are never rewritten.
import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function installEnvironment() {
  let seed = 17;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const NativeDate = Date;
  let clock = 1_700_000_000_000;
  window.Date = class extends NativeDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(clock);
    }
    static now() {
      return Math.floor(clock);
    }
  };
  const frames = new Map();
  let frameId = 0;
  window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  // Original steering/retry intervals have no work in a static packet replay.
  window.setInterval = window.setTimeout = () => 0;
  window.clearInterval = window.clearTimeout = () => {};

  const sockets = [];
  window.WebSocket = class {
    static OPEN = 1;
    OPEN = 1;
    readyState = 1;
    sent = [];
    constructor(url) {
      this.url = url;
      sockets.push(this);
    }
    send(bytes) {
      this.sent.push(new Uint8Array(bytes).slice());
    }
    close() {
      this.readyState = 3;
    }
  };
  const selection = {
    hide() {
      return this;
    },
    show() {
      return this;
    },
    fadeIn() {
      return this;
    },
    val() {
      return '';
    },
  };
  window.jQuery = () => selection;
  window.jQuery.ajax = () => {
    throw new Error('The original reference must not discover an online server');
  };

  let worldMatrix = null;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = Reflect.apply(getContext, this, args);
    if (this.id !== 'canvas' || args[0] !== '2d' || !context || context.__referenceObserved)
      return context;
    context.__referenceObserved = true;
    // Observe the ORIGINAL renderer's transform after forwarding every operation unchanged.
    // Its last translate/scale in each frame is the cell-world transform, before save/restore
    // returns the canvas to identity. Cached name/leaderboard canvases are deliberately ignored.
    for (const operation of ['translate', 'scale']) {
      const original = context[operation];
      context[operation] = function (...values) {
        const result = Reflect.apply(original, this, values);
        const matrix = this.getTransform();
        worldMatrix = {
          a: matrix.a,
          b: matrix.b,
          c: matrix.c,
          d: matrix.d,
          e: matrix.e,
          f: matrix.f,
        };
        return result;
      };
    }
    return context;
  };
  window.__referenceEnvironment = {
    sockets,
    worldMatrix: () => worldMatrix,
    frame() {
      clock += 1000 / 60;
      const callbacks = [...frames.values()];
      frames.clear();
      if (callbacks.length !== 1) throw new Error('Expected one original animation loop');
      for (const callback of callbacks) callback(clock - 1_700_000_000_000);
    },
  };
}

function replayScene(scene) {
  const units = 10 / 0.55;
  const canvas = document.getElementById('canvas');
  if (canvas.width !== scene.width || canvas.height !== scene.height)
    throw new Error('The original normal resize must match the authored scene viewport');
  const environment = window.__referenceEnvironment;
  // These are existing public switches and the existing public connection entry point.
  // Empty #region in the environment lets the normal load handler run without its AJAX call.
  window.setSkins(false);
  window.setNames(true);
  window.connect('ws://fixture.invalid');
  const socket = environment.sockets.at(-1);
  if (typeof socket?.onopen !== 'function' || typeof socket?.onmessage !== 'function')
    throw new Error('Original public connect did not register its protocol handlers');
  socket.onopen({ target: socket });
  const deliver = (bytes) => socket.onmessage({ data: bytes.buffer, target: socket });
  const packet = (opcode, size) => {
    const bytes = new Uint8Array(size);
    bytes[0] = opcode;
    return [bytes, new DataView(bytes.buffer)];
  };

  const [bounds, boundsView] = packet(64, 33);
  [0, 0, 160 * units, 100 * units].forEach((value, i) =>
    boundsView.setFloat64(1 + i * 8, value, true),
  );
  deliver(bounds);
  const owned = scene.cells.filter((cell) => cell.owner === 'p1');
  if (!owned.length) throw new Error('A personal-camera reference needs at least one owned cell');
  for (const cell of owned) {
    const [ownership, ownershipView] = packet(32, 5);
    ownershipView.setUint32(1, cell.id, true);
    deliver(ownership);
  }

  const names = { p1: 'Ana', p2: 'Ben', p3: 'Cy', ...scene.names };
  let currentCells = scene.cells.map((cell) => ({ ...cell }));
  const food = Array.from({ length: 96 }, (_, index) => ({
    id: index + 101,
    x: (8 + (index % 12) * 12.6) * units,
    y: (5 + Math.floor(index / 12) * 12.7) * units,
    radius: 0.6 * units,
    hue: 20 + (index % 5) * 40,
    name: '',
  }));
  const modelsFor = (cells) => [
    ...cells.map((cell) => ({
      id: cell.id,
      x: cell.x * units,
      y: cell.y * units,
      radius: Math.sqrt(cell.mass) * 10,
      hue: 40 + Number(cell.owner.slice(1)) * 40,
      name: cell.name ?? names[cell.owner] ?? cell.owner,
    })),
    ...food,
  ];
  let models = modelsFor(currentCells);
  const receiveWorld = (nextModels) => {
    if (new Set(nextModels.map((model) => model.id)).size !== nextModels.length)
      throw new Error('Authored cell and food protocol IDs must be unique');
    const size =
      1 + 2 + nextModels.reduce((n, model) => n + 29 + (model.name.length + 1) * 2, 0) + 4 + 2 + 4;
    const [update, updateView] = packet(16, size);
    let offset = 1;
    updateView.setUint16(offset, 0, true); // no eating in this pose-only replay
    offset += 2;
    for (const model of nextModels) {
      updateView.setUint32(offset, model.id, true);
      offset += 4;
      for (const value of [model.x, model.y, model.radius]) {
        updateView.setFloat64(offset, value, true);
        offset += 8;
      }
      updateView.setUint8(offset++, model.hue); // plain cells, never hue-zero virus
      for (let i = 0; i < model.name.length; i++) {
        updateView.setUint16(offset, model.name.charCodeAt(i), true);
        offset += 2;
      }
      updateView.setUint16(offset, 0, true);
      offset += 2;
    }
    updateView.setUint32(offset, 0, true); // model-list sentinel
    offset += 4;
    updateView.setUint16(offset, 0, true); // original parser's unused field
    offset += 2;
    updateView.setUint32(offset, 0, true); // all current models updated; no keep-only IDs
    offset += 4;
    if (offset !== update.length) throw new Error('Original world packet length mismatch');
    deliver(update);
  };
  receiveWorld(models);
  deliver(new Uint8Array([48])); // empty original leaderboard: these pairs compare only the arena
  for (let i = 0; i < 240; i++) environment.frame();

  let motionAt = null;
  let motionFrames = 0;
  const publishMetrics = () => {
    const matrix = environment.worldMatrix();
    if (
      !matrix ||
      ![matrix.a, matrix.d, matrix.e, matrix.f].every(Number.isFinite) ||
      matrix.a <= 0 ||
      matrix.d <= 0 ||
      matrix.b !== 0 ||
      matrix.c !== 0
    )
      throw new Error('Original renderer did not produce a usable camera transform');
    window.__originalMetrics = {
      x: (canvas.width / 2 - matrix.e) / matrix.a / units,
      y: (canvas.height / 2 - matrix.f) / matrix.d / units,
      zoom: matrix.a * units,
      width: canvas.width,
      height: canvas.height,
      ownPieces: currentCells.filter((cell) => cell.owner === 'p1').length,
      cells: models.length,
      countSource: 'fixture binary packets; original private model remains unexposed',
      worldMatrix: matrix,
      motionFrames,
      motionElapsedMs: motionAt === null ? null : Date.now() - motionAt,
    };
    return window.__originalMetrics;
  };
  // Movement patches existing received models by ID. Retain untouched rivals and every food
  // model, so the original parser cannot mistake an omitted cell for a destroyed one.
  window.__referenceMove = (nextCells) => {
    if (!Array.isArray(nextCells)) throw new Error('Reference movement expects a cell array');
    const previous = new Map(currentCells.map((cell) => [cell.id, cell]));
    const patches = new Map();
    for (const patch of nextCells) {
      const old = previous.get(patch.id);
      if (!old || (patch.owner !== undefined && patch.owner !== old.owner))
        throw new Error('Reference movement preserves existing IDs and ownership');
      if (patches.has(patch.id)) throw new Error('Reference movement cell IDs must be unique');
      const cell = { ...old, ...patch };
      if (![cell.x, cell.y, cell.mass].every(Number.isFinite) || cell.mass <= 0)
        throw new Error('Reference movement needs finite coordinates and positive mass');
      patches.set(cell.id, cell);
    }
    const next = currentCells.map((cell) => patches.get(cell.id) ?? cell);
    const nextModels = modelsFor(next);
    receiveWorld(nextModels); // same socket and the original onmessage/parser; no camera reset
    currentCells = next;
    models = nextModels;
    motionAt = Date.now();
    motionFrames = 0;
    return publishMetrics();
  };
  window.__referenceFrames = (count) => {
    if (!Number.isSafeInteger(count) || count < 0 || count > 10_000)
      throw new Error('Reference frame count must be an integer from 0 through 10000');
    for (let i = 0; i < count; i++) environment.frame();
    if (motionAt !== null) motionFrames += count;
    return publishMetrics();
  };
  publishMetrics();
  document.body.dataset.ready = 'true';
}

const environmentScript = `(${installEnvironment.toString()})();`;
const fixtureBootstrap = replayScene.toString();

export function referenceMetadata(originalBytes, quadBytes) {
  return {
    originalSha256: sha256(originalBytes),
    quadtreeSha256: sha256(quadBytes),
    environmentSha256: sha256(environmentScript),
    fixtureBootstrapSha256: sha256(fixtureBootstrap),
    originalSourceUnmodified: true,
    originalBootstrap: 'normal load handler, public connect, original binary message parser',
    cameraSource: 'forwarded original canvas translate/scale world matrix',
    countSource: 'fixture binary packets; original private model remains unexposed',
    settleFrames: 240,
    fixedReferenceRandomSeed: 17,
    frameMs: 1000 / 60,
    radiusScale: '10/0.55',
    food: { count: 96, radius: 0.6, shapeSource: 'unmodified original polygon renderer' },
    leaderboard: 'empty opcode48; arena-only pairs, HUD verified separately',
    motionHooks: {
      move: 'patch existing received cells by ID; same socket/parser, all rivals and 96 food models retained',
      frames: 'advance N deterministic 60 Hz original RAF frames, publish forwarded camera matrix',
    },
  };
}

export function originalHtml(scene, originalBytes, quadBytes) {
  const original = Buffer.from(originalBytes).toString('utf8');
  const quad = Buffer.from(quadBytes).toString('utf8');
  // Refuse an HTML-unsafe source instead of changing even one original client byte.
  for (const bytes of [original, quad])
    if (/<\/script(?:\s|>)/i.test(bytes))
      throw new Error('Reference source contains a closing script tag');
  const sceneJson = JSON.stringify(scene).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'"><title>Original classic Agar.io arena packet replay</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}#overlays{display:none}</style></head><body><canvas id="canvas"></canvas><div id="overlays"></div><script>${environmentScript}</script><script data-reference-sha256="${sha256(quadBytes)}">${quad}</script><script data-reference-sha256="${sha256(originalBytes)}">${original}</script><script>window.addEventListener('load',()=>(${fixtureBootstrap})(${sceneJson}),{once:true});</script></body></html>`;
}
