// Artist remount keeps known-unsent drawing; sent or wrong-player work must never replay.
export async function inkDraftChecks({ rpc, socket, evaluate, settle, button, check }) {
  const box = await evaluate(`(() => {
    const c=document.querySelector('canvas'), r=c.getBoundingClientRect(), s=getComputedStyle(c);
    const w=parseFloat(s.width), h=parseFloat(s.height);
    const l=parseFloat(s.borderLeftWidth), t=parseFloat(s.borderTopWidth);
    const sx=r.width/(w+l+parseFloat(s.borderRightWidth)), sy=r.height/(h+t+parseFloat(s.borderBottomWidth));
    return {x:r.x+l*sx,y:r.y+t*sy,w:w*sx,h:h*sy};
  })()`);
  const event = (type, [x, y]) => ({
    type,
    x: box.x + (x * box.w) / 1000,
    y: box.y + (y * box.h) / 600,
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    ...(type === 'mouseMoved' ? {} : { clickCount: 1 }),
  });
  const batch = (events) =>
    Promise.all(events.map((params) => rpc(socket, 'Input.dispatchMouseEvent', params)));
  const dot = (point) => [event('mousePressed', point), event('mouseReleased', point)];
  const info = () => evaluate('p04.info()');
  const remount = async () => {
    await evaluate('p04.remountPhone()');
    await settle();
  };
  const painted = (point) =>
    evaluate(
      `document.querySelector('canvas').getContext('2d').getImageData(${point[0]},${point[1]},1,1).data[3]>0`,
    );
  const selection = () =>
    evaluate(`({
    color:document.querySelector('[aria-label="Ink color"] [aria-pressed="true"]').textContent.trim(),
    width:document.querySelector('[aria-label="Line thickness"] [aria-pressed="true"]').textContent.trim()
  })`);
  await button('Gray');
  await button('Thick');
  await remount();
  const toolsRestored = await selection();
  check(
    toolsRestored.color === 'Gray ✓' && toolsRestored.width === 'Thick ✓',
    `An empty artist FIFO must still restore selected tools: ${JSON.stringify(toolsRestored)}`,
  );
  await batch(dot([500, 300]));
  await settle();
  const styled = await info();
  const stylePacket = styled.sent.at(-1);
  check(
    stylePacket.type === 'stroke' &&
      stylePacket.stroke.color === 5 &&
      stylePacket.stroke.width === 18,
    `The next native stroke must use restored Gray/Thick: ${JSON.stringify(stylePacket)}`,
  );
  await remount();
  const toolsAfterSend = await selection();
  check(
    (await info()).sent.length === styled.sent.length &&
      toolsAfterSend.color === 'Gray ✓' &&
      toolsAfterSend.width === 'Thick ✓',
    'Sent ink must not replay and selected tools must survive after the FIFO empties',
  );
  await button('Ink');
  await button('Medium');
  await button('Clear');
  await button('Tap again to clear');
  const first = [250, 180],
    second = [750, 420];
  const before = (await info()).sent.length;
  try {
    await evaluate('p04.holdClocks(true)');
    await batch([...dot(first), ...dot(second)]);
    await settle();
    await remount();
    const restored = await info();
    check(
      restored.sent.length === before && (await painted(first)) && (await painted(second)),
      `Never-sent dots must survive artist remount without premature send: ${JSON.stringify(restored)}`,
    );
    await evaluate('p04.holdClocks(false)');
    await settle();
    await settle();
    const delivered = await info();
    check(
      delivered.sent.length === before + 2 &&
        delivered.strokes.length === 2 &&
        JSON.stringify(delivered.strokes.map((s) => s.points[0])) ===
          JSON.stringify([first, second]),
      `Restored dots must deliver once in FIFO order: ${JSON.stringify(delivered)}`,
    );
    await remount();
    await settle();
    const acknowledged = await info();
    check(
      acknowledged.sent.length === delivered.sent.length && acknowledged.strokes.length === 2,
      'Sent packets removed from the draft must never replay on another remount',
    );
    await button('Clear');
    await button('Tap again to clear');

    const start = [100, 120],
      middle = [500, 300],
      end = [900, 480];
    const tailBase = (await info()).sent.length;
    await evaluate('p04.holdClocks(true)');
    await batch([
      event('mousePressed', start),
      event('mouseMoved', middle),
      event('mouseMoved', end),
    ]);
    await remount();
    await batch([event('mouseReleased', end)]);
    check(
      (await info()).sent.length === tailBase && (await painted(end)),
      'An active dirty tail must survive artist remount before its first send',
    );
    await evaluate('p04.holdClocks(false)');
    await settle();
    await settle();
    const tail = await info();
    check(
      tail.sent.length === tailBase + 1 &&
        tail.strokes.length === 1 &&
        JSON.stringify(tail.strokes[0].points) === JSON.stringify([start, middle, end]),
      `A recovered dirty tail must deliver once with its endpoints: ${JSON.stringify(tail)}`,
    );
    await button('Undo');
    check(
      (await info()).strokes.length === 0,
      'One Undo must remove a recovered dirty-tail gesture',
    );
    return {
      tools: {
        toolsRestored,
        toolsAfterSend,
        nextColor: stylePacket.stroke.color,
        nextWidth: stylePacket.stroke.width,
      },
      dots: {
        sentPackets: 2,
        points: delivered.strokes.map((s) => s.points[0]),
        duplicatePackets: 0,
      },
      activeTail: { points: tail.strokes[0].points, sentPackets: 1, undoStrokes: 0 },
    };
  } finally {
    await evaluate('p04.holdClocks(false)').catch(() => undefined);
  }
}
