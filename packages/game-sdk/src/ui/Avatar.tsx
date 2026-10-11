// The 16 built-in avatars as inline SVG (no image files, ADR-012). Each is a coloured disc with a
// simple face so it reads at 40 px on a phone and 72 px on a TV. Colour = index % 8 (design system).
import { createContext, useContext, useMemo } from 'react';
import type { JSX, ReactNode } from 'react';
import { ART, INK, LIGHT, blinkDelay } from './avatarArt';
import { AVATAR_IDS, avatarFace, avatarTint } from '@partybox/shared';
import { avatarName } from '../controller/avatarNames';
import { STRINGS } from '../controller/strings';
import { useT } from './lang';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** A face id — or `photo:<playerId>` (I-031): the picture comes from `AvatarPhotos`. */
  avatarId: string;
  /** A photo avatar to show instead of the face (a JPEG data URL — the join form's preview). */
  photo?: string;
  /** px, or any CSS length (`'var(--pb-chip-size)'`, a calc). A caller's CSS on the svg wins. */
  size?: number | string;
  className?: string;
  /** Rendered dimmer (disconnected / spectator). */
  dim?: boolean;
}

/** The room's photo avatars by player id (I-031, the owner: "upload your own photo"). The shell
 *  provides it from the room snapshot; a `photo:<id>` avatar id anywhere resolves through it. */
const PhotoContext = createContext<ReadonlyMap<string, string>>(new Map());
const PHOTO_PREFIX = 'photo:';

export function AvatarPhotos({
  players,
  children,
}: {
  players?: readonly { id: string; photo?: string }[];
  children: ReactNode;
}): JSX.Element {
  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players ?? []) if (p.photo) m.set(p.id, p.photo);
    return m;
  }, [players]);
  return <PhotoContext.Provider value={map}>{children}</PhotoContext.Provider>;
}

const ROBOT_SKINS = 6;
export function robotSkin(avatarId: string): number | null {
  if (!avatarId.startsWith('robot:')) return null;
  const n = Number(avatarId.slice(6));
  return Number.isFinite(n) ? ((n % ROBOT_SKINS) + ROBOT_SKINS) % ROBOT_SKINS : 0;
}
function robotArt(skin: number): JSX.Element {
  const eyes =
    skin % 3 === 0 ? (
      <>
        <rect x={22} y={28} width={7} height={7} fill={INK} />
        <rect x={35} y={28} width={7} height={7} fill={INK} />
      </>
    ) : skin % 3 === 1 ? (
      <>
        <circle cx={25.5} cy={31.5} r={3.5} fill={INK} />
        <circle cx={38.5} cy={31.5} r={3.5} fill={INK} />
      </>
    ) : (
      <rect x={21} y={28} width={22} height={6} rx={3} fill={INK} />
    );
  return (
    <>
      <rect x={16} y={20} width={32} height={28} rx={skin >= 3 ? 10 : 5} fill={LIGHT} />
      {eyes}
      <rect x={24} y={40} width={16} height={3} fill={INK} />
      <path d="M32 20 v-8" stroke={INK} strokeWidth={3} />
      <circle cx={32} cy={10} r={3} fill={INK} />
      {skin % 2 === 1 ? (
        <>
          <path d="M22 20 v-6" stroke={INK} strokeWidth={2} />
          <circle cx={22} cy={12} r={2} fill={INK} />
        </>
      ) : null}
    </>
  );
}

export function avatarColorVar(avatarId: string): string {
  // I-086 A: `fox#3` — the colour the player picked, not the face's slot.
  const tint = avatarTint(avatarId);
  if (tint !== null) return `var(--pb-player-${(tint % 8) + 1})`;
  // I-043 A: a bot's skin picks its colour slot.
  const skin = robotSkin(avatarId);
  if (skin !== null) return `var(--pb-player-${(skin % 8) + 1})`;
  // A photo player has no face colour: a stable one from the id (I-031).
  const index = avatarId.startsWith(PHOTO_PREFIX)
    ? [...avatarId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 8, 0)
    : Math.max(0, (AVATAR_IDS as readonly string[]).indexOf(avatarId));
  return `var(--pb-player-${(index % 8) + 1})`;
}

export function Avatar({
  avatarId,
  photo,
  size = 'var(--pb-chip-size)',
  className,
  dim,
}: AvatarProps): JSX.Element {
  const photos = useContext(PhotoContext);
  // The label reads in the device's language ("avatar de zorro"); the id stays the face's key.
  const L = useT(STRINGS);
  const src =
    photo ??
    (avatarId.startsWith(PHOTO_PREFIX)
      ? photos.get(avatarId.slice(PHOTO_PREFIX.length))
      : undefined);
  if (src)
    return (
      <img
        src={src}
        alt=""
        role="img"
        aria-label={L('photo avatar')}
        width={typeof size === 'number' ? size : undefined}
        height={typeof size === 'number' ? size : undefined}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          opacity: dim ? 0.45 : 1,
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  const skin = robotSkin(avatarId);
  const art = skin !== null ? robotArt(skin) : (ART[avatarFace(avatarId)] ?? ART['ghost']);
  return (
    <svg
      viewBox="0 0 64 64"
      // A CSS size (a var, a calc) is not a valid attribute: it goes through the stylesheet.
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      className={className ? `${styles.avatar} ${className}` : styles.avatar}
      role="img"
      aria-label={L('avatar {name}', { name: avatarName(avatarId, L) })}
      style={{
        ['--pb-avatar-size' as string]: typeof size === 'number' ? `${size}px` : size,
        color: avatarColorVar(avatarId),
        opacity: dim ? 0.45 : 1,
        flexShrink: 0,
        ['--pb-blink-delay' as string]: blinkDelay(avatarId),
        ['--pb-blink-name' as string]:
          [...avatarId].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 1
            ? 'pb-blink-twice'
            : 'pb-blink', // I-087 B
      }}
      data-asleep={dim ? '' : undefined} // I-087 C: a dropped player sleeps
    >
      <circle cx={32} cy={32} r={31} fill="currentColor" />
      {art}
    </svg>
  );
}
