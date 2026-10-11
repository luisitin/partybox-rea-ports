// Pronunciation overrides (Part 00 §5.4 as amended by audit #17/#21/#47/#49 and ruling 17): the
// schema, precedence (item → game → SDK), case, the ipa part's words, and the shipped lists.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import globalList from './overrides.en.json' with { type: 'json' };
import { unknownPhonemes } from './letters';
import { parsePronunciations, pronunciationsSchema } from './overrides';
import { toSpeakable } from './speakable';
import type { SpeakableOptions } from './speakable';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const game = parsePronunciations({
  words: {
    quinoa: { say: 'kwin-oh-ah' },
    US: { say: 'United States' },
    Bass: { ipa: 'bˈas', why: 'the fish, on this card' },
    gif: { say: 'jif', anyCase: true },
    Harambe: { ipa: 'həɹˈɑːmbeɪ' },
    Jesus: { ipa: 'dʒˈiːzəs' },
    Kate: { phonemes: 'kˈeɪt' },
    AITA: { spell: true },
    PS5: { spell: true },
    don: { say: 'DON' },
    'Des Moines': { say: 'duh moyn' },
  },
  patterns: [{ match: '\\b19(\\d\\d)\\b', say: '19 $1' }],
  items: { p7: { quinoa: { say: 'keen-wah, again' } }, p8: { _whole: { say: 'Just this.' } } },
  cards: { c1: { Bass: { say: 'base' } } },
});
const EN: SpeakableOptions = { voice: 'sky', lang: 'en', overrides: game };
const read = (text: string, opts: Partial<SpeakableOptions> = {}): ReturnType<typeof toSpeakable> =>
  toSpeakable(text, { ...EN, ...opts });
const said = (text: string, opts: Partial<SpeakableOptions> = {}): string =>
  read(text, opts)
    .map((p) => p.text)
    .join(' ');

describe('precedence: the item, then the game, then the SDK', () => {
  it("the game's list beats the global one", () => {
    expect(said('I ate quinoa')).toBe('I ate kwin-oh-ah');
    expect(said('I ate quinoa', { overrides: undefined })).toBe('I ate keen-wah');
  });
  it("an item's own fix beats the game's list", () => {
    expect(said('quinoa', { itemId: 'p7' })).toBe('keen-wah, again');
    expect(said('quinoa', { itemId: 'nope' })).toBe('kwin-oh-ah');
  });
  it("`_whole` replaces the item's whole text; `cards` is read as `items`", () => {
    expect(read('Anything at all', { itemId: 'p8' })).toEqual([{ text: 'Just this.' }]);
    expect(said('Bass Pro', { itemId: 'c1' })).toBe('base Pro');
  });
  it('an anyCase game entry beats a same-word global entry in any case', () => {
    expect(said('GIF gif Gif')).toBe('jif jif jif');
    expect(said('a GIF', { overrides: undefined })).toBe('a gif');
  });
});

describe('matching: whole words, case-sensitive unless anyCase', () => {
  it('an entry for "US" never touches "us"', () => {
    expect(said('the US and us')).toBe('the United States and us');
  });
  it('an entry for "Bass" never touches "bass" or "Bassist"', () => {
    expect(read('Bass bass Bassist')).toEqual([
      { ipa: 'bˈas', text: 'Bass' },
      { text: 'bass Bassist' },
    ]);
  });
  it('"don" matches neither "don\'t" nor "Don"', () => {
    expect(said("don't Don don")).toBe("don't Don DON");
  });
  it('anyCase in the SDK list: COVID, Covid, covid', () => {
    const parts = read('COVID Covid covid', { overrides: undefined });
    expect(parts.map((p) => ('ipa' in p ? p.ipa : p.text))).toEqual([
      'kˈəʊvɪd',
      'kˈəʊvɪd',
      'kˈəʊvɪd',
    ]);
  });
  it('matches phrases, inside punctuation and quotes', () => {
    expect(said('“Des Moines,” she said')).toBe('duh moyn, she said');
    expect(read("'Harambe'")).toEqual([{ ipa: 'həɹˈɑːmbeɪ', text: 'Harambe' }]);
  });
  it('freezes what an override gives: no later rule rewrites it', () => {
    expect(said('US AITA')).toBe('United States A I T A');
    expect(said('born in 1945')).toBe('born in 19 45');
  });
});

describe('entries and parts', () => {
  it('an ipa part always carries words for Zira: `say`, else the word as written', () => {
    expect(read('Bass')).toEqual([{ ipa: 'bˈas', text: 'Bass' }]);
    expect(read('COVID', { overrides: undefined })).toEqual([{ ipa: 'kˈəʊvɪd', text: 'koh-vid' }]);
    for (const text of ['Bass', 'Harambe', 'Kate', 'AITA', 'COVID', 'quinoa', 'FBI'])
      for (const p of read(text)) expect(p.text.length).toBeGreaterThan(0);
  });
  it('reads `phonemes` as `ipa`', () => {
    expect(read('Kate')).toEqual([{ ipa: 'kˈeɪt', text: 'Kate' }]);
  });
  it('spells letters as phonemes and digits as words', () => {
    expect(read('my PS5')).toEqual([
      { text: 'my' },
      { ipa: 'pˈiː ˈɛs', text: 'P S' },
      { text: 'five' },
    ]);
  });
});

describe('a possessive after an ipa part adds the ending to the phonemes (audit #47)', () => {
  it('"z" after a voiced sound, "ɪz" after a hiss, "s" after a voiceless stop', () => {
    expect(read("Harambe's cage")[0]).toEqual({ ipa: 'həɹˈɑːmbeɪz', text: "Harambe's" });
    expect(read("Jesus's sandals")[0]).toEqual({ ipa: 'dʒˈiːzəsɪz', text: "Jesus's" });
    expect(read("Kate's")[0]).toEqual({ ipa: 'kˈeɪts', text: "Kate's" });
  });
  it("a plural possessive's apostrophe just goes", () => {
    expect(read("Jesus' sandals")).toEqual([
      { ipa: 'dʒˈiːzəs', text: 'Jesus' },
      { text: 'sandals' },
    ]);
  });
  it("text parts still become plurals (rule 3), a said override keeps its 's", () => {
    expect(said("Norway's US's")).toBe("Norways United States's");
  });
});

describe('the schema', () => {
  const bad = (file: unknown): boolean => !pronunciationsSchema.safeParse(file).success;
  it('rejects an entry that says nothing', () => expect(bad({ words: { x: {} } })).toBe(true));
  it('rejects ipa and phonemes together', () =>
    expect(bad({ words: { x: { ipa: 'a', phonemes: 'a' } } })).toBe(true));
  it('rejects an unknown field (a typo would otherwise be ignored)', () =>
    expect(bad({ words: { x: { phoneme: 'a' } } })).toBe(true));
  it('rejects a pattern that is not a regular expression', () =>
    expect(bad({ words: {}, patterns: [{ match: '(', say: 'x' }] })).toBe(true));
  it('accepts a list with only item fixes', () =>
    expect(bad({ items: { q1: { Nguyen: { say: 'win' } } } })).toBe(false));
  it('parsing throws the zod error on a bad file', () =>
    expect(() => parsePronunciations({ words: { x: {} } })).toThrow());
});

describe('the shipped lists', () => {
  it("the SDK's list parses, says why for every word, and uses only phonemes Kokoro knows", () => {
    const file = pronunciationsSchema.parse(globalList);
    for (const [word, entry] of Object.entries(file.words ?? {})) {
      expect(entry.why, word).toBeTruthy();
      expect(unknownPhonemes(entry.ipa ?? ''), word).toEqual([]);
      // A capitalised syllable in a respelling is spelled out by espeak ("bee-YON-say").
      if (entry.say) expect(/\p{Lu}{2}/u.test(entry.say), word).toBe(false);
    }
  });
  it("is a superset of Blanks' lexicon: pronounce.json parses unchanged", () => {
    const blanks: unknown = JSON.parse(
      readFileSync(join(REPO, 'games', 'blanks', 'content', 'pronounce.json'), 'utf8'),
    );
    const file = pronunciationsSchema.parse(blanks);
    const all = [
      ...Object.values(file.words ?? {}),
      ...Object.values(file.cards ?? {}).flatMap((c) => Object.values(c)),
    ];
    expect(all.length).toBeGreaterThan(200);
    for (const entry of all) expect(unknownPhonemes(entry.ipa ?? '')).toEqual([]);
    expect(() => parsePronunciations(blanks)).not.toThrow();
  });
  it('flags a phoneme Kokoro would drop', () => {
    expect(unknownPhonemes('kˈəʊvɪd')).toEqual([]);
    expect(unknownPhonemes('ʀɪǃʀ')).toEqual(['ʀ', 'ǃ']);
  });
});
