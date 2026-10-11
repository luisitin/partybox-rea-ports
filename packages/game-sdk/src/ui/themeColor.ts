// A theme token as a concrete colour, for what CSS cannot reach: a three.js material or a canvas takes a
// string, not a `var()`. Re-reads when the theme changes (T-0536, docs/sdk/ui.md → Follow the theme).
import { useSyncExternalStore } from 'react';

/** The token's current value on <html> (`--pb-felt-lit`), or '' when there is no document or it is unset. */
export function readThemeColor(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => undefined;
  const watcher = new MutationObserver(onChange);
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => watcher.disconnect();
}

/** `name` as a colour string that follows the theme; `fallback` before the page has the token (and on a server). */
export function useThemeColor(name: string, fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => readThemeColor(name) || fallback,
    () => fallback,
  );
}
