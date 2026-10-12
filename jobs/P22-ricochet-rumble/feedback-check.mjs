// Feedback evidence in the capture owner's existing CDP page. No browser or process startup.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function runFeedbackChecks(
  dev,
  frameId,
  mediaDir,
  { assertExpected = true, label = 'fixed' } = {},
) {
  const safeLabel =
    String(label)
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 40) || 'current';
  const html = readFileSync(resolve(mediaDir, 'input-harness.html'), 'utf8');
  const artifact = `feedback-harness-${safeLabel}.html`;
  writeFileSync(resolve(mediaDir, artifact), html, 'utf8');
  const cases = [];
  let recorder;
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
  const action = (name, mode) =>
    evaluate(
      `window.__feedback(${JSON.stringify(name)}${mode ? `, ${JSON.stringify(mode)}` : ''})`,
    );
  const clear = () => evaluate('window.__clearFeedbackRequests(); true');
  const record = async (name, expected, condition, pending) => {
    const result = await evaluate(`({
      sounds: window.__soundRequests.slice(),
      vibrations: window.__vibrationRequests.map(value => Array.isArray(value) ? value.slice() : value),
      state: window.__feedback('snapshot'),
    })`);
    const observed = {
      thud: result.sounds.filter((request) => request.cue === 'thud').length,
      buzz90: result.vibrations.filter((pattern) => pattern === 90).length,
    };
    cases.push({
      name,
      expected,
      observed,
      pending,
      ...result,
      pass:
        observed.thud === expected.thud &&
        observed.buzz90 === expected.buzz90 &&
        condition(result.state),
    });
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
      if (await evaluate('window.__feedbackReady === true')) {
        ready = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 50));
    }
    if (!ready) throw new Error('Feedback harness did not mount within three seconds.');
    await settle();
    const fire = await evaluate(`(() => {
      const r = document.querySelector('button[aria-label="Hold to fire"]').getBoundingClientRect();
      return {x: r.x + r.width / 2, y: r.y + r.height / 2};
    })()`);
    // The real trusted tap supplies the activation that the SDK haptic gate requires.
    await dev.call(
      'Input.dispatchTouchEvent',
      {
        type: 'touchStart',
        touchPoints: [{ id: 91, x: fire.x, y: fire.y, radiusX: 6, radiusY: 6, force: 1 }],
      },
      10000,
    );
    await dev.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, 10000);
    await settle();
    recorder = await evaluate('window.__installFeedbackRecorder()');
    if (!recorder.activated || !recorder.haptics)
      throw new Error('SDK haptic prerequisites were not active after the trusted tap.');

    for (const mode of ['own', 'survivor']) {
      const pending = await action('prepare', mode);
      await settle();
      if (
        pending.phase !== 'play' ||
        pending.aliveCount !== 2 ||
        pending.checked !== 1080 ||
        pending.bullets.length !== 1 ||
        pending.bullets[0].born !== 720
      )
        throw new Error(`Invalid real pending-hit state for ${mode}: ${JSON.stringify(pending)}`);
      await clear();
      await action('advance');
      await settle();
      await record(
        mode === 'own' ? 'Terminal own knockout' : 'Terminal rival knockout, phone survives',
        { thud: 1, buzz90: mode === 'own' ? 1 : 0 },
        (state) =>
          state.phase === 'score' &&
          state.aliveCount === 1 &&
          state.checked === 1100 &&
          state.alive === (mode === 'survivor'),
        pending,
      );
      await clear();
      await action('rerender');
      // Cross a real UI clock second so the TV effect runs again during the same Score phase.
      await evaluate('new Promise(done => setTimeout(done, 1150))');
      await settle();
      await record(
        `${mode}: later Score push/clock does not repeat`,
        { thud: 0, buzz90: 0 },
        (state) => state.phase === 'score' && state.round === 1,
      );
      await clear();
      await action('next-round');
      await settle();
      await record(
        `${mode}: actual next round does not replay knockout`,
        { thud: 0, buzz90: 0 },
        (state) =>
          state.phase === 'play' && state.round === 2 && state.alive && state.aliveCount === 8,
      );
    }
    const pausedPending = await action('prepare', 'paused');
    await settle();
    await clear();
    await action('advance');
    await settle();
    await record(
      'Paused permanent leave suppresses loss feedback',
      { thud: 0, buzz90: 0 },
      (state) =>
        state.phase === 'play' &&
        state.paused &&
        !state.alive &&
        state.aliveCount === 1 &&
        state.left.includes('input-seat-1'),
      pausedPending,
    );
    await clear();
    await action('resume');
    await settle();
    await record(
      'Resume into actual Score does not replay the paused loss',
      { thud: 0, buzz90: 0 },
      (state) => state.phase === 'score' && !state.paused && !state.alive,
    );
  } catch (error) {
    cases.push({ name: 'Feedback check execution', pass: false, error: error.message });
  } finally {
    await dev
      .call('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }, 10000)
      .catch(() => undefined);
    await evaluate('window.__restoreFeedbackRecorder?.(); true').catch(() => undefined);
    await dev
      .call('Emulation.setTouchEmulationEnabled', { enabled: false }, 10000)
      .catch(() => undefined);
  }
  const report = {
    label: safeLabel,
    assertExpected,
    artifact,
    harnessSha256: createHash('sha256').update(html).digest('hex'),
    viewport: { width: 390, height: 844 },
    recorder,
    pass: cases.length === 8 && cases.every((test) => test.pass),
    cases,
  };
  writeFileSync(
    resolve(mediaDir, `feedback-results-${safeLabel}.json`),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
  if (assertExpected && !report.pass)
    throw new Error(
      `Feedback checks failed: ${cases
        .filter((test) => !test.pass)
        .map((test) => test.name)
        .join(', ')}`,
    );
  return report;
}
