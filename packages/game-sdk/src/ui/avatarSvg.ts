// An avatar face as an SVG string (T-0595): the 3D boards paint a face to a texture, and a canvas can only draw an
// image. The art in avatarArt.tsx is JSX; this walks that tree (plain svg elements and fragments, no hooks) and writes
// the markup, so no React renderer is needed. The disc takes `color`; the face stays in its inks.
import { Fragment } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ART } from './avatarArt';

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

type Props = Record<string, unknown> & { children?: ReactNode };

function markup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(String(node));
  if (Array.isArray(node)) return node.map(markup).join('');
  const el = node as ReactElement<Props>;
  const { children, ...props } = el.props;
  if (el.type === Fragment) return markup(children);
  if (typeof el.type !== 'string') return '';
  const attrs = Object.entries(props)
    .map(([key, value]) => {
      if (key === 'className' || value === undefined || value === null) return '';
      if (key === 'style' && typeof value === 'object') {
        const css = Object.entries(value as Record<string, string | number>)
          .map(([k, v]) => `${kebab(k)}:${String(v)}`)
          .join(';');
        return ` style="${esc(css)}"`;
      }
      return ` ${kebab(key)}="${esc(String(value))}"`;
    })
    .join('');
  const inner = markup(children);
  return inner ? `<${el.type}${attrs}>${inner}</${el.type}>` : `<${el.type}${attrs}/>`;
}

/** The face as a self-contained 64 x 64 svg document, its disc in `color` (a CSS colour). Unknown faces are the ghost. */
export function avatarFaceSvg(face: string, color: string): string {
  const art = ART[face] ?? ART['ghost'];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256" color="${esc(color)}">` +
    `<circle cx="32" cy="32" r="31" fill="currentColor"/>${markup(art)}</svg>`
  );
}
