// ADR-087: the manifest's `minigame` block and the context `init` gets (split from contract.ts for size).
import { z } from 'zod';

/**
 * ADR-087: a game that can run as a minigame inside a board game (Party World). `ffa` = everyone
 * for themselves, `2v2` / `1v3` = two teams (the board's colours decide), `duel` = two players.
 */
export const MINIGAME_MODES = ['ffa', '2v2', '1v3', 'duel'] as const;
export type MinigameMode = (typeof MINIGAME_MODES)[number];
/** F12: a Jamboree category beyond the round/VS pool. Each stays out of the ordinary pools; a host asks by category. */
export const MINIGAME_CATEGORIES = [
  'boss',
  'duel',
  'coin',
  'showdown',
  'survivathon',
  'mouse',
  'rhythm',
  'bowser-live',
  'kaboom-squad',
] as const;
export type MinigameCategory = (typeof MINIGAME_CATEGORIES)[number];
/** D-091: the Jamboree tab's subgroups: a Jamboree category, or `board` (no longer produced: ADR-099
 *  puts Party World and its modes on the Modes tab). A minigame with no category is `other`:
 *  see PICKER_KINDS. */
export const MINIGAME_KINDS = ['board', ...MINIGAME_CATEGORIES] as const;
export type MinigameKind = (typeof MINIGAME_KINDS)[number];
/** T-0699: the picker's subgroups: `MINIGAME_KINDS`, plus `other` for a Jamboree-tab game with no
 *  `minigame.category`. Picker only: no manifest names `other`, so no pool changes. */
export const PICKER_KINDS = [...MINIGAME_KINDS, 'other'] as const;
export type PickerKind = (typeof PICKER_KINDS)[number];
/** ADR-087: the manifest's `minigame` block. */
export const minigameSpecSchema = z
  .object({
    /** The modes the game plays; `ffa` needs 2+ players, `duel` 2, `2v2` and `1v3` 4. */
    modes: z.array(z.enum(MINIGAME_MODES)).min(1).max(MINIGAME_MODES.length),
    /** What the play takes with `settings` below, in seconds (the contract test checks it, with slack). */
    seconds: z.number().int().min(20).max(120),
    /** Settings in minigame mode: the game's defaults, then these. The room's own settings never apply. */
    settings: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])).optional(),
    /** The instruction screen's Controls list: 1-4 short lines, "Tap · Lock an answer". */
    controls: z.array(z.string().min(1).max(60)).min(1).max(4),
    /** Toad's two lines on the instruction screen. */
    howTo: z.tuple([z.string().min(1).max(90), z.string().min(1).max(90)]),
    /** The instruction screen runs a live demo ("Practice Time!"): the game must be fine with
     *  players tapping before the real start. Absent = a still how-to. */
    practice: z.boolean().optional(),
    /** `sum`: in `2v2` / `1v3` the game plays free-for-all (it knows no sides) and a side's score is
     *  its members' `results().scores` added (`1v3`: the lone player's against the other three's
     *  average); more points wins, equal is a draw. Absent: the game plays its own teams. */
    teamScore: z.literal('sum').optional(),
    /** `boss`: a Jamboree boss fight (T-0597); `duel`: a one-on-one (T-0600); `coin`: coins are the score;
     *  `showdown`: the final-turn event; `survivathon`: last one standing (T-0603); `rhythm`: tap in time with the beat, a Rhythm Kitchen game (T-0636);
     *  `bowser-live`: Jamboree TV's camera and microphone games on the phone (T-0641). All stay out of the
     *  ordinary round and VS pools; a host asks for them by category (`minigameGames(…, 'boss')`).
     *  Absent: an ordinary minigame. */
    category: z.enum(MINIGAME_CATEGORIES).optional(),
    /** ADR-091: made for the board only (Jamboree's own minigames and bosses): it appears only under the picker's
     *  Jamboree tab. Absent: a full party game that stays on the main list as well. */
    jamboreeOnly: z.literal(true).optional(),
  })
  .strict();
export type MinigameSpec = z.infer<typeof minigameSpecSchema>;
/** ADR-087: what `init` is told when the game runs as a minigame (`InitContext.minigame`). */
export interface MinigameContext {
  mode: MinigameMode;
  /** Member ids per team, the lone player first in `1v3`; `[]` in `ffa`; two singletons in `duel`.
   *  A team game ends with `winnerIds` inside one team (or `outcome: teams`); the wrapper reads it. */
  teams: string[][];
  /** The play length the wrapper expects (`manifest.minigame.seconds`). */
  seconds: number;
  /** Showdown (T-0603): the board encounter's initiator; the game starts them with its head-start. */
  lead?: string;
}
