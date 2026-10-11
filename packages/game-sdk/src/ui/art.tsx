// ADR-057: the shell and games share one art-style context, including phone overrides.
import { createContext, useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import type { ArtKind, ArtStyle, ArtTheme } from '@partybox/shared';

export type ArtSurface = 'tv' | 'phone';

const POP_FIRST: readonly ArtStyle[] = ['pop', 'gouache'];
const GOUACHE_FIRST: readonly ArtStyle[] = ['gouache', 'pop'];

/** The styles to try for one kind of art, the theme's own first. */
export function artStyles(
  theme: ArtTheme,
  kind: ArtKind,
  surface: ArtSurface,
): readonly ArtStyle[] {
  const first: ArtStyle =
    theme !== 'mix' ? theme : surface === 'phone' || kind === 'icon' ? 'pop' : 'gouache';
  return first === 'pop' ? POP_FIRST : GOUACHE_FIRST;
}

/** One game's drawn icon as an <img>'s sources (the shell's catalog; T-0676). */
export interface DrawnIcon {
  src: string;
  srcSet?: string;
  sizes?: string;
}

/** The shell's lookup: a game's drawn icon in the first of `order` that has one, else null. */
export type DrawnIconLookup = (
  id: string,
  order: readonly ArtStyle[],
  surface: ArtSurface,
) => DrawnIcon | null;

const ArtContext = createContext<{
  theme: ArtTheme;
  surface: ArtSurface;
  icons: DrawnIconLookup | null;
}>({
  theme: 'mix',
  surface: 'phone',
  icons: null,
});

/** The shell's root says which theme this device shows, whether it is the TV or a phone, and which drawn icon each game has. */
export function ArtThemeProvider({
  theme,
  surface,
  icons = null,
  children,
}: {
  theme: ArtTheme;
  surface: ArtSurface;
  icons?: DrawnIconLookup | null;
  children: ReactNode;
}): JSX.Element {
  return <ArtContext.Provider value={{ theme, surface, icons }}>{children}</ArtContext.Provider>;
}

/** Whether this device is the TV or a phone (ADR-058: which icon renditions it loads). */
export function useArtSurface(): ArtSurface {
  return useContext(ArtContext).surface;
}

/** The styles to try, in order, for `kind` on this device. */
export function useArtStyles(kind: ArtKind): readonly ArtStyle[] {
  const { theme, surface } = useContext(ArtContext);
  return artStyles(theme, kind, surface);
}

/** The game's drawn icon on this device (its catalog art in the device's style), or null: the caller draws its own fallback. */
export function useDrawnIcon(id: string): DrawnIcon | null {
  const { theme, surface, icons } = useContext(ArtContext);
  return icons ? icons(id, artStyles(theme, 'icon', surface), surface) : null;
}
