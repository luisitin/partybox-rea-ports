// The device's language store and the English-keyed tables (the owner, 2026-09-22: every screen
// translatable to Spanish). Node has no window: detection falls back to English, and the store
// still switches and tells its listeners.
import { describe, expect, it } from 'vitest';
import { fill, getLang, setLang, subscribeLang, translate, translateSent } from './lang';
import type { Strings } from './lang';

const TABLE: Strings = {
  es: {
    'Waiting for the others…': 'Esperando a los demás…',
    '{name} is presenting': '{name} está presentando',
  },
};

describe('fill', () => {
  it('fills named placeholders and leaves unknown ones visible', () => {
    expect(fill('{a} and {b}', { a: 'Sam', b: 2 })).toBe('Sam and 2');
    expect(fill('{a} and {c}', { a: 'Sam' })).toBe('Sam and {c}');
    expect(fill('no vars')).toBe('no vars');
  });
});

describe('translate', () => {
  it('answers in the table’s language, with placeholders filled', () => {
    expect(translate(TABLE, 'es', 'Waiting for the others…')).toBe('Esperando a los demás…');
    expect(translate(TABLE, 'es', '{name} is presenting', { name: 'Ana' })).toBe(
      'Ana está presentando',
    );
  });
  it('falls back to the English, never to a blank', () => {
    expect(translate(TABLE, 'es', 'Not in the table')).toBe('Not in the table');
    expect(translate(TABLE, 'de', 'Waiting for the others…')).toBe('Waiting for the others…');
    expect(translate(TABLE, 'en', '{name} is presenting', { name: 'Ana' })).toBe(
      'Ana is presenting',
    );
  });
});

describe('translateSent', () => {
  const SENT: Strings = {
    es: {
      'Too slow!': '¡Demasiado lento!',
      '{name} left': '{name} se fue',
      '{a} beat {b} (x2).': '{a} le ganó a {b} (x2).',
    },
  };
  it('matches exact sentences, then placeholder sentences, with regex characters literal', () => {
    expect(translateSent(SENT, 'es', 'Too slow!')).toBe('¡Demasiado lento!');
    expect(translateSent(SENT, 'es', 'Ana María left')).toBe('Ana María se fue');
    expect(translateSent(SENT, 'es', 'Sam beat Ana (x2).')).toBe('Sam le ganó a Ana (x2).');
    expect(translateSent(SENT, 'es', 'Sam beat Ana (x2)!')).toBe('Sam beat Ana (x2)!');
  });
  it('skips short patterns when asked, so an unknown sentence is never half-translated', () => {
    const LOOSE: Strings = {
      es: { '{a} and {b}': '{a} y {b}', '{n} rounds in a row': '{n} rondas seguidas' },
    };
    expect(translateSent(LOOSE, 'es', 'Sam and Ana left early')).toBe('Sam y Ana left early');
    expect(translateSent(LOOSE, 'es', 'Sam and Ana left early', 5)).toBe('Sam and Ana left early');
    expect(translateSent(LOOSE, 'es', '3 rounds in a row', 5)).toBe('3 rondas seguidas');
  });
  it('matches number placeholders to digits only, most specific pattern first', () => {
    const T: Strings = {
      es: { '{n} votes': '{n} votos', '{name} got {n} votes': '{name} recibió {n} votos' },
    };
    expect(translateSent(T, 'es', 'Most votes')).toBe('Most votes');
    expect(translateSent(T, 'es', '12 votes')).toBe('12 votos');
    expect(translateSent(T, 'es', 'Ana got 3 votes')).toBe('Ana recibió 3 votos');
    expect(translateSent(T, 'es', 'Ana got 2.5 votes')).toBe('Ana recibió 2.5 votos');
  });
  it('shows anything unknown, or any English phone, as sent', () => {
    expect(translateSent(SENT, 'es', 'Nobody left early')).toBe('Nobody left early');
    expect(translateSent(SENT, 'en', 'Sam left')).toBe('Sam left');
    expect(translateSent(SENT, 'de', 'Sam left')).toBe('Sam left');
  });
});

describe('the store', () => {
  it('starts in English without a browser, then follows setLang and tells listeners once', () => {
    expect(getLang()).toBe('en');
    let calls = 0;
    const off = subscribeLang(() => calls++);
    setLang('es');
    setLang('es');
    expect(getLang()).toBe('es');
    expect(calls).toBe(1);
    off();
    setLang('en');
    expect(calls).toBe(1);
    expect(getLang()).toBe('en');
  });
});
