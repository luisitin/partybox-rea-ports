// The phone's language (the owner, 2026-09-22: "the language fields should affect more when you load
// into the lobby — all text should be at least translatable to Spanish"). One store per device: the
// join screen's pills set it, the 🎨 sheet can change it later, and every screen re-reads it. Each
// device speaks its own language (a TV follows its own browser); a game's CONTENT (cards, questions)
// stays in the deck's language.
//
// Tables are keyed by the English sentence, so a string is translated where it is written:
//   const L = useT(STRINGS);  …  <p>{L('Waiting for the others…')}</p>
//   L('{name} is presenting', { name })
// A language with no entry for a sentence shows the English — nothing ever renders blank.
import { createElement, useMemo, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import type { ContentLang as ContentCode } from '@partybox/shared';

export const LANGS = ['en', 'es', 'de', 'fr', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
/** Translations of English sentences, per language. `{name}` marks a placeholder. */
export type Strings = Partial<Record<Exclude<Lang, 'en'>, Readonly<Record<string, string>>>>;
/** What `useT` hands back: an English sentence (with `{name}` placeholders) in the device's language;
 *  `.sent(text)` for a sentence that arrives already written (from the server); `.lang` the language. */
export interface Translator {
  (en: string, vars?: Readonly<Record<string, string | number>>): string;
  sent: (text: string) => string;
  lang: Lang;
}

const KEY = 'partybox:lang';
const listeners = new Set<() => void>();
let current: Lang | null = null;

function isLang(v: string | null | undefined): v is Lang {
  return v !== null && v !== undefined && (LANGS as readonly string[]).includes(v);
}

/** `?lang=es` on the link (a host can hand one out), else the remembered choice, else the device. */
function detect(): Lang {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = new URLSearchParams(window.location.search)
    .get('lang')
    ?.slice(0, 2)
    .toLowerCase();
  if (isLang(fromUrl)) {
    remember(fromUrl);
    return fromUrl;
  }
  try {
    const stored = localStorage.getItem(KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* private mode */
  }
  const tag = (typeof navigator === 'undefined' ? 'en' : navigator.language || 'en')
    .slice(0, 2)
    .toLowerCase();
  return isLang(tag) ? tag : 'en';
}

function remember(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode */
  }
}

export function getLang(): Lang {
  if (current === null) current = detect();
  return current;
}

export function setLang(lang: Lang): void {
  remember(lang);
  if (current === lang) return;
  current = lang;
  for (const l of listeners) l();
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The device's language, re-rendering when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang);
}

/** Fills `{name}` placeholders. */
export function fill(text: string, vars?: Readonly<Record<string, string | number>>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The sentence in `lang` from `table`, or the English. */
export function translate(
  table: Strings,
  lang: Lang,
  en: string,
  vars?: Readonly<Record<string, string | number>>,
): string {
  const hit = lang === 'en' ? undefined : table[lang]?.[en];
  return fill(hit ?? en, vars);
}

/** `letters`: how many letters the English has outside its placeholders. */
type Pattern = { re: RegExp; names: string[]; to: string; letters: number };
const compiled = new WeakMap<Readonly<Record<string, string>>, Pattern[]>();

/** Placeholders that only ever hold a number match digits, so "{n} votes" never reads "Most votes"
 *  as n = "Most" (review 2026-09-22). */
const NUMERIC = new Set([
  ...['n', 'm', 'count', 'number', 'total', 'cap', 'percent', 'pct', 'page', 'pages'],
  ...['round', 'rounds', 'score', 'rank', 'seconds', 'points', 'amount', 'streak', 'stake', 'bet'],
]);

/** The table's `{placeholder}` sentences as patterns, built once per table; the most specific
 *  (most letters outside the placeholders) are tried first, so table order never decides. */
function patterns(rows: Readonly<Record<string, string>>): Pattern[] {
  let out = compiled.get(rows);
  if (out) return out;
  out = [];
  for (const [en, to] of Object.entries(rows)) {
    const names = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    if (names.length === 0) continue;
    const body = en
      .split(/\{\w+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .map((part, i) =>
        i === 0 ? part : `${NUMERIC.has(names[i - 1]!) ? '(-?\\d[\\d.,]*)' : '(.+?)'}${part}`,
      )
      .join('');
    const letters = en.replace(/\{\w+\}/g, '').replace(/[^\p{L}]/gu, '').length;
    out.push({ re: new RegExp(`^${body}$`), names, to, letters });
  }
  out.sort((a, b) => b.letters - a.letters);
  compiled.set(rows, out);
  return out;
}

/**
 * A sentence the server wrote in English, in `lang`: the table's exact entry, else the first
 * `{placeholder}` entry whose English matches it ("{name} left" matches "Sam left"), else as sent.
 * `minLetters`: skip patterns with fewer letters outside their placeholders — a caller matching
 * sentences it does not know (the shell's fallback to a game's table) keeps "{a} and {b}" from
 * half-translating any sentence with an "and" in it.
 */
export function translateSent(table: Strings, lang: Lang, text: string, minLetters = 0): string {
  if (lang === 'en') return text;
  const rows = table[lang];
  if (!rows) return text;
  const exact = rows[text];
  if (exact !== undefined) return exact;
  for (const p of patterns(rows)) {
    if (p.letters < minLetters) continue;
    const m = p.re.exec(text);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.names.forEach((name, i) => (vars[name] = m[i + 1]!));
    return fill(p.to, vars);
  }
  return text;
}

/** A translator for `table` in the device's language; the component re-renders when it changes. */
export function useT(table: Strings): Translator {
  const lang = useLang();
  return useMemo(
    () =>
      Object.assign(
        (en: string, vars?: Readonly<Record<string, string | number>>) =>
          translate(table, lang, en, vars),
        { sent: (text: string) => translateSent(table, lang, text), lang },
      ),
    [table, lang],
  );
}

// ── ADR-054 · abstraction audit #4: the marker a game puts beside English content on a screen in
// another language ("en inglés"). Nothing on an English screen, and nothing when the running game's
// content is not English (a Spanish deck: its words are already the room's). One SDK string, in the
// screen's own language; the element and its class stay the game's. Here, beside the language store,
// so the phones have it from the join and a game pays nothing for it (like T-0065's clock beats).

/** The marker's one sentence, here rather than in controller/strings (which reads this module's
 *  types: importing it back made a cycle). */
const CONTENT_STRINGS: Strings = { es: { 'in English': 'en inglés' } };

/** Whether a screen in `lang` marks content in `content`: only English content, never in English. */
export function marksContent(lang: Lang, content: ContentCode = 'en'): boolean {
  return content === 'en' && lang !== 'en';
}

/** The marker's words for a text-only spot (`${line} · ${note}`), or null when none is due. */
export function contentNote(lang: Lang, content?: ContentCode): string | null {
  return marksContent(lang, content) ? translate(CONTENT_STRINGS, lang, 'in English') : null;
}

export interface ContentLangProps {
  /** The running game's content language (a pushed view's `contentLang`); default English. */
  content?: ContentCode;
  /** The game's own sentence ("The facts and answers are in English."), already translated. */
  text?: string;
  /** Folded into a kicker line: " · en inglés". */
  tag?: boolean;
  /** A line of its own (`p`) or inline (`span`, the default). */
  as?: 'span' | 'p';
  className?: string;
}

/** The marker for a screen in `lang` (pure: what `ContentLang` renders). */
export function contentMark(
  lang: Lang,
  { content, text, tag = false, as: element = 'span', className }: ContentLangProps,
): JSX.Element | null {
  if (!marksContent(lang, content)) return null;
  const words = text ?? translate(CONTENT_STRINGS, lang, 'in English');
  return createElement(element, { className, lang }, tag ? ` · ${words}` : words);
}

export function ContentLang(props: ContentLangProps): JSX.Element | null {
  return contentMark(useLang(), props);
}
