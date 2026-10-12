// Compare actual public rendered contours, including local dents that bounds miss.
// Distances are measured against segments, so differing vertex counts are harmless.
export function contourDistance(left, right, zoom) {
  const valid = (points) =>
    Array.isArray(points) &&
    points.length >= 4 &&
    points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
  if (!valid(left) || !valid(right) || !Number.isFinite(zoom) || zoom <= 0)
    throw new Error('Contour comparison requires two observed finite closed paths and zoom.');
  const segmentDistance = (point, from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length))
      : 0;
    return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
  };
  const directed = (from, to) =>
    from.map((point) =>
      Math.min(
        ...to.map((start, index) => segmentDistance(point, start, to[(index + 1) % to.length])),
      ),
    );
  const distances = [...directed(left, right), ...directed(right, left)]
    .map((distance) => distance * zoom)
    .sort((a, b) => a - b);
  return {
    maximumPx: distances.at(-1),
    percentile95Px: distances[Math.ceil(distances.length * 0.95) - 1],
    meanPx: distances.reduce((sum, value) => sum + value, 0) / distances.length,
    comparedPoints: distances.length,
    metric:
      'symmetric observed-point-to-closed-segment distance in screen pixels; local contours, not only bounding boxes',
  };
}

// Runs inside the browser. Read actual animated CTMs/geometry; never dataset targets.
export function sampleOurs() {
  const svg = document.querySelector('[data-camera="personal"]');
  if (!svg) throw new Error('Missing mounted personal arena');
  const world = svg.querySelector('[data-world-layer]');
  const rootMatrix = svg.getCTM();
  const worldMatrix = world?.getCTM();
  if (!rootMatrix || !worldMatrix) throw new Error('Missing rendered SVG matrices');
  const matrix = rootMatrix.inverse().multiply(worldMatrix);
  const box = svg.getBoundingClientRect();
  const poses = [...svg.querySelectorAll('[data-mine="true"][data-cell-id]')].map((group) => {
    const body = group.querySelector('[data-cell-body]');
    const name = group.querySelector('[data-name-inside]');
    if (!(body instanceof SVGGeometryElement) || !name)
      throw new Error('Missing painted cell geometry or name');
    const pose = worldMatrix.inverse().multiply(group.getCTM());
    const bodyMatrix = worldMatrix.inverse().multiply(body.getCTM());
    const baseline = worldMatrix.inverse().multiply(name.getCTM());
    const bounds = body.getBBox();
    const length = body.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) throw new Error('Empty painted cell path');
    const vertices = Array.from({ length: 192 }, (_, index) => {
      const local = body.getPointAtLength((length * index) / 192);
      const point = local.matrixTransform(bodyMatrix);
      return { x: point.x, y: point.y };
    });
    return {
      id: Number(group.dataset.cellId),
      name: name.textContent,
      x: pose.e,
      y: pose.f,
      radius: (bounds.width + bounds.height) / 4,
      vertices,
      fontSize: Number.parseFloat(getComputedStyle(name).fontSize),
      baselineY: baseline.f + name.y.animVal.getItem(0).value * baseline.d,
      font: getComputedStyle(name).fontFamily,
      geometrySource:
        'actual animated SVGGeometryElement path samples and getBBox, excluding stroke',
    };
  });
  return {
    x: (box.width / 2 - matrix.e) / matrix.a,
    y: (box.height / 2 - matrix.f) / matrix.d,
    center: [(box.width / 2 - matrix.e) / matrix.a, (box.height / 2 - matrix.f) / matrix.d].join(
      ' ',
    ),
    zoom: matrix.a,
    width: box.width,
    height: box.height,
    targetCenter: svg.dataset.cameraCenter,
    targetZoom: Number(svg.dataset.cameraZoom),
    viewBox: svg.getAttribute('viewBox'),
    names: [...svg.querySelectorAll('[data-name-inside]')].map((name) => name.textContent),
    ownedBaselines: poses.map(({ name, x, baselineY }) => ({ name, x, baselineY })),
    poses,
    animations: document.getAnimations().length,
    svgAnimations: svg.querySelectorAll('animateTransform,animate').length,
    matrix: { a: matrix.a, e: matrix.e, f: matrix.f },
  };
}
