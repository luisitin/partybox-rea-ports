// The faces' names (AVATAR_IDS) for screen readers, in the device's language. A helper, not a
// component: it takes the caller's translator, so each name stays a literal `L('…')` key in the
// SDK's phone table (strings.ts). A bot's `robot:<n>` skin keeps its number (English reads the id as
// it always did); an unknown id reads as itself.
import type { Translator } from '../ui/lang';

export function avatarName(raw: string, L: Translator): string {
  // I-086: `fox#3` is the fox in colour 3 — the name is the face's.
  const id = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
  // a bot's skin number is art, not a name: "robot:1" read as "robot colon one" (T-0089)
  if (id.startsWith('robot:')) return L('robot');
  switch (id) {
    case 'fox':
      return L('fox');
    case 'owl':
      return L('owl');
    case 'frog':
      return L('frog');
    case 'cat':
      return L('cat');
    case 'panda':
      return L('panda');
    case 'koala':
      return L('koala');
    case 'penguin':
      return L('penguin');
    case 'octopus':
      return L('octopus');
    case 'lion':
      return L('lion');
    case 'bee':
      return L('bee');
    case 'whale':
      return L('whale');
    case 'sloth':
      return L('sloth');
    case 'robot':
      return L('robot');
    case 'ghost':
      return L('ghost');
    case 'dino':
      return L('dino');
    case 'unicorn':
      return L('unicorn');
    case 'pumpkin':
      return L('pumpkin');
    case 'snowflake':
      return L('snowflake');
    case 'heart':
      return L('heart');
    default:
      return id;
  }
}
