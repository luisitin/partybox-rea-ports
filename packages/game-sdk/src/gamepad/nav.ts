// T-0602 / ADR-090: moving the focus ring with a D-pad. `pickNext` is pure geometry (testable
// without a DOM); `focusables` / `moveFocus` / `activate` are the thin DOM layer the provider
// uses when no game handler consumed a press.
import type { PadButton } from './core';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

const center = (b: Box): { x: number; y: number } => ({
  x: b.left + b.width / 2,
  y: b.top + b.height / 2,
});

/**
 * The box to move the focus to from `from` in `dir`, or -1. A candidate must lie ahead (its centre
 * past the current one on that axis); the best has the smallest `along + 2 × across` distance, so a
 * button straight below beats a nearer one far to the side. `from` -1 picks the first box.
 */
export function pickNext(boxes: readonly Box[], from: number, dir: Dir): number {
  if (boxes.length === 0) return -1;
  const origin = boxes[from];
  if (!origin) return 0;
  const o = center(origin);
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    const c = center(b);
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 1) return;
    const score = along + 2 * across;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE =
  'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"]), [data-pad-focus]';

/**
 * The open sheet, if any: the last visible `[role="dialog"]` under `root`. While one is open the pad
 * lives inside it (focus, A, B), so a shell sheet is never operated from behind.
 */
export function openDialog(root: ParentNode = document): HTMLElement | null {
  const all = Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]'));
  const shown = all.filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[inert]'));
  return shown[shown.length - 1] ?? null;
}

/** Visible, enabled, non-modal-hidden focus targets under `root` (or the open sheet), in DOM order. */
export function focusables(root: ParentNode = document): HTMLElement[] {
  const scope = openDialog(root) ?? root;
  const all = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE));
  return all.filter((el) => {
    if (el.hasAttribute('data-pad-skip')) return false;
    if (el.closest('[inert], [aria-hidden="true"]')) return false;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true')
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** Where the pad's focus ring sits (an attribute, not :focus-visible: iOS shows none for a pad). */
export const FOCUS_ATTR = 'data-padfocus';

export function currentTarget(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[${FOCUS_ATTR}]`);
}

export function setTarget(el: HTMLElement | null, root: ParentNode = document): void {
  currentTarget(root)?.removeAttribute(FOCUS_ATTR);
  if (!el) return;
  el.setAttribute(FOCUS_ATTR, '');
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * Where the ring starts: the page's own pick (`data-pad-primary`), else the first control of the game
 * stage (`<main>`, so never the shell's header chrome), else nothing (a waiting screen: A must
 * not press the VIP button behind your back; a D-pad press still reaches the chrome). Inside an open sheet,
 * the sheet's first control.
 */
export function defaultTarget(root: ParentNode = document): HTMLElement | null {
  const list = focusables(root);
  const primary = list.find((el) => el.hasAttribute('data-pad-primary'));
  if (primary) return primary;
  if (openDialog(root)) return list[0] ?? null;
  return list.find((el) => el.closest('main')) ?? null;
}

/** Move the ring one step; with no ring yet it lands on the default. Returns the new target. */
export function moveFocus(dir: Dir, root: ParentNode = document): HTMLElement | null {
  const list = focusables(root);
  const cur = currentTarget(root);
  const from = cur ? list.indexOf(cur) : -1;
  if (from < 0) {
    const first = defaultTarget(root) ?? list[0] ?? null;
    setTarget(first, root);
    return first;
  }
  const next = pickNext(list.map(boxOf), from, dir);
  if (next < 0) return cur;
  const el = list[next] ?? null;
  setTarget(el, root);
  return el;
}

/** Put the ring on the first visible control matching `selector` (a game's own shortcut). */
export function padFocus(selector: string, root: ParentNode = document): boolean {
  const el = focusables(root).find((e) => e.matches(selector));
  if (!el) return false;
  setTarget(el, root);
  return true;
}

/** A: press the ringed element. Returns false when there is none (the caller may land the ring). */
export function activate(root: ParentNode = document): boolean {
  const cur = currentTarget(root);
  if (!cur || !cur.isConnected) return false;
  cur.click();
  return true;
}

/** B: the page's back/cancel (`data-pad-back`), if it shows one. */
export function goBack(root: ParentNode = document): boolean {
  const scope = openDialog(root) ?? root;
  const back = Array.from(scope.querySelectorAll<HTMLElement>('[data-pad-back]')).find(
    (el) => !(el as HTMLButtonElement).disabled && el.getBoundingClientRect().width > 0,
  );
  if (!back) return false;
  back.click();
  return true;
}

export function isDirection(b: PadButton): b is Dir {
  return b === 'up' || b === 'down' || b === 'left' || b === 'right';
}
