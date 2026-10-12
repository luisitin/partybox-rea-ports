// Browser input evidence using the capture owner's existing CDP page. Never starts a browser.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function runInputChecks(dev, frameId, mediaDir) {
  const harnessPath = resolve(mediaDir, 'input-harness.html');
  const html = readFileSync(harnessPath, 'utf8');
  const cases = [];
  const neutral = { type: 'control', drive: 0, turn: 0, fire: false };
  let geometry;
  let pointerAudit;
  const evaluate = async (expression) => {
    const result = await dev.call(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      10000,
    );
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const settle = () =>
    evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))');
  const touch = (type, points = []) =>
    dev.call('Input.dispatchTouchEvent', { type, touchPoints: points }, 10000);
  const same = (a, b) =>
    !!a && a.type === b.type && a.drive === b.drive && a.turn === b.turn && a.fire === b.fire;
  const read = () =>
    evaluate(
      '({commands: window.__sentControls.slice(), observed: window.__lastControl, pointerAudit: window.__pointerAudit?.snapshot()})',
    );
  const clear = () => evaluate('window.__clearSentControls(); true');
  const check = async (name, expected, method) => {
    const state = await read();
    cases.push({ name, method, expected, ...state, pass: same(state.observed, expected) });
  };
  const quiet = async (name, method) => {
    const state = await read();
    cases.push({
      name,
      method,
      expected: 'No command may restart drive, turn or fire.',
      ...state,
      pass: state.commands.every((command) => same(command, neutral)),
    });
  };
  const reset = async () => {
    await touch('touchCancel').catch(() => undefined);
    await evaluate('window.__resetHarness(); true');
    await settle();
    await clear();
  };
  const point = (id, location) => ({
    id,
    x: location.x,
    y: location.y,
    radiusX: 6,
    radiusY: 6,
    force: 1,
  });
  const hold = async () => {
    await touch('touchStart', [point(1, geometry.topRight)]);
    await touch('touchStart', [point(1, geometry.topRight), point(2, geometry.fire)]);
    await settle();
  };
  try {
    await dev.call(
      'Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
      10000,
    );
    await dev.call(
      'Emulation.setTouchEmulationEnabled',
      { enabled: true, maxTouchPoints: 2 },
      10000,
    );
    await dev.call('Page.setDocumentContent', { frameId, html }, 10000);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate('window.__harnessReady === true')) {
        ready = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 50));
    }
    if (!ready) throw new Error('Offline Controller did not mount within three seconds.');
    await settle();
    geometry = await evaluate(`(() => {
      const pad = document.querySelector('[data-steering-pad]');
      const fire = document.querySelector('button[aria-label="Hold to fire"]');
      const topRight = pad?.querySelector('[data-corner="1"]');
      const bottomLeft = pad?.querySelector('[data-corner="2"]');
      if (!pad || !fire || !topRight || !bottomLeft) throw new Error('Production steering targets missing.');
      const center = (el) => {
        const r = el.getBoundingClientRect();
        return {x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height};
      };
      const padRect = pad.getBoundingClientRect();
      const fireRect = fire.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(pad).columnGap) || 0;
      return {
        topRight: center(topRight), bottomLeft: center(bottomLeft), fire: center(fire),
        center: {x: padRect.left + (fireRect.left - padRect.left - gap / 2) / 2, y: padRect.top + padRect.height / 2},
        buttons: [...pad.querySelectorAll('button')].map(el => ({label: el.getAttribute('aria-label'), disabled: el.disabled})),
      };
    })()`);
    const labels = ['Drive forward', 'Drive backward', 'Turn left', 'Turn right', 'Hold to fire'];
    cases.push({
      name: 'Five enabled keyboard buttons retained',
      method: 'Rendered production Controller DOM',
      expected: labels,
      observed: geometry.buttons,
      commands: [],
      pass:
        geometry.buttons.length === 5 &&
        labels.every((label) =>
          geometry.buttons.some((button) => button.label === label && !button.disabled),
        ),
    });
    await clear();
    await hold();
    await check(
      'Two touches: forward-right plus Fire',
      { ...neutral, drive: 1, turn: 1, fire: true },
      'CDP touchStart, two contacts',
    );
    if (process.env.PB_INPUT_SCREENSHOT === '1') {
      const shot = await dev.call(
        'Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: false, fromSurface: true },
        10000,
      );
      writeFileSync(resolve(mediaDir, 'input-touch-held.png'), Buffer.from(shot.data, 'base64'));
    }
    await clear();
    await touch('touchMove', [point(1, geometry.center), point(2, geometry.fire)]);
    await settle();
    await check(
      'Center steering goes neutral while Fire stays held',
      { ...neutral, fire: true },
      'CDP touchMove into steering dead zone',
    );
    await clear();
    await touch('touchMove', [point(1, geometry.bottomLeft), point(2, geometry.fire)]);
    await settle();
    await check(
      'Drag steering to reverse-left while Fire stays held',
      { ...neutral, drive: -1, turn: -1, fire: true },
      'CDP touchMove, same two contact ids',
    );
    await clear();
    await touch('touchEnd');
    await settle();
    await check('Touch release returns neutral', neutral, 'CDP touchEnd');
    await reset();
    await hold();
    await clear();
    await touch('touchCancel');
    await settle();
    await check('Touch cancellation returns neutral', neutral, 'CDP touchCancel');

    for (const [name, action, restore] of [
      ['Window blur', "window.dispatchEvent(new Event('blur'))", 'true'],
      ['Pagehide', "window.dispatchEvent(new Event('pagehide'))", 'true'],
      ['Phase change', "window.__setPhase('ready')", "window.__setPhase('play')"],
      ['Inactive hand', 'window.__setActive(false)', 'window.__setActive(true)'],
      ['Disconnected hand', 'window.__setConnected(false)', 'window.__setConnected(true)'],
    ]) {
      await reset();
      await hold();
      await clear();
      await evaluate(`${action}; true`);
      await settle();
      await check(
        `${name} clears both held contacts`,
        neutral,
        'Controller cleanup after browser/API event',
      );
      await evaluate(`${restore}; true`);
      await settle();
      await clear();
      await touch('touchMove', [point(1, geometry.bottomLeft), point(2, geometry.fire)]);
      await settle();
      await quiet(
        `${name}: stale contacts cannot restart controls`,
        'CDP touchMove without a new touchStart',
      );
      await touch('touchEnd');
    }

    await reset();
    if (process.env.PB_INPUT_POINTER_AUDIT === '1') {
      await evaluate(`(() => {
        const events = [];
        const started = performance.now();
        const original = Object.getOwnPropertyDescriptor(window, '__lastControl');
        let last = window.__lastControl;
        const describe = target => target === window ? 'window' : target === document ? 'document' :
          target instanceof Element ? target.tagName + (target.getAttribute('aria-label') ? ':' + target.getAttribute('aria-label') : '') +
            (target.hasAttribute('data-steering-pad') ? ':steering-pad' : '') : String(target);
        const snapshot = () => ({
          focused: document.hasFocus(), visibility: document.visibilityState,
          heading: document.querySelector('h2')?.textContent,
          enabledButtons: document.querySelectorAll('[data-steering-pad] button:not(:disabled)').length,
          heldButtons: [...document.querySelectorAll('[data-steering-pad] [data-held="true"]')].map(describe),
        });
        const record = item => {
          events.push({atMs: performance.now() - started, ...snapshot(), ...item});
          if (events.length > 500) events.shift();
        };
        const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
          'gotpointercapture', 'lostpointercapture', 'mousedown', 'mousemove', 'mouseup',
          'touchstart', 'touchmove', 'touchend', 'touchcancel', 'blur', 'focus', 'pagehide', 'visibilitychange'];
        const native = event => {
          const pad = document.querySelector('[data-steering-pad]');
          let captured = false;
          if (typeof event.pointerId === 'number' && pad) {
            try { captured = pad.hasPointerCapture(event.pointerId); } catch {}
          }
          record({kind: 'native', type: event.type, trusted: event.isTrusted,
            target: describe(event.target), pointerId: event.pointerId, pointerType: event.pointerType,
            button: event.button, buttons: event.buttons, x: event.clientX, y: event.clientY,
            capturesPointer: captured, touches: event.touches?.length,
            firesTouchEvents: event.sourceCapabilities?.firesTouchEvents});
        };
        for (const type of types) window.addEventListener(type, native, true);
        Object.defineProperty(window, '__lastControl', {
          configurable: true, enumerable: original?.enumerable ?? true,
          get: () => last,
          set: value => {
            last = value;
            const neutral = value && value.drive === 0 && value.turn === 0 && !value.fire;
            record({kind: value ? 'command' : 'observation-clear', command: value,
              ...(neutral ? {stack: new Error('Neutral command provenance').stack.split(String.fromCharCode(10)).slice(0, 8)} : {})});
          },
        });
        window.__pointerAudit = {
          snapshot: () => ({state: snapshot(), events: events.slice()}),
          stop: () => {
            for (const type of types) window.removeEventListener(type, native, true);
            if (original) Object.defineProperty(window, '__lastControl', {...original, value: last});
            else Object.defineProperty(window, '__lastControl', {configurable: true, writable: true, value: last});
            const result = {state: snapshot(), events: events.slice()};
            delete window.__pointerAudit;
            return result;
          },
        };
        record({kind: 'audit-start', touchEmulationUnchanged: true});
        return true;
      })()`);
    }
    const mouse = (type, location, button, buttons) =>
      dev.call(
        'Input.dispatchMouseEvent',
        {
          type,
          x: location.x,
          y: location.y,
          button,
          buttons,
          clickCount: type === 'mouseMoved' ? 0 : 1,
        },
        10000,
      );
    await mouse('mouseMoved', geometry.topRight, 'none', 0);
    await mouse('mousePressed', geometry.topRight, 'left', 1);
    await settle();
    await check(
      'Mouse press steers forward-right',
      { ...neutral, drive: 1, turn: 1 },
      'CDP mousePressed',
    );
    await clear();
    await mouse('mouseMoved', geometry.bottomLeft, 'none', 1);
    await settle();
    await check(
      'Captured mouse drag steers reverse-left',
      { ...neutral, drive: -1, turn: -1 },
      'CDP mouseMoved, left button held',
    );
    await clear();
    await mouse('mouseReleased', geometry.bottomLeft, 'left', 0);
    await settle();
    await check('Mouse release returns neutral', neutral, 'CDP mouseReleased');
    await clear();
    await mouse('mouseMoved', geometry.topRight, 'none', 0);
    await settle();
    await quiet(
      'Mouse hover cannot restart released steering',
      'CDP mouseMoved without mousePressed',
    );
    if (process.env.PB_INPUT_POINTER_AUDIT === '1')
      pointerAudit = await evaluate('window.__pointerAudit?.stop()');

    for (const [label, expected] of [
      ['Drive forward', { ...neutral, drive: 1 }],
      ['Drive backward', { ...neutral, drive: -1 }],
      ['Turn left', { ...neutral, turn: -1 }],
      ['Turn right', { ...neutral, turn: 1 }],
      ['Hold to fire', { ...neutral, fire: true }],
    ]) {
      await reset();
      await evaluate(
        `document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).focus(); true`,
      );
      await dev.call(
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13,
        },
        10000,
      );
      await settle();
      await check(`Keyboard button: ${label}`, expected, 'CDP Enter keyDown on focused button');
      await clear();
      await dev.call(
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13,
        },
        10000,
      );
      await settle();
      await check(
        `Keyboard button releases: ${label}`,
        neutral,
        'CDP Enter keyUp on focused button',
      );
    }
  } catch (error) {
    cases.push({
      name: 'Input check execution',
      method: 'Existing CDP page',
      pass: false,
      error: error.message,
    });
  } finally {
    if (process.env.PB_INPUT_POINTER_AUDIT === '1' && !pointerAudit)
      pointerAudit = await evaluate('window.__pointerAudit?.stop()').catch(() => undefined);
    await touch('touchCancel').catch(() => undefined);
    await evaluate('window.__setActive?.(false); true').catch(() => undefined);
    await dev
      .call('Emulation.setTouchEmulationEnabled', { enabled: false }, 10000)
      .catch(() => undefined);
  }
  const report = {
    artifact: 'input-harness.html',
    harnessSha256: createHash('sha256').update(html).digest('hex'),
    viewport: { width: 390, height: 844 },
    geometry,
    ...(pointerAudit ? { pointerAudit } : {}),
    pass: cases.length > 0 && cases.every((test) => test.pass),
    cases,
  };
  writeFileSync(
    resolve(mediaDir, 'input-results.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
  return report;
}
