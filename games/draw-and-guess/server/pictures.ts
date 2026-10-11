// Original pictograms from all three word decks; no copied artwork.
import type { Stroke } from './types';
import { easyPictures } from './pictures/easy';
import { mediumPictures } from './pictures/medium';
import { hardPictures } from './pictures/hard';

export const BOT_ART: Readonly<Record<string, Stroke[]>> = {
  ...easyPictures,
  ...mediumPictures,
  ...hardPictures,
};
