// `@partybox/game-sdk/ui/secret-card` — its own subpath (audit #23) so the component lands in the
// chunk of the game that uses it, never in the app's entry.
export {
  SecretCard,
  getSecretCardMode,
  setSecretCardMode,
  useSecretCardMode,
} from './pack/secret-card/SecretCard';
export type { SecretCardMode, SecretCardProps } from './pack/secret-card/SecretCard';
