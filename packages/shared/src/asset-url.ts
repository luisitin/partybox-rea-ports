// The same pure resolver is compiled for films and used by the SDK. No runtime dependencies.
export interface AssetUrlFile {
  readonly file: string;
  readonly hash: string;
}
export type AssetUrlMap = Readonly<Record<string, Readonly<Record<string, AssetUrlFile>>>>;

export function resolveAssetUrl(
  files: AssetUrlMap,
  id: string,
  form: string,
  base = '/lib/',
): string {
  if (!Object.hasOwn(files, id)) throw new Error('Unknown asset: ' + id);
  const forms = files[id]!;
  if (!Object.hasOwn(forms, form)) throw new Error('Missing asset form: ' + id + ':' + form);
  const entry = forms[form]!;
  return base.replace(/\/?$/, '/') + id + '/' + entry.file + '?v=' + entry.hash;
}
