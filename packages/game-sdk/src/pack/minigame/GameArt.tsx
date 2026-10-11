// T-0676 (owner rule 10-07: no emoji as art): a game's icon on the minigame frame is its drawn art on this
// device (the catalog's art in the device's style, through the shell's ArtThemeProvider), else the drawn
// badge. A picture that fails to load falls back to the badge too. The manifest's emoji is never drawn.
import { useState } from 'react';
import type { JSX } from 'react';
import { useDrawnIcon } from '../../ui/art';
import { GameBadge } from './GameBadge';

export interface GameArtProps {
  gameId: string;
  name: string;
  /** Edge in CSS length; the art and the badge are both square. */
  size?: string;
}

export function GameArt({ gameId, name, size = '1em' }: GameArtProps): JSX.Element {
  const drawn = useDrawnIcon(gameId);
  const [failed, setFailed] = useState<string | null>(null);
  if (!drawn || failed === drawn.src) return <GameBadge gameId={gameId} name={name} size={size} />;
  return (
    <img
      src={drawn.src}
      {...(drawn.srcSet ? { srcSet: drawn.srcSet, sizes: drawn.sizes } : {})}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      onError={() => setFailed(drawn.src)}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flex: 'none',
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
}
