/** ADR-052: co-op (everyone wins or nobody does) or teams (`winner` null = a draw). */
export type GameOutcome =
  | { kind: 'coop'; won: boolean }
  | {
      kind: 'teams';
      winner: string | null;
      /** `mark` (▲ / ●) goes with the name, so a team never rests on colour alone. `color` is the
       *  game's own colour for the team (a CSS colour or token, e.g. 'var(--pb-info)'): the shell
       *  heads the team's group and tints the winner's headline with it (ADR-052). */
      teams: { id: string; name: string; mark?: string; color?: string; members: string[] }[];
    };
