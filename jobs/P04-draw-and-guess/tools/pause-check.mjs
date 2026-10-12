// Native pointer and form checks against the real controller, reducer and SDK clocks.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function capturePause(rpc, socket, name) {
  const { data } = await rpc(socket, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(`jobs/P04-draw-and-guess/media/${name}.png`), Buffer.from(data, 'base64'));
}
export async function drawGesture({ rpc, socket, evaluate, settle }) {
  const rect = await evaluate(
    'JSON.stringify(Object.fromEntries(["x","y","width","height"].map(k => [k,document.querySelector("canvas").getBoundingClientRect()[k]])))',
  );
  const r = JSON.parse(rect),
    x = r.x + 12,
    y = r.y + r.height / 2;
  await rpc(socket, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 100; i++)
    await rpc(socket, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x + (i % 60) * 4,
      y: y + (i % 6) * 3,
      button: 'none',
      buttons: 1,
    });
  await rpc(socket, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: x + 40,
    y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await settle();
}

export async function pausedInkChecks(harness) {
  const { rpc, socket, evaluate, settle, button, check } = harness;
  const info = () => evaluate('p04.info()');
  const box = await evaluate(`(() => {
    const c=document.querySelector('canvas'), r=c.getBoundingClientRect(), s=getComputedStyle(c);
    const width=parseFloat(s.width), height=parseFloat(s.height);
    const left=parseFloat(s.borderLeftWidth), right=parseFloat(s.borderRightWidth);
    const top=parseFloat(s.borderTopWidth), bottom=parseFloat(s.borderBottomWidth);
    const sx=r.width/(width+left+right), sy=r.height/(height+top+bottom);
    return {left:r.left+left*sx,top:r.top+top*sy,width:width*sx,height:height*sy};
  })()`);
  const at = ([x, y]) => ({
    x: box.left + (x * box.width) / 1000,
    y: box.top + (y * box.height) / 600,
  });
  const event = (type, point) => ({
    type,
    ...at(point),
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    ...(type === 'mouseMoved' ? {} : { clickCount: 1 }),
  });
  // Send the whole native batch before awaiting any reply. CDP preserves message order.
  const batch = (events) =>
    Promise.all(events.map((params) => rpc(socket, 'Input.dispatchMouseEvent', params)));
  const dot = (point) => [event('mousePressed', point), event('mouseReleased', point)];
  const painted = (point) =>
    evaluate(`(() => {
    const c=document.querySelector('canvas');
    return !!c && c.getContext('2d').getImageData(${Math.round(point[0])},${Math.round(point[1])},1,1).data[3]>0;
  })()`);
  const wipe = async () => {
    await button('Clear');
    await button('Tap again to clear');
    check((await info()).strokes.length === 0, 'Pause checks must begin with a clean canvas');
  };
  await wipe();
  try {
    const firstDot = [250, 180];
    const secondDot = [750, 420];
    const dotBase = (await info()).sent.length;
    await evaluate('p04.holdClocks(true)');
    await batch([...dot(firstDot), ...dot(secondDot)]);
    await settle();
    check(
      (await info()).sent.length === dotBase,
      'Native dots must queue before a real clock tick',
    );
    check(await painted(secondDot), 'The second queued native dot must paint optimistically');
    await evaluate('p04.pauseAfterNextStroke(); p04.holdClocks(false)');
    await settle();
    const dotsPaused = await info();
    const pausedDotPreview = await painted(secondDot);
    check(
      dotsPaused.paused &&
        dotsPaused.strokes.length === 1 &&
        dotsPaused.sent.length === dotBase + 1 &&
        pausedDotPreview,
      `Pause must retain the known-unsent second dot: ${JSON.stringify({ dotsPaused, pausedDotPreview })}`,
    );
    await capturePause(rpc, socket, 'pause-artist-live');
    await evaluate('p04.pause(false)');
    await settle();
    const dotsResumed = await info();
    await settle();
    const dotsStable = await info();
    const dotPackets = dotsStable.sent.slice(dotBase);
    const dotSpacingMs = dotsStable.sentAt[dotBase + 1] - dotsStable.sentAt[dotBase];
    check(
      dotPackets.length === 2 &&
        dotPackets.every((input) => input.type === 'stroke') &&
        dotsResumed.strokes.length === 2 &&
        dotsStable.strokes.length === 2,
      `A known-unsent dot must resume exactly once: ${JSON.stringify(dotsStable)}`,
    );
    check(
      dotSpacingMs >= 80 &&
        dotsStable.strokes[0].gesture !== dotsStable.strokes[1].gesture &&
        JSON.stringify(dotsStable.strokes.map((stroke) => stroke.points[0])) ===
          JSON.stringify([firstDot, secondDot]),
      `Pause must preserve FIFO gesture order and 80ms spacing: ${JSON.stringify({ dotPackets, dotSpacingMs })}`,
    );
    await wipe();

    await batch(dot(firstDot));
    await settle();
    check((await info()).strokes.length === 1, 'Undo crossing needs one authoritative older dot');
    const undoBase = (await info()).sent.length;
    await evaluate('p04.holdClocks(true)');
    await batch(dot(secondDot));
    await settle();
    await button('Undo');
    await evaluate('p04.rejectNextStrokeToPause(); p04.holdClocks(false)');
    await settle();
    const undoPaused = await info();
    check(
      undoPaused.paused && undoPaused.strokes.length === 1 && (await painted(firstDot)),
      'Undo of a pause-rejected new dot must preserve the older dot preview',
    );
    await evaluate('p04.pause(false)');
    await settle();
    await settle();
    const undoResumed = await info();
    check(
      undoResumed.strokes.length === 1 &&
        undoResumed.sent.length === undoBase + 1 &&
        JSON.stringify(undoResumed.strokes[0].points[0]) === JSON.stringify(firstDot),
      `Cancelled Undo must never erase or send against the older dot: ${JSON.stringify(undoResumed)}`,
    );
    await wipe();

    const start = [100, 120];
    const middle = [500, 300];
    const end = [900, 480];
    const tailBase = (await info()).sent.length;
    await evaluate('p04.holdClocks(true); p04.holdClocksAfterNextStroke()');
    await batch([event('mousePressed', start), event('mouseMoved', middle)]);
    await evaluate('p04.holdClocks(false)');
    await settle();
    check(
      (await info()).sent.length === tailBase + 1,
      'The active gesture must send its first chunk',
    );
    await batch([event('mouseMoved', end)]);
    await evaluate('p04.pause(true)');
    await settle();
    await batch([event('mouseReleased', end)]);
    const tailPaused = await info();
    const pausedTailPreview = await painted(end);
    check(
      tailPaused.paused && tailPaused.sent.length === tailBase + 1 && pausedTailPreview,
      `Pause must retain an active dirty finger tail: ${JSON.stringify({ tailPaused, pausedTailPreview })}`,
    );
    await evaluate('p04.holdClocks(false); p04.pause(false)');
    await settle();
    const tailResumed = await info();
    const tailPackets = tailResumed.sent.slice(tailBase);
    const tailStroke = tailResumed.strokes[0];
    check(
      tailPackets.length === 2 &&
        tailPackets.every((input) => input.type === 'stroke') &&
        tailResumed.strokes.length === 1 &&
        JSON.stringify(tailStroke.points) === JSON.stringify([start, middle, end]),
      `Resume must keep active tail endpoints in one gesture: ${JSON.stringify(tailResumed)}`,
    );
    await button('Undo');
    check((await info()).strokes.length === 0, 'One Undo must remove the entire resumed gesture');

    const unmountBase = (await info()).sent.length;
    await evaluate('p04.holdClocks(true)');
    await batch(dot(secondDot));
    await settle();
    check(
      (await info()).sent.length === unmountBase && (await painted(secondDot)),
      'Unmount case must contain real queued ink',
    );
    await evaluate('p04.guesser()');
    await settle();
    check(
      !(await evaluate('!!document.querySelector("canvas")')),
      'Role switch must unmount the drawing pad',
    );
    await evaluate('p04.artist(); p04.holdClocks(false)');
    await settle();
    await settle();
    const unmounted = await info();
    check(
      unmounted.sent.length === unmountBase &&
        unmounted.strokes.length === 0 &&
        !(await painted(secondDot)),
      `An unmounted queue must never replay on a fresh drawing pad: ${JSON.stringify(unmounted)}`,
    );
    return {
      pausedDots: {
        pausedDotPreview,
        sentBeforeResume: 1,
        sentAfterResume: dotPackets.length,
        dotSpacingMs,
        gestures: dotsStable.strokes.map((stroke) => stroke.gesture),
      },
      activeTail: {
        pausedTailPreview,
        points: tailStroke.points,
        sentPackets: tailPackets.length,
        undoStrokes: 0,
      },
      unmountedQueue: {
        sentPackets: unmounted.sent.length - unmountBase,
        strokes: unmounted.strokes.length,
      },
      cancelledUndo: { oldGesturePreserved: true, sentPackets: undoResumed.sent.length - undoBase },
    };
  } finally {
    await evaluate('p04.holdClocks(false)').catch(() => undefined);
  }
}

export async function pausedGuessChecks(harness) {
  const { rpc, socket, evaluate, settle, button, check, typeGuess, currentDraft } = harness;
  await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 500,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await settle();
  try {
    const text = 'kept during pause';
    await typeGuess(text);
    const before = await evaluate('p04.info()');
    await evaluate('p04.deferNextGuessToPause()');
    await button('Guess');
    const paused = await evaluate('p04.info()');
    const pausedDraft = await currentDraft();
    const pausedFeedback = await evaluate('document.body.textContent');
    check(
      paused.paused &&
        pausedDraft === text &&
        paused.receipt.revision === before.receipt.revision &&
        pausedFeedback.includes('Guess kept for retry') &&
        !pausedFeedback.includes('Guess sent…'),
      `A guess refused by pause without a receipt must restore its field and stop awaiting: ${JSON.stringify({ paused, pausedDraft, pausedFeedback })}`,
    );
    const pausedOverflow =
      await evaluate(`[...document.querySelectorAll('h2,p,input,button')].filter(e => {
    const r=e.getBoundingClientRect();
    return r.width>0&&(r.right>innerWidth+1||r.bottom>visualViewport.height+1||r.top< -1||r.left< -1);
  }).map(e=>e.textContent||e.id)`);
    check(
      pausedOverflow.length === 0,
      `Paused guess must fit the keyboard viewport: ${JSON.stringify(pausedOverflow)}`,
    );
    await capturePause(rpc, socket, 'pause-guess-keyboard-live');
    await evaluate('p04.remountPhone()');
    await settle();
    check((await currentDraft()) === text, 'Pause-restored draft must survive same-turn remount');
    await evaluate('p04.pause(false)');
    await settle();
    await settle();
    const resumed = await evaluate('p04.info()');
    const resumedDraft = await currentDraft();
    check(
      resumedDraft === text &&
        resumed.sent.length === before.sent.length + 1 &&
        (await evaluate('document.body.textContent')).includes('Tap Guess to retry'),
      'Resume must preserve the draft for manual retry without automatically sending it',
    );
    await evaluate('p04.advance(750)');
    await button('Guess');
    const retried = await evaluate('p04.info()');
    const retryDraft = await currentDraft();
    check(
      retryDraft === '' &&
        retried.receipt.accepted &&
        retried.receipt.revision === before.receipt.revision + 1 &&
        retried.sent.length === before.sent.length + 2,
      `A manual guess retry after pause must be accepted and clear its field: ${JSON.stringify({ retried, retryDraft })}`,
    );
    return {
      pausedDraft,
      resumedDraft,
      retryDraft,
      pausedReceiptRevision: paused.receipt.revision,
      acceptedReceiptRevision: retried.receipt.revision,
      automaticRetries: resumed.sent.length - before.sent.length - 1,
      pausedOverflow,
    };
  } finally {
    await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await settle();
  }
}
