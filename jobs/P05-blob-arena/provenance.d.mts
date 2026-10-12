export const root: string;
export const gamePath: string;
export function digest(bytes: Uint8Array | string): string;
export function files(directory: string): string[];
export function hashes(paths: string[]): Record<string, string>;
export function gameSources(): Record<string, string>;
export function runtimeSources(): Record<string, string>;
export function behaviorSources(): Record<string, string>;
export function dependencySources(): Record<string, string>;
export function snapshot(testFiles: string[], full?: boolean): Record<string, string>;
export function sameSources(before: Record<string, string>, after: Record<string, string>): boolean;
export function sourceChanges(
  before: Record<string, string>,
  after: Record<string, string>,
): {
  path: string;
  before: string | null;
  after: string | null;
}[];
