// What a Kaboom Squad game brings to the kit's screens: its look and its words, already translated by the game's own `useT`
// (so the Spanish lives in the game's strings.ts). Pictures are drawn glyphs (`Art`, `INK`), never emoji.
import type { ComponentType } from 'react';
import type { KaboomControllerView, KaboomTvView } from '../../kaboom/game';

export interface KaboomSkin {
  title: string;
  /** One line under the title on the TV. */
  rule: string;
  /** The game's colour, 0-360. */
  hue: number;
  /** What the team's score counts, translated ("boxes", "points", "Chomps", "seconds"). */
  unit: string;
  /** Print "Team score" with the bar (beside it on the TV, over it on a phone), so its number is named (T-0902). */
  scoreCaption?: boolean;
}

/** What a game's TV picture gets: the public world and the round clock. */
export interface SceneProps<W> {
  view: KaboomTvView<W>;
  world: W;
  /** Ms since the round began, by the server's clock (animate with it; the world itself only changes on a step). */
  t: number;
  /** The seats' names and hues in seat order. */
  players: readonly { id: string; name: string; hue: number; connected: boolean }[];
  /** True once the round is over: the picture shows what was built. */
  done: boolean;
}

/** What a game's phone controls get. `act` sends `{type: 'act', a, b}`. */
export interface ControlsProps<W> {
  view: KaboomControllerView<W>;
  world: W;
  seat: number;
  t: number;
  act: (a: number, b?: number) => void;
}

export type SceneComponent<W> = ComponentType<SceneProps<W>>;
export type ControlsComponent<W> = ComponentType<ControlsProps<W>>;
