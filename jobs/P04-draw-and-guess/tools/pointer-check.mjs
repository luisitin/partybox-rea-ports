// Actual browser bitmap containment and pointer registration, including release-only motion.
export async function canvasProjection(harness, height) {
  const { rpc, socket, evaluate, settle, button, check } = harness;
  await rpc(socket, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await settle();
  await evaluate('new Promise(done => setTimeout(done, 300))');
  await settle();
  const box = await evaluate(`(() => {
      const c=document.querySelector('canvas'), r=c.getBoundingClientRect(), s=getComputedStyle(c);
      const width=parseFloat(s.width), height=parseFloat(s.height);
      const left=parseFloat(s.borderLeftWidth), right=parseFloat(s.borderRightWidth);
      const top=parseFloat(s.borderTopWidth), bottom=parseFloat(s.borderBottomWidth);
      const sx=r.width/(width+left+right), sy=r.height/(height+top+bottom);
      return {left:r.left+left*sx,top:r.top+top*sy,width:width*sx,height:height*sy};
    })()`);
  check(
    box.width > 0 && box.height > 0 && Math.abs(box.width / box.height - 5 / 3) < 0.005,
    `${height}px artist bitmap must remain 5:3 (got ${box.width}×${box.height})`,
  );
  const start = { x: box.left + box.width * 0.05, y: box.top + box.height * 0.05 };
  const middle = { x: box.left + box.width * 0.5, y: box.top + box.height * 0.5 };
  const end = { x: box.left + box.width * 0.95, y: box.top + box.height * 0.95 };
  const hit = await evaluate(`(() => {
      const e=document.elementFromPoint(${start.x},${start.y});
      return {tag:e?.tagName, label:e?.getAttribute('aria-label'),
        viewport:{width:innerWidth,height:innerHeight}, state:p04.info()};
    })()`);
  check(
    hit.tag === 'CANVAS',
    `${height}px artist pointer must hit canvas: ${JSON.stringify({ box, hit })}`,
  );
  await rpc(socket, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...start,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await rpc(socket, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...middle,
    button: 'none',
    buttons: 1,
  });
  await rpc(socket, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...end,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await settle();
  // An SDK wake-up may be delayed on the shared desktop; observe the queued endpoint.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await evaluate('p04.info().strokes.at(-1)?.points.at(-1)?.[0] >= 949')) break;
    await settle();
  }
  const points = await evaluate('p04.info().strokes.at(-1)?.points');
  const first = points?.[0];
  const last = points?.at(-1);
  const projectionErrorPx =
    first && last
      ? Math.max(
          (Math.abs(first[0] - 50) * box.width) / 1000,
          (Math.abs(first[1] - 30) * box.height) / 600,
          (Math.abs(last[0] - 950) * box.width) / 1000,
          (Math.abs(last[1] - 570) * box.height) / 600,
        )
      : Infinity;
  check(
    projectionErrorPx <= 1.25,
    `${height}px pointer endpoints must map inside the border (got ${JSON.stringify({ box, hit, first, last, state: await evaluate('p04.info()') })})`,
  );
  await button('Clear');
  await button('Tap again to clear');
  return { ...box, first, last, projectionErrorPx };
}
