// Reuses the capture runner's sole browser/CDP page. This module never launches a browser.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));

export async function prepareLiveControls() {
  const dir = resolve('reports/r2-controls-browser');
  mkdirSync(dir, { recursive: true });
  const esbuildFolder = readdirSync(resolve('node_modules/.pnpm')).find((name) =>
    name.startsWith('esbuild@'),
  );
  if (!esbuildFolder) throw new Error('The installed Vitest esbuild dependency was not found');
  const { build } = await import(
    pathToFileURL(resolve('node_modules/.pnpm', esbuildFolder, 'node_modules/esbuild/lib/main.js'))
      .href
  );
  await build({
    entryPoints: [resolve(sourceDir, 'harness.tsx')],
    outfile: resolve(dir, 'harness.js'),
    bundle: true,
    platform: 'browser',
    target: 'es2023',
    jsx: 'automatic',
    tsconfig: resolve('tsconfig.base.json'),
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'local-css' },
  });
  const css = readFileSync(resolve(dir, 'harness.css'), 'utf8');
  const js = readFileSync(resolve(dir, 'harness.js'), 'utf8');
  const path = resolve(dir, 'harness.html');
  writeFileSync(
    path,
    `<!doctype html><html lang="en" data-surface="phone"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n*{box-sizing:border-box}html,body{margin:0;background:var(--pb-bg);font-family:var(--pb-font-family)}</style></head><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`,
  );
  return path;
}

export async function runLiveControls(
  call,
  path,
  resultPath = resolve('jobs/P06-snake-royale/media/live-controls.json'),
) {
  const checks = [];
  const evaluate = async (expression) => {
    const value = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (value.exceptionDetails)
      throw new Error(
        value.exceptionDetails.text + ' ' + JSON.stringify(value.exceptionDetails.exception),
      );
    return value.result.value;
  };
  const paint = () =>
    evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const expect = (name, actual, good) => {
    checks.push({ name, actual, passed: good });
    if (!good) throw new Error(`Live control assertion failed: ${name}: ${JSON.stringify(actual)}`);
  };
  const last = () => evaluate('window.controlsAudit.inputs.at(-1) ?? null');
  const reset = async () => {
    await evaluate('window.controlsAudit.reset()');
    await paint();
    // An unmount release belongs to the previous scenario, not the freshly mounted one.
    await evaluate('window.controlsAudit.inputs.length = 0; document.activeElement?.blur()');
  };
  const key = (type, key, code, target = 'document.body', modifiers = '') =>
    evaluate(
      `${target}.dispatchEvent(new KeyboardEvent('${type}', {key:${JSON.stringify(key)},code:${JSON.stringify(code)},bubbles:true,cancelable:true${modifiers}}))`,
    );
  const mouse = (type, x, y) =>
    call('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      ...(type === 'mouseMoved' ? { buttons: 1 } : { button: 'left', clickCount: 1 }),
    });
  const pointer = async (x, y) => {
    await mouse('mousePressed', x, y);
    await paint();
    await mouse('mouseReleased', x, y);
    await paint();
  };
  try {
    await call('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const { frameTree } = await call('Page.getFrameTree');
    await call('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: readFileSync(path, 'utf8'),
    });
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await evaluate('!!window.controlsAudit')) break;
      await paint();
    }
    expect(
      'production controls mounted',
      await evaluate('!!window.controlsAudit'),
      await evaluate('!!window.controlsAudit'),
    );
    const geometry = await evaluate(
      `(() => {const buttons=[...document.querySelectorAll('button')]; const r=buttons[0].querySelector('svg').getBoundingClientRect(); const b=buttons[1].getBoundingClientRect(); return {cx:r.x+r.width/2,cy:r.y+r.height/2,radius:Math.min(r.width,r.height)*.37,bx:b.x+b.width/2,by:b.y+b.height/2};})()`,
    );

    await reset();
    await pointer(geometry.cx + geometry.radius, geometry.cy);
    let input = await last();
    // The initial server target is right, so a correct east touch can legitimately emit nothing.
    expect(
      'east compass is exactly right, including initial dedupe',
      input,
      input === null || Math.abs(input.angle) < 0.015,
    );
    await pointer(geometry.cx, geometry.cy + geometry.radius);
    input = await last();
    expect(
      'south compass is exactly down',
      input,
      Math.abs(input.angle - Math.PI / 2) < 0.015 && input.boost === false,
    );
    await pointer(geometry.cx - geometry.radius, geometry.cy);
    input = await last();
    expect(
      'west compass is exactly left',
      input,
      Math.abs(Math.abs(input.angle) - Math.PI) < 0.015,
    );
    const countBefore = await evaluate('window.controlsAudit.inputs.length');
    await pointer(geometry.cx, geometry.cy);
    expect(
      'compass centre retains previous heading',
      await evaluate('window.controlsAudit.inputs.length'),
      (await evaluate('window.controlsAudit.inputs.length')) === countBefore,
    );

    await reset();
    await key('keydown', ' ', 'Space');
    expect('Space starts boost', await last(), (await last()).boost === true);
    await evaluate('document.querySelector("input").focus()');
    await key('keyup', ' ', 'Space', 'document.querySelector("input")');
    expect(
      'Space releases after text field receives focus',
      await last(),
      (await last()).boost === false,
    );
    const textCount = await evaluate('window.controlsAudit.inputs.length');
    await key('keydown', 'w', 'KeyW', 'document.querySelector("input")');
    expect(
      'typing does not begin a new steering input',
      await evaluate('window.controlsAudit.inputs.length'),
      (await evaluate('window.controlsAudit.inputs.length')) === textCount,
    );

    await reset();
    await key('keydown', 'Shift', 'ShiftLeft');
    await key('keyup', 'Shift', 'ShiftLeft', 'document.body', ',ctrlKey:true');
    expect(
      'held Shift releases despite changed modifier',
      await last(),
      (await last()).boost === false,
    );

    await reset();
    await key('keydown', 'ArrowRight', 'ArrowRight');
    await evaluate('document.querySelector("input").focus()');
    await key('keyup', 'ArrowRight', 'ArrowRight', 'document.querySelector("input")');
    await evaluate('document.querySelector("input").blur()');
    await key('keydown', 'ArrowDown', 'ArrowDown');
    input = await last();
    expect(
      'tracked direction is removed on text-focus keyup',
      input,
      Math.abs(input.angle - Math.PI / 2) < 0.015,
    );
    await key('keyup', 'ArrowDown', 'ArrowDown');

    await reset();
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const steer = { x: geometry.cx + geometry.radius, y: geometry.cy, id: 1 };
    const boost = { x: geometry.bx, y: geometry.by, id: 2 };
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [steer] });
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [steer, boost] });
    await paint();
    expect('two thumbs can boost while steering', await last(), (await last()).boost === true);
    const downSteer = { ...steer, x: geometry.cx, y: geometry.cy + geometry.radius };
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [downSteer, boost] });
    await paint();
    input = await last();
    expect(
      'steering thumb changes heading without releasing boost',
      input,
      Math.abs(input.angle - Math.PI / 2) < 0.015 && input.boost === true,
    );
    // End the boost contact explicitly; the steering contact stays down.
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [boost] });
    await paint();
    input = await last();
    expect(
      'lifting boost thumb immediately releases with steering still held',
      input,
      input.boost === false && Math.abs(input.angle - Math.PI / 2) < 0.015,
    );
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await reset();
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [boost] });
    await call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await paint();
    expect('pointer cancellation releases boost', await last(), (await last()).boost === false);

    await reset();
    await key('keydown', ' ', 'Space');
    await evaluate('window.controlsAudit.enabled(false)');
    await paint();
    expect(
      'pause or crash disable releases an active boost',
      await last(),
      (await last()).boost === false,
    );
    expect(
      'disabled controls do not retain a held boost indicator',
      await evaluate('document.querySelectorAll("button:disabled").length'),
      (await evaluate('document.querySelectorAll("button:disabled").length')) === 2,
    );

    await reset();
    await key('keydown', ' ', 'Space');
    await evaluate('window.controlsAudit.mass(8)');
    await paint();
    expect('minimum mass releases boost', await last(), (await last()).boost === false);
    expect(
      'minimum mass disables only boost',
      await evaluate('document.querySelectorAll("button:disabled").length'),
      (await evaluate('document.querySelectorAll("button:disabled").length')) === 1,
    );

    await reset();
    await key('keydown', ' ', 'Space');
    await evaluate('window.dispatchEvent(new Event("blur"))');
    expect('window blur releases boost', await last(), (await last()).boost === false);
  } finally {
    // Leave the shared capture page clean and keep partial evidence if any assertion fails.
    await call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(
      () => undefined,
    );
    await call('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => undefined);
    writeFileSync(
      resultPath,
      JSON.stringify({ checks, passed: checks.every((check) => check.passed) }, null, 2) + '\n',
    );
  }
  return checks;
}
