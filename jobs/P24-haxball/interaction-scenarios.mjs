// Mounted scenarios receive a CDP adapter; this module never creates a browser or private state.
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const vector = (input) => (input ? { dx: input.dx, dy: input.dy, kick: input.kick } : null);
const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runScenarios(qa) {
  const { evaluate, cdp, sessionId, check, capture } = qa;
  const contacts = new Map();
  const browserPointers = new Map();
  const keyHeld = new Map();
  const protocol = [];
  const snapshot = () =>
    evaluate(`({
    sent: structuredClone(window.harness.sent), events: structuredClone(window.harness.events),
    cues: [...window.harness.cues], kind: window.harness.kind,
    phaseAt: window.harness.currentView.phaseAt, acceptedSeq: window.harness.currentView.acceptedSeq,
    controls: document.querySelectorAll('[data-hax-control]').length,
    heldControls: [...document.querySelectorAll('[data-hax-control][data-held="true"]')]
      .map(element => element.getAttribute('data-hax-control')),
    performanceNow: performance.now(),
    pointers: structuredClone(window.qaPointers), keys: structuredClone(window.qaKeys), errors: [...window.qaErrors]
  })`);
  const clear = () => evaluate('window.harness.clearRecords()');
  async function touch(type, explicitPoints, details = {}) {
    const touchPoints =
      explicitPoints ??
      (type === 'touchEnd' || type === 'touchCancel' ? [] : [...contacts.values()]);
    const pointerOffset = await evaluate('window.qaPointers.length');
    const record = { type, ids: touchPoints.map((point) => point.id), ...details };
    protocol.push(record);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints }, sessionId);
      await pause(25);
      record.observed = await evaluate(`({
        pointers: structuredClone(window.qaPointers.slice(${pointerOffset})),
        last: window.harness.sent.at(-1) ?? null,
        heldControls: [...document.querySelectorAll('[data-hax-control][data-held="true"]')]
          .map(element => element.getAttribute('data-hax-control'))
      })`);
    } catch (error) {
      record.error = String(error);
      throw error;
    }
    return record;
  }
  async function point(selector) {
    const result = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
    })()`);
    if (!result) throw new Error(`Mounted control missing: ${selector}`);
    return result;
  }
  const control = (name) => `[data-hax-control="${name}"]`;
  async function start(id, name) {
    const p = await point(control(name));
    contacts.set(id, { id, x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1 });
    const record = await touch('touchStart');
    const down = record.observed.pointers.find((event) => event.type === 'pointerdown');
    if (down) browserPointers.set(id, down.pointerId);
  }
  async function move(id, p) {
    const old = contacts.get(id);
    if (!old) throw new Error(`No touch ${id} to move.`);
    contacts.set(id, { ...old, x: p.x, y: p.y });
    await touch('touchMove');
  }
  async function end(id) {
    const released = contacts.get(id);
    if (!released) throw new Error(`No touch ${id} to release.`);
    const remaining = [...contacts.keys()].filter((activeId) => activeId !== id);
    // Chromium's default DispatchWebTouchEvent path releases only the IDs supplied to
    // touchEnd. Missing IDs on touchMove remain active. See CreateWebTouchEvents:
    // https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/input_handler.cc
    // capture.mjs pins this path by disabling SyntheticPointerActions. Keep a named
    // release while another thumb is held; an empty final touchEnd ends the last contact.
    const record = await touch('touchEnd', remaining.length ? [released] : [], {
      releasedId: id,
      remainingIds: remaining,
      method: remaining.length ? 'explicit released point' : 'empty final release',
    });
    if (remaining.length) {
      const expectedPointer = browserPointers.get(id);
      const ups = record.observed.pointers.filter((event) => event.type === 'pointerup');
      check(
        `individual touchEnd releases only browser pointer for contact ${id}`,
        expectedPointer !== undefined &&
          ups.length === 1 &&
          ups[0].pointerId === expectedPointer &&
          ups[0].pointerType === 'touch' &&
          ups[0].trusted &&
          !record.observed.pointers.some((event) => event.type === 'pointercancel'),
        { expectedPointer, ...record },
      );
    }
    contacts.delete(id);
    browserPointers.delete(id);
  }
  async function cancel() {
    if (contacts.size) await touch('touchCancel');
    contacts.clear();
    browserPointers.clear();
  }
  async function keyboard(key, code, down, repeat = false) {
    await cdp.send(
      'Input.dispatchKeyEvent',
      {
        type: down ? 'rawKeyDown' : 'keyUp',
        key,
        code,
        windowsVirtualKeyCode:
          key === ' '
            ? 32
            : key === 'Enter'
              ? 13
              : key === 'ArrowLeft'
                ? 37
                : key === 'ArrowUp'
                  ? 38
                  : key === 'ArrowRight'
                    ? 39
                    : key === 'ArrowDown'
                      ? 40
                      : key.toUpperCase().charCodeAt(0),
        autoRepeat: repeat,
      },
      sessionId,
    );
    if (down) keyHeld.set(key, code);
    else keyHeld.delete(key);
    await pause(20);
  }
  async function releaseKeys() {
    for (const [key, code] of [...keyHeld]) await keyboard(key, code, false);
  }
  async function reset(kind = 'play') {
    await cancel();
    await releaseKeys();
    await evaluate(`window.harness.reset(${JSON.stringify(kind)})`);
    await pause(30);
    await clear();
    await evaluate('window.qaPointers.length=0;window.qaKeys.length=0');
  }
  async function lastIs(name, expected) {
    const seen = await snapshot();
    check(name, equals(vector(seen.sent.at(-1)), expected), {
      expected,
      last: seen.sent.at(-1) ?? null,
    });
    return seen;
  }
  async function stopped(name) {
    const before = await snapshot();
    await pause(720);
    const after = await snapshot();
    check(
      name,
      after.sent.length === before.sent.length &&
        equals(vector(after.sent.at(-1)), { dx: 0, dy: 0, kick: false }),
      {
        before: before.sent.length,
        after: after.sent.length,
        last: after.sent.at(-1) ?? null,
        waitedMs: 720,
      },
    );
  }
  async function scenario(name, action) {
    try {
      await action();
    } catch (error) {
      check(name, false, { error: String(error) });
    } finally {
      await cancel();
      await releaseKeys();
      await evaluate(`(() => {
        if (!window.qaHiddenOverride) return;
        if (window.qaHiddenDescriptor) Object.defineProperty(document,'hidden',window.qaHiddenDescriptor);
        else delete document.hidden;
        delete window.qaHiddenDescriptor;
        delete window.qaHiddenOverride;
      })()`);
    }
  }

  await scenario('two real touch thumbs', async () => {
    await reset();
    await start(11, 'up-right');
    await lastIs('touch diagonal pad emits both axes', { dx: 1, dy: -1, kick: false });
    await start(12, 'kick');
    await lastIs('second thumb keeps diagonal and adds kick', { dx: 1, dy: -1, kick: true });
    await capture('interaction-two-thumbs.png');
    await end(11);
    await lastIs('lifting movement thumb preserves independent kick', { dx: 0, dy: 0, kick: true });
    await end(12);
    const observed = await lastIs('final touchEnd releases kick', { dx: 0, dy: 0, kick: false });
    check(
      'touch pointers are trusted browser events',
      observed.pointers.some((p) => p.type === 'pointerdown' && p.pointerType === 'touch') &&
        observed.pointers.filter((p) => p.pointerType === 'touch').every((p) => p.trusted),
      { pointers: observed.pointers },
    );
    await stopped('touch release stops heartbeats');
  });

  await scenario('opposing touches and touchCancel', async () => {
    await reset();
    await start(21, 'left');
    await start(22, 'right');
    await lastIs('opposite independent directions cancel', { dx: 0, dy: 0, kick: false });
    await end(22);
    await lastIs('lifting one opposite thumb restores the other direction', {
      dx: -1,
      dy: 0,
      kick: false,
    });
    await cancel();
    const observed = await lastIs('touchCancel sends neutral', { dx: 0, dy: 0, kick: false });
    check(
      'touchCancel reaches a trusted pointercancel',
      observed.pointers.some((p) => p.type === 'pointercancel' && p.trusted),
      { pointers: observed.pointers },
    );
    await stopped('touch cancellation stops heartbeats');
  });

  await scenario('captured pad drag', async () => {
    await reset();
    await start(31, 'left');
    await start(32, 'kick');
    const centre = await point('[data-hax-pad-centre="true"]');
    await move(31, centre);
    await lastIs('dragging to neutral centre releases only movement', { dx: 0, dy: 0, kick: true });
    await move(31, await point(control('down-left')));
    await lastIs('captured pointer changes direction across pad cells', {
      dx: -1,
      dy: 1,
      kick: true,
    });
    const pad = await point('[data-hax-pad="true"]');
    await move(31, { x: Math.max(1, pad.left - 8), y: pad.y });
    await lastIs('dragging outside pad releases movement and keeps kick', {
      dx: 0,
      dy: 0,
      kick: true,
    });
    await end(32);
    await lastIs('independent kick release after pad drag is neutral', {
      dx: 0,
      dy: 0,
      kick: false,
    });
    await end(31);
  });

  await scenario('heartbeat cadence and sequence', async () => {
    await reset('accepted');
    const before = await snapshot();
    await start(41, 'down-right');
    await start(42, 'kick');
    await pause(980);
    const held = await snapshot();
    const packets = held.events.filter((event) =>
      equals(vector(event.input), { dx: 1, dy: 1, kick: true }),
    );
    const deltas = packets.slice(1).map((event, i) => Math.round(event.at - packets[i].at));
    const steady = deltas.slice(1);
    check(
      'held controls renew on roughly 300ms heartbeat',
      packets.length >= 4 &&
        steady.length >= 2 &&
        steady.every((delta) => delta >= 220 && delta <= 450),
      {
        configuredMs: 300,
        observedDeltasMs: deltas,
        packets: packets.map((p) => p.input),
        note: 'First interval is anchored to component mount, so steady heartbeat intervals exclude it.',
      },
    );
    check(
      'sequence begins above authoritative acceptedSeq and increases',
      held.sent.length > 0 &&
        held.sent[0].seq > before.acceptedSeq &&
        held.sent.every((packet, i) => i === 0 || packet.seq > held.sent[i - 1].seq),
      { acceptedSeq: before.acceptedSeq, emittedSeq: held.sent.map((p) => p.seq) },
    );
    check(
      'every held packet carries current play phaseAt',
      held.sent.every((p) => p.phaseAt === before.phaseAt),
      { expected: before.phaseAt, stamps: held.sent.map((p) => p.phaseAt) },
    );
    await end(41);
    await end(42);
    await stopped('heartbeat stops after independent releases');
  });

  await scenario('window blur releases held sources', async () => {
    await reset();
    await start(51, 'up');
    await start(52, 'kick');
    await evaluate('window.dispatchEvent(new Event("blur"))');
    await pause(25);
    await lastIs('blur handler publishes neutral input', { dx: 0, dy: 0, kick: false });
    await stopped('blur handler stops heartbeats');
  });

  await scenario('document hidden signal releases held sources', async () => {
    await reset();
    await start(61, 'right');
    await evaluate(`(() => {
      window.qaHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
      window.qaHiddenOverride = true;
      Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true });
      document.dispatchEvent(new Event('visibilitychange'));
    })()`);
    await pause(25);
    await lastIs('visibility handler publishes neutral input', { dx: 0, dy: 0, kick: false });
    await stopped('visibility handler stops heartbeats');
    await evaluate(`(() => {
      if (window.qaHiddenDescriptor) Object.defineProperty(document,'hidden',window.qaHiddenDescriptor);
      else delete document.hidden;
      delete window.qaHiddenDescriptor;
      delete window.qaHiddenOverride;
    })()`);
  });

  for (const boundary of [
    {
      name: 'blur/refocus',
      id: 101,
      enter: 'window.dispatchEvent(new Event("blur"))',
      resume: 'window.dispatchEvent(new Event("focus"))',
    },
    {
      name: 'hidden/visible',
      id: 111,
      enter: `(() => {
        window.qaHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
        window.qaHiddenOverride = true;
        Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true });
        document.dispatchEvent(new Event('visibilitychange'));
      })()`,
      resume: `(() => {
        if (window.qaHiddenDescriptor) Object.defineProperty(document,'hidden',window.qaHiddenDescriptor);
        else delete document.hidden;
        delete window.qaHiddenDescriptor;
        delete window.qaHiddenOverride;
        document.dispatchEvent(new Event('visibilitychange'));
      })()`,
    },
  ]) {
    await scenario(`same held touch moves after ${boundary.name}`, async () => {
      await reset();
      await start(boundary.id, 'left');
      await lastIs(`${boundary.name}: initial trusted touch holds movement`, {
        dx: -1,
        dy: 0,
        kick: false,
      });
      const pointerId = browserPointers.get(boundary.id);
      const captureStatus = () =>
        pointerId === undefined
          ? null
          : evaluate(`([...document.querySelectorAll('[data-hax-control]')]
              .filter(element=>element.hasPointerCapture(${pointerId}))
              .map(element=>element.getAttribute('data-hax-control')))`);
      const captureBefore = await captureStatus();
      // These lifecycle signals are synthetic; touchStart/Move/End remain real CDP events.
      await evaluate(boundary.enter);
      await pause(40);
      await lastIs(`${boundary.name}: lifecycle release sends neutral touch input`, {
        dx: 0,
        dy: 0,
        kick: false,
      });
      await evaluate(boundary.resume);
      await pause(40);
      const resumed = await snapshot();
      const captureAfter = await captureStatus();
      const pointerOffset = resumed.pointers.length;
      // Keep exactly the original contact active; do not replace it with a fresh pointerdown.
      await move(boundary.id, await point(control('right')));
      const moved = await snapshot();
      const movement = moved.pointers.slice(pointerOffset);
      check(
        `${boundary.name}: same held contact produces a trusted pointer move`,
        pointerId !== undefined &&
          movement.some(
            (event) =>
              event.type === 'pointermove' &&
              event.pointerId === pointerId &&
              event.pointerType === 'touch' &&
              event.trusted,
          ) &&
          !moved.pointers.some(
            (event) =>
              event.pointerId === pointerId &&
              (event.type === 'pointerup' || event.type === 'pointercancel'),
          ),
        { contactId: boundary.id, pointerId, captureBefore, captureAfter, movement },
      );
      check(
        `${boundary.name}: stale touch move cannot revive canceled movement`,
        moved.sent.length === resumed.sent.length &&
          moved.heldControls.length === 0 &&
          equals(vector(moved.sent.at(-1)), { dx: 0, dy: 0, kick: false }),
        {
          packetsBeforeMove: resumed.sent.length,
          packetsAfterMove: moved.sent.length,
          last: moved.sent.at(-1) ?? null,
          heldControls: moved.heldControls,
          captureBefore,
          captureAfter,
        },
      );
      await stopped(`${boundary.name}: stale touch move cannot restart heartbeats`);
      await end(boundary.id);
      await lastIs(`${boundary.name}: lifting the canceled contact remains neutral`, {
        dx: 0,
        dy: 0,
        kick: false,
      });
      const lifted = await snapshot();
      await start(boundary.id + 1, 'down-right');
      const fresh = await lastIs(`${boundary.name}: a fresh touch can drive again`, {
        dx: 1,
        dy: 1,
        kick: false,
      });
      const freshPackets = fresh.sent.slice(lifted.sent.length);
      check(
        `${boundary.name}: fresh touch uses current phase and increasing sequence`,
        freshPackets.length > 0 &&
          freshPackets.every(
            (packet, i) =>
              packet.phaseAt === fresh.phaseAt &&
              packet.seq > fresh.acceptedSeq &&
              (i === 0 || packet.seq > freshPackets[i - 1].seq),
          ),
        { phaseAt: fresh.phaseAt, acceptedSeq: fresh.acceptedSeq, packets: freshPackets },
      );
      await end(boundary.id + 1);
    });
  }

  for (const kind of ['paused', 'goal', 'departed', 'done']) {
    await scenario(`${kind} push releases held sources`, async () => {
      await reset();
      await start(71, 'down-left');
      await start(72, 'kick');
      await evaluate(`window.harness.setView(${JSON.stringify(kind)})`);
      await pause(40);
      const current = await lastIs(`${kind} push publishes neutral input`, {
        dx: 0,
        dy: 0,
        kick: false,
      });
      check(`${kind} screen contains no gameplay controls`, current.controls === 0, {
        controls: current.controls,
      });
      await stopped(`${kind} push stops heartbeats`);
      if (kind === 'paused') {
        await capture('interaction-paused.png');
        await evaluate('window.harness.setView("play")');
        await pause(40);
        const resumed = await snapshot();
        await pause(650);
        const later = await snapshot();
        check(
          'resume cannot revive pointers held before pause',
          later.sent.length === resumed.sent.length,
          { resumed: resumed.sent.length, later: later.sent.length, waitedMs: 650 },
        );
      }
    });
  }

  await scenario('new phase uses its authoritative identity', async () => {
    await reset();
    await start(81, 'left');
    await evaluate('window.harness.setView("goal")');
    await pause(30);
    await cancel();
    await evaluate('window.harness.setView("next-play")');
    await pause(30);
    await clear();
    const fresh = await snapshot();
    await start(82, 'right');
    const seen = await snapshot();
    check(
      'after a goal every new packet uses new play phaseAt',
      seen.sent.length > 0 &&
        seen.sent.every((p) => p.phaseAt === fresh.phaseAt && p.seq > fresh.acceptedSeq),
      { phaseAt: fresh.phaseAt, acceptedSeq: fresh.acceptedSeq, packets: seen.sent },
    );
  });

  await scenario('trusted keyboard holds and auto-repeat', async () => {
    await reset();
    await evaluate('document.activeElement?.blur()');
    await keyboard('ArrowUp', 'ArrowUp', true);
    await keyboard('ArrowRight', 'ArrowRight', true);
    await lastIs('keyboard diagonal combines two held axes', { dx: 1, dy: -1, kick: false });
    await clear();
    const repeatStart = await snapshot();
    for (let n = 0; n < 5; n++) await keyboard('ArrowRight', 'ArrowRight', true, true);
    const repeated = await snapshot();
    const elapsed = repeated.performanceNow - repeatStart.performanceNow;
    const heartbeatAllowance = Math.floor(elapsed / 300) + 1;
    check(
      'auto-repeat does not flood duplicate input',
      repeated.sent.every((p) => equals(vector(p), { dx: 1, dy: -1, kick: false })) &&
        repeated.sent.length <= heartbeatAllowance,
      {
        repeatedKeydowns: 5,
        packets: repeated.sent,
        elapsedMs: Math.round(elapsed),
        heartbeatAllowance,
        note: 'Scheduled heartbeats may occur during the repeated keydown window.',
      },
    );
    await keyboard('x', 'KeyX', true);
    await lastIs('X adds kick without losing keyboard movement', { dx: 1, dy: -1, kick: true });
    await keyboard('ArrowRight', 'ArrowRight', false);
    await lastIs('releasing one keyboard axis retains the other and kick', {
      dx: 0,
      dy: -1,
      kick: true,
    });
    await keyboard('x', 'KeyX', false);
    await lastIs('X release removes only kick', { dx: 0, dy: -1, kick: false });
    await keyboard(' ', 'Space', true);
    await lastIs('Space also holds kick', { dx: 0, dy: -1, kick: true });
    await keyboard(' ', 'Space', false);
    await keyboard('ArrowUp', 'ArrowUp', false);
    await lastIs('keyboard final key release sends neutral', { dx: 0, dy: 0, kick: false });
    await keyboard('w', 'KeyW', true);
    await keyboard('d', 'KeyD', true);
    await lastIs('WASD keys provide the same held diagonal', { dx: 1, dy: -1, kick: false });
    await keyboard('w', 'KeyW', false);
    await keyboard('d', 'KeyD', false);
    await evaluate('document.querySelector("[data-hax-control=up-left]").focus()');
    await keyboard('Enter', 'Enter', true);
    await lastIs('Enter holds the focused direction control', { dx: -1, dy: -1, kick: false });
    await keyboard('Enter', 'Enter', false);
    const keys = await snapshot();
    check(
      'keyboard events are trusted CDP events',
      keys.keys.length > 0 && keys.keys.every((event) => event.trusted),
      { keys: keys.keys },
    );
    await stopped('keyboard release stops heartbeats');
  });

  for (const boundary of [
    {
      name: 'pause/resume',
      enter: 'window.harness.setView("paused")',
      resume: 'window.harness.setView("play")',
    },
    {
      name: 'goal/new-play',
      enter: 'window.harness.setView("goal")',
      resume: 'window.harness.setView("next-play")',
    },
    {
      name: 'blur/refocus',
      enter: 'window.dispatchEvent(new Event("blur"))',
      resume: 'window.dispatchEvent(new Event("focus"))',
    },
  ]) {
    await scenario(`held keyboard repeat across ${boundary.name}`, async () => {
      await reset();
      await evaluate('document.activeElement?.blur()');
      await keyboard('ArrowRight', 'ArrowRight', true);
      await keyboard('x', 'KeyX', true);
      await lastIs(`${boundary.name}: genuine key-downs hold movement and kick`, {
        dx: 1,
        dy: 0,
        kick: true,
      });
      // The CDP keys stay physically held: no key-up is sent at the boundary.
      await evaluate(boundary.enter);
      await pause(40);
      await lastIs(`${boundary.name}: boundary releases movement and armed kick`, {
        dx: 0,
        dy: 0,
        kick: false,
      });
      await evaluate(boundary.resume);
      await pause(40);
      const resumed = await snapshot();
      const keyOffset = resumed.keys.length;
      for (let n = 0; n < 3; n++) {
        await keyboard('ArrowRight', 'ArrowRight', true, true);
        await keyboard('x', 'KeyX', true, true);
      }
      const repeated = await snapshot();
      const repeats = repeated.keys.slice(keyOffset);
      check(
        `${boundary.name}: held-key repeats are trusted CDP events without a release`,
        repeats.length === 6 &&
          repeats.every((event) => event.type === 'keydown' && event.repeat && event.trusted) &&
          !repeated.keys.some((event) => event.type === 'keyup'),
        { keys: repeated.keys },
      );
      check(
        `${boundary.name}: repeat cannot revive released controls`,
        repeated.sent.length === resumed.sent.length &&
          repeated.heldControls.length === 0 &&
          equals(vector(repeated.sent.at(-1)), { dx: 0, dy: 0, kick: false }),
        {
          packetsBeforeRepeat: resumed.sent.length,
          packetsAfterRepeat: repeated.sent.length,
          last: repeated.sent.at(-1) ?? null,
          heldControls: repeated.heldControls,
          phaseAt: repeated.phaseAt,
        },
      );
      await stopped(`${boundary.name}: ignored repeat cannot restart heartbeats`);

      await releaseKeys();
      const released = await snapshot();
      await keyboard('ArrowRight', 'ArrowRight', true);
      await keyboard('x', 'KeyX', true);
      const fresh = await lastIs(`${boundary.name}: release and fresh press work again`, {
        dx: 1,
        dy: 0,
        kick: true,
      });
      const freshPackets = fresh.sent.slice(released.sent.length);
      check(
        `${boundary.name}: fresh presses use current phase and increasing sequence`,
        freshPackets.length >= 2 &&
          freshPackets.every(
            (packet, i) =>
              packet.phaseAt === fresh.phaseAt &&
              packet.seq > fresh.acceptedSeq &&
              (i === 0 || packet.seq > freshPackets[i - 1].seq),
          ),
        { phaseAt: fresh.phaseAt, acceptedSeq: fresh.acceptedSeq, packets: freshPackets },
      );
    });
  }

  await scenario('controller unmount cancels held heartbeat', async () => {
    await reset();
    await start(88, 'up');
    await start(89, 'kick');
    // Incrementing generation really unmounts the old Controller; the fresh mount owns no pointers.
    await evaluate('window.harness.reset("play")');
    await pause(40);
    await lastIs('unmount publishes neutral before a fresh controller mounts', {
      dx: 0,
      dy: 0,
      kick: false,
    });
    await stopped('old controller heartbeat stops after unmount');
  });

  await scenario('kick cues follow authoritative pushes once', async () => {
    await reset();
    await start(91, 'kick');
    const local = await snapshot();
    check('local kick hold does not fake an accepted kick sound', local.cues.length === 0, {
      cues: local.cues,
    });
    await evaluate('window.harness.setView("kick-fired")');
    await pause(40);
    const first = await snapshot();
    check('new authoritative lastKickAt cues one thud', equals(first.cues, ['thud']), {
      cues: first.cues,
    });
    await evaluate('window.harness.setView("kick-fired")');
    await pause(40);
    const duplicate = await snapshot();
    check('duplicate public push cannot replay kick cue', equals(duplicate.cues, ['thud']), {
      cues: duplicate.cues,
    });
    await evaluate('window.harness.setView("kick-fired-new")');
    await pause(40);
    const second = await snapshot();
    check(
      'a later authoritative kick stamp cues exactly once more',
      equals(second.cues, ['thud', 'thud']),
      { cues: second.cues },
    );
    await cancel();
    // Observe the new mount's effects without clearRecords masking a spurious retained cue.
    await evaluate('window.harness.reset("kick-fired")');
    await pause(40);
    const remounted = await snapshot();
    check(
      'remount with retained lastKickAt does not replay old kick',
      remounted.cues.length === 0,
      { cues: remounted.cues },
    );
  });

  await scenario('spectator has no controls or keyboard input', async () => {
    await reset('spectator');
    await keyboard('ArrowRight', 'ArrowRight', true);
    await keyboard('x', 'KeyX', true);
    await pause(350);
    const seen = await snapshot();
    check('spectator sees public stage without gameplay controls', seen.controls === 0, {
      controls: seen.controls,
    });
    check('spectator keyboard does not emit player controls', seen.sent.length === 0, {
      packets: seen.sent,
    });
    await capture('interaction-spectator.png');
  });

  const final = await snapshot();
  check('mounted page reports no uncaught runtime errors', final.errors.length === 0, {
    errors: final.errors,
  });
  return {
    touchProtocol: protocol,
    inputMethod:
      'CDP trusted touch and keyboard; named touchEnd lifts an individual thumb on Chromium WebTouch path',
    touchProvenance: {
      disabledFeature: 'SyntheticPointerActions',
      dispatchPath: 'DispatchWebTouchEvent / CreateWebTouchEvents',
      individualRelease:
        'touchEnd with only the released contact; remaining contacts stay stationary and active',
      finalRelease: 'touchEnd with an empty point list',
      source:
        'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/input_handler.cc',
      featureSource:
        'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/common/content_features.cc',
      note: 'Primary source inspected: WebTouch erases supplied touchEnd IDs; active-point omission releases belong to the optional SyntheticPointerActions branch. Protocol documentation differs from the default WebTouch implementation.',
    },
    lifecycleMethod:
      'Pause/phase/departure use supplied public views; trusted CDP keyboard repeat stays held across pause/phase/blur until a real key-up and fresh key-down. Trusted same-contact touch moves exercise release after blur/visibility, followed by touchEnd and a fresh touchStart. Blur/refocus and document-hidden/visible signals are explicitly synthetic handler tests.',
  };
}
