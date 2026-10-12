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
  const controls = [
    ...document.querySelectorAll(
      'button,input,select,textarea,a[href],[role="button"],[role="radio"]',
    ),
  ]
    .filter((element) => !hiddenReason(element) && !accessibilityOnly(element))
    .map((element) => {
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
  const controlIssues = controls.filter(
    (control) => !control.insideViewport || !control.targetFits || control.clippedBy.length,
  );
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
    offscreen,
    textClipped,
    scrollContainers,
    intentionalHidden: hidden,
    podiumPlaceholders,
    summary: {
      controls: controls.length,
      controlIssues: controlIssues.length,
      offscreen: offscreen.length,
      textClipped: textClipped.length,
      scrollContainers: scrollContainers.length,
      intentionalHidden: hidden.length,
      podiumPlaceholders: podiumPlaceholders.length,
    },
  };
}
