// T-0218 (PT-311): an unsent answer survives a reload. The shell names the moment — room, player,
// game and phase — and `TextAnswer` keeps its draft in sessionStorage under it (per tab, gone with
// the tab). A send clears it; a new phase clears every draft of the moment before. Outside a shell
// (previews, tests) there is no scope and nothing is stored.
import { createContext, useContext, useEffect, useMemo } from 'react';
import type { JSX, ReactNode } from 'react';

const PREFIX = 'pb:draft:';
const DraftScopeContext = createContext<string | null>(null);

function store(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // blocked storage (private mode, a sandboxed frame)
  }
}

/** The storage key of one prompt's draft in one scope. */
export const draftKey = (scope: string, promptKey: string | undefined): string =>
  `${PREFIX}${scope}|${promptKey ?? ''}`;

/** Drops every draft outside `scope` (all of them for `null`): the moment they belonged to is over. */
export function tidyDrafts(s: Storage, scope: string | null): void {
  const keep = scope === null ? null : `${PREFIX}${scope}|`;
  for (let i = s.length - 1; i >= 0; i--) {
    const key = s.key(i);
    if (key?.startsWith(PREFIX) && (keep === null || !key.startsWith(keep))) s.removeItem(key);
  }
}

/** The shell's scope for drafts; `null` keeps nothing. A new scope drops the drafts of the old. */
export function DraftScopeProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}): JSX.Element {
  useEffect(() => {
    const s = store();
    if (!s) return;
    try {
      tidyDrafts(s, value);
    } catch {
      // storage went away: nothing to tidy
    }
  }, [value]);
  return <DraftScopeContext.Provider value={value}>{children}</DraftScopeContext.Provider>;
}

export interface DraftStore {
  read: () => string;
  write: (text: string) => void;
  clear: () => void;
}

/** A draft slot for one prompt (`promptKey`) in the shell's scope; a no-op outside a shell. */
export function useDraft(promptKey: string | undefined): DraftStore {
  const scope = useContext(DraftScopeContext);
  const key = scope === null ? null : draftKey(scope, promptKey);
  return useMemo(() => {
    const run = <T,>(fn: (s: Storage, k: string) => T, fallback: T): T => {
      const s = store();
      if (!s || key === null) return fallback;
      try {
        return fn(s, key);
      } catch {
        return fallback; // quota or blocked storage: the draft just lives in memory
      }
    };
    return {
      read: () => run((s, k) => s.getItem(k) ?? '', ''),
      write: (text) => run((s, k) => (text ? s.setItem(k, text) : s.removeItem(k)), undefined),
      clear: () => run((s, k) => s.removeItem(k), undefined),
    };
  }, [key]);
}
