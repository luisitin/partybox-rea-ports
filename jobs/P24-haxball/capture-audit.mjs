// Runs in the captured page. It checks visible geometry, text clipping and touch targets,
// while recording accessibility-only content and not-yet-revealed podium slots separately.
export function auditLayout(phone) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const tolerance = 1;
  const box = (rect) => ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  });
  const text = (element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const label = (element) =>
    element.getAttribute('aria-label') ?? element.getAttribute('title') ?? text(element);
  const describe = (element) => ({
    tag: element.tagName.toLowerCase(),
    class: typeof element.className === 'string' ? element.className : '',
    text: label(element),
    bounds: box(element.getBoundingClientRect()),
  });
  const hiddenReason = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none') return 'display:none';
      if (style.visibility === 'hidden' || style.visibility === 'collapse')
        return 'visibility:hidden';
      if (Number(style.opacity) === 0) return 'opacity:0';
      if (current.hidden) return 'hidden attribute';
    }
    return null;
  };
  const accessibilityOnly = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      if (
        rect.width <= 2 &&
        rect.height <= 2 &&
        (style.clip !== 'auto' || style.clipPath !== 'none')
      )
        return true;
    }
    return false;
  };
  const inside = (rect) =>
    rect.left >= -tolerance &&
    rect.top >= -tolerance &&
    rect.right <= width + tolerance &&
    rect.bottom <= height + tolerance;
  const clipping = (element, rect) => {
    const clippedBy = [];
    for (let current = element.parentElement; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const parent = current.getBoundingClientRect();
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
      if (
        (clipsX &&
          (rect.left < parent.left - tolerance || rect.right > parent.right + tolerance)) ||
        (clipsY && (rect.top < parent.top - tolerance || rect.bottom > parent.bottom + tolerance))
      )
        clippedBy.push({ tag: current.tagName.toLowerCase(), bounds: box(parent) });
    }
    return clippedBy;
  };
  const controlElements = [
    ...document.querySelectorAll(
      'button,input,select,textarea,a[href],[role="button"],[role="radio"]',
    ),
  ].filter((element) => !hiddenReason(element) && !accessibilityOnly(element));
  const controls = controlElements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      ...describe(element),
      disabled: element.matches(':disabled,[aria-disabled="true"]'),
      insideViewport: inside(rect),
      clippedBy: clipping(element, rect),
      minimumTouchSize: phone ? 44 : null,
      targetFits: !phone || (rect.width >= 44 - tolerance && rect.height >= 44 - tolerance),
    };
  });
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((element) => ({
    ...describe(element),
    hidden: hiddenReason(element),
    fontSize: getComputedStyle(element).fontSize,
    lineHeight: getComputedStyle(element).lineHeight,
  }));
  const offscreen = [];
  const textClipped = [];
  const hidden = [];
  const scrollContainers = [];
  for (const element of document.querySelectorAll('body *')) {
    if (element.matches('script,style,link,meta,path,defs,clipPath,linearGradient,stop')) continue;
    const directText = [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
    const meaningful =
      directText.length > 0 || element.matches('button,input,select,textarea,img,svg');
    const reason = hiddenReason(element);
    if (reason || accessibilityOnly(element)) {
      if (meaningful) hidden.push({ ...describe(element), reason: reason ?? 'screen-reader-only' });
      continue;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      ((element.scrollHeight > element.clientHeight + tolerance &&
        ['auto', 'scroll'].includes(style.overflowY)) ||
        (element.scrollWidth > element.clientWidth + tolerance &&
          ['auto', 'scroll'].includes(style.overflowX))) &&
      element.clientHeight > 0
    )
      scrollContainers.push({
        ...describe(element),
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
      });
    if (!meaningful) continue;
    const clippedBy = clipping(element, rect);
    if (!inside(rect) || clippedBy.length) offscreen.push({ ...describe(element), clippedBy });
    for (const node of directText) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const textBounds = range.getBoundingClientRect();
      const clippedText = clipping(element, textBounds);
      const clipsSelf =
        (['hidden', 'clip'].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + tolerance) ||
        (['hidden', 'clip'].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + tolerance);
      if (!inside(textBounds) || clippedText.length || clipsSelf)
        textClipped.push({
          ...describe(element),
          textBounds: box(textBounds),
          clippedBy: clippedText,
          selfOverflow: clipsSelf,
        });
    }
  }
  const documentMetrics = {
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyClientWidth: document.body.clientWidth,
    bodyClientHeight: document.body.clientHeight,
    bodyScrollWidth: document.body.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
  };
  const podiumPlaceholders = [
    ...document.querySelectorAll('section[data-rank]:not([data-shown])'),
  ].map((element) => ({
    ...describe(element),
    rank: element.getAttribute('data-rank'),
    hidden: hiddenReason(element),
    expectedPlaceholder: /Coming up/.test(text(element)),
  }));
  const controlGeometryIssues = controls.filter(
    (control) => !control.insideViewport || !control.targetFits || control.clippedBy.length,
  );
  const visibleText = (element) => {
    if (hiddenReason(element) || accessibilityOnly(element)) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < width &&
      rect.top < height
    );
  };
  // Measure border-box edge separation in the rendered page, independently of
  // CSS gap declarations. A diagonal pair uses its nearest-corner distance.
  const phoneControls = phone ? controlElements.filter(visibleText) : [];
  const spacingPairs = [];
  const nestedControlPairs = [];
  const controlDescription = (element) => ({
    ...describe(element),
    control: element.getAttribute('data-hax-control'),
  });
  for (let i = 0; i < phoneControls.length; i++) {
    const first = phoneControls[i];
    const a = first.getBoundingClientRect();
    for (let j = i + 1; j < phoneControls.length; j++) {
      const second = phoneControls[j];
      // The selector union returns each node once. An ancestor control and its
      // nested control represent one containing hit region, not adjacent targets.
      if (first.contains(second) || second.contains(first)) {
        nestedControlPairs.push({
          first: controlDescription(first),
          second: controlDescription(second),
          reason: 'nested hit regions; not adjacent controls',
        });
        continue;
      }
      const b = second.getBoundingClientRect();
      const horizontalGapPx = Math.max(0, a.left - b.right, b.left - a.right);
      const verticalGapPx = Math.max(0, a.top - b.bottom, b.top - a.bottom);
      const edgeSeparationPx = Math.hypot(horizontalGapPx, verticalGapPx);
      spacingPairs.push({
        first: controlDescription(first),
        second: controlDescription(second),
        geometry:
          horizontalGapPx > 0 && verticalGapPx > 0
            ? 'diagonal'
            : horizontalGapPx > 0
              ? 'horizontal'
              : verticalGapPx > 0
                ? 'vertical'
                : 'overlapping or touching',
        horizontalGapPx,
        verticalGapPx,
        edgeSeparationPx,
        requiredMinimumPx: 8,
        // Preserve full precision so rounded metadata cannot hide a short gap.
        meetsMinimum: edgeSeparationPx >= 8,
      });
    }
  }
  const controlSpacingIssues = spacingPairs
    .filter((pair) => !pair.meetsMinimum)
    .map((pair) => ({
      classification: 'phone-control-spacing',
      reason: 'visible phone controls less than 8 px apart',
      ...pair,
    }));
  const controlSpacing = {
    requiredMinimumPx: phone ? 8 : null,
    visibleControls: phoneControls.length,
    pairs: spacingPairs,
    minimumSpacingPx: spacingPairs.length
      ? Math.min(...spacingPairs.map((pair) => pair.edgeSeparationPx))
      : null,
    nestedPairsExcluded: nestedControlPairs,
    issues: controlSpacingIssues,
  };
  const controlIssues = [...controlGeometryIssues, ...controlSpacingIssues];
  // The smallest singular value of the CTM's 2x2 linear part handles rotation,
  // anisotropic scaling and shear. Column lengths alone overstate sheared text.
  const minimumLinearScale = (matrix) => {
    const { a, b, c, d } = matrix;
    if (![a, b, c, d].every(Number.isFinite)) return null;
    const xx = a * a + b * b;
    const yy = c * c + d * d;
    const xy = a * c + b * d;
    const maximumSquared = (xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2;
    if (maximumSquared === 0) return 0;
    return Math.abs(a * d - b * c) / Math.sqrt(maximumSquared);
  };
  const jerseySelector = 'svg[data-haxball-pitch="true"] g[data-jersey] text';
  const jerseyLabels = [...document.querySelectorAll(jerseySelector)]
    .filter(visibleText)
    .map((element) => {
      const ctm = element.getScreenCTM();
      const scale = ctm ? minimumLinearScale(ctm) : null;
      const fontSizePx = Number.parseFloat(getComputedStyle(element).fontSize);
      const effectiveFontPx =
        scale !== null && Number.isFinite(fontSizePx) ? fontSizePx * scale : null;
      return {
        ...describe(element),
        jersey: element.closest('g[data-jersey]')?.getAttribute('data-jersey') ?? null,
        team: element.closest('g[data-team]')?.getAttribute('data-team') ?? null,
        fontSizePx: Number.isFinite(fontSizePx) ? fontSizePx : null,
        screenCtm: ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d } : null,
        minimumLinearScale: scale,
        effectiveFontPx,
        requiredMinimumPx: phone ? null : 32,
        // Compare full precision; rounded display metadata cannot turn a failure into a pass.
        meetsMinimum: phone ? null : effectiveFontPx !== null && effectiveFontPx >= 32,
      };
    });
  const svgJerseyIssues = jerseyLabels
    .filter((entry) => entry.effectiveFontPx === null || (!phone && !entry.meetsMinimum))
    .map((entry) => ({
      classification: 'svg-jersey',
      reason:
        entry.effectiveFontPx === null
          ? 'font/CTM measurement unavailable'
          : 'TV jersey below 32 px',
      ...entry,
    }));
  const minimumMeasured = (entries, field) => {
    const values = entries.map((entry) => entry[field]).filter((value) => Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  };
  const jerseyMinimum = minimumMeasured(jerseyLabels, 'effectiveFontPx');
  const svgJerseys = {
    selector: jerseySelector,
    labels: jerseyLabels,
    minimumTvPx: phone ? null : jerseyMinimum,
    minimumPhonePx: phone ? jerseyMinimum : null,
    issues: svgJerseyIssues,
  };
  // MatchStage's parent is this game's own Stage, including its instructions.
  // Shell header/footer/copyright captions are outside it and are excluded explicitly too.
  const gameRoots = [...document.querySelectorAll('[data-haxball-stage="true"]')].map(
    (stage) => stage.parentElement ?? stage,
  );
  const gameElements = new Set(gameRoots.flatMap((root) => [...root.querySelectorAll('*')]));
  const tvText = phone
    ? []
    : [...gameElements]
        .filter(
          (element) =>
            visibleText(element) &&
            !element.closest('svg,.chrome,.bottom,[data-shell-caption],[data-shell-copyright]') &&
            !element.matches('script,style,link,meta,title,desc') &&
            [...element.childNodes].some(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
            ),
        )
        .map((element) => {
          const timer =
            element.closest('[role="timer"]') !== null &&
            (element.matches('b,[data-timer-digits]') ||
              /(?:^|[_ -])digits(?:[_ -]|$)/.test(String(element.className)));
          const fontSizePx = Number.parseFloat(getComputedStyle(element).fontSize);
          const minimumPx = timer ? 96 : 32;
          return {
            ...describe(element),
            classification: timer ? 'tv-timer' : 'tv-body',
            fontSizePx: Number.isFinite(fontSizePx) ? fontSizePx : null,
            requiredMinimumPx: minimumPx,
            meetsMinimum: Number.isFinite(fontSizePx) && fontSizePx >= minimumPx,
          };
        });
  const tvBody = tvText.filter((entry) => entry.classification === 'tv-body');
  const tvTimers = tvText.filter((entry) => entry.classification === 'tv-timer');
  const tvTextIssues = tvText.filter((entry) => !entry.meetsMinimum);
  const tvTypography = {
    body: tvBody,
    timers: tvTimers,
    minimumBodyPx: minimumMeasured(tvBody, 'fontSizePx'),
    minimumTimerPx: minimumMeasured(tvTimers, 'fontSizePx'),
    issues: tvTextIssues,
  };
  const typographyIssues = [...svgJerseyIssues, ...tvTextIssues];
  return {
    viewport: { width, height, surface: phone ? 'phone' : 'tv' },
    document: documentMetrics,
    overflow: {
      horizontal: documentMetrics.scrollWidth > width + tolerance,
      vertical: documentMetrics.scrollHeight > height + tolerance,
    },
    headings,
    controls,
    controlIssues,
    controlSpacing,
    offscreen,
    textClipped,
    scrollContainers,
    intentionalHidden: hidden,
    podiumPlaceholders,
    svgJerseys,
    tvTypography,
    typographyIssues,
    summary: {
      controls: controls.length,
      controlIssues: controlIssues.length,
      controlSpacingIssues: controlSpacingIssues.length,
      offscreen: offscreen.length,
      textClipped: textClipped.length,
      scrollContainers: scrollContainers.length,
      intentionalHidden: hidden.length,
      podiumPlaceholders: podiumPlaceholders.length,
      svgJerseyIssues: svgJerseyIssues.length,
      tvBodyFontIssues: tvTextIssues.filter((entry) => entry.classification === 'tv-body').length,
      tvTimerFontIssues: tvTextIssues.filter((entry) => entry.classification === 'tv-timer').length,
      typographyIssues: typographyIssues.length,
    },
  };
}
