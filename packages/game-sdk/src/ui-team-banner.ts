// `@partybox/game-sdk/ui/team-banner` — two teams, shape + name + colour (P00 §6, owned by Tune
// In; Spy Grid uses it too). Its own subpath (audit #23), so only the games that use it load it.
export { TeamBanner } from './pack/team-banner/TeamBanner';
export type { BannerTeam, TeamBannerProps } from './pack/team-banner/TeamBanner';
