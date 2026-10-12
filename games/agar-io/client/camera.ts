// Presentation only: this camera projects received cells and never advances physics.
import { radius } from '../server/geometry';
import type { Cell } from '../server/types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

// May 1, 2015 official-client archive (Tombez pin 4e25418ae81043f391557422a5ee19f3f0c2e588).
// It expresses mass as radius² / 100. Our arena uses
// radius = sqrt(mass) × .55, so convert its camera units without copying code.
export const CAMERA_UNITS = 10 / 0.55;

export function playerCamera(
  cells: readonly Cell[],
  owner: string | undefined,
  viewport: { width: number; height: number },
): Camera | null {
  const owned = cells.filter((cell) => cell.owner === owner && owner !== undefined);
  if (!owned.length) return null;
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const sumRadii = owned.reduce((sum, cell) => sum + radius(cell.mass), 0) * CAMERA_UNITS;
  const zoom =
    Math.min(1, 64 / Math.max(1, sumRadii)) ** 0.25 *
    Math.max(height / 965, width / 1920) *
    CAMERA_UNITS;
  return {
    x: owned.reduce((sum, cell) => sum + cell.x, 0) / owned.length,
    y: owned.reduce((sum, cell) => sum + cell.y, 0) / owned.length,
    zoom,
    width,
    height,
  };
}

export function cameraTransform(camera: Camera): string {
  return `matrix(${camera.zoom}, 0, 0, ${camera.zoom}, ${camera.width / 2 - camera.x * camera.zoom}, ${camera.height / 2 - camera.y * camera.zoom})`;
}

export function cellNameSize(cellRadius: number): number {
  return (Math.max(Math.floor(cellRadius * CAMERA_UNITS * 0.3), 24) - 2) / CAMERA_UNITS;
}

// Preserve a long name's final identifying character. SVG titles and standings
// retain the full name; the caption stays centred on its physical cell.
export function cellName(name: string, cellRadius: number): string {
  const characters = Array.from(name);
  const limit = Math.max(3, Math.floor((cellRadius * 1.9) / (cellNameSize(cellRadius) * 0.75)));
  return characters.length <= limit
    ? name
    : `${characters.slice(0, limit - 2).join('')}…${characters.at(-1) ?? ''}`;
}
