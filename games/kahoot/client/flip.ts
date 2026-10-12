// T-0190: the TV reveal's rows go from the race order to the standings by FLIP (first, last,
// invert, play) instead of remounting. DOM only, no React: RevealRows measures and calls these.

/** Each row's box, by player id (rows carry `data-player`). */
export function rowBoxes(list: HTMLElement | null): Map<string, DOMRect> {
  const boxes = new Map<string, DOMRect>();
  list?.querySelectorAll<HTMLElement>('[data-player]').forEach((li) => {
    boxes.set(li.dataset.player ?? '', li.getBoundingClientRect());
  });
  return boxes;
}

/** A motion token in ms (0 under reduced motion, where the tokens are 0). */
function motionMs(el: HTMLElement, token: string): number {
  const value = getComputedStyle(el).getPropertyValue(token).trim();
  const ms = value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * T-0190: FLIP from the race order to the standings. A row that stays in its column slides to its
 * new place; one that changes column fades in where it lands (diagonal flights across a column
 * read as a pile-up).
 */
export function slideRows(list: HTMLElement, before: Map<string, DOMRect>): void {
  const duration = motionMs(list, '--pb-motion-slow');
  if (duration <= 0) return;
  const easing = getComputedStyle(list).getPropertyValue('--pb-ease').trim() || 'ease-out';
  list.querySelectorAll<HTMLElement>('[data-player]').forEach((li) => {
    const from = before.get(li.dataset.player ?? '');
    if (!from || typeof li.animate !== 'function') return;
    const to = li.getBoundingClientRect();
    const dx = from.left - to.left;
    // Review e5c7d40 F1: rects are on-screen px; the stage is zoomed to the TV (4K ×2, 720p ×⅔),
    // so the translate takes the row's own px (box width / offsetWidth, as Nightfall's useSlideFaces).
    const zoom = li.offsetWidth > 0 ? to.width / li.offsetWidth : 1;
    const dy = (from.top - to.top) / (zoom || 1);
    if (Math.abs(dx) > 1) {
      li.animate(
        [
          // Keep the table visible when most of a dense room changes column at once.
          { opacity: 0.5, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration,
          easing,
          fill: 'backwards',
        },
      );
    } else if (Math.abs(dy) > 1) {
      li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration,
        easing,
      });
    }
  });
}
