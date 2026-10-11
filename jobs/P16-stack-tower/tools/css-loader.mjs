// Node-only SSR hook: preserve each module's local class names for self-contained captures.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename } from 'node:path';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
      const source = readFileSync(new URL(url), 'utf8');
      const names = [...source.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]);
      const prefix = basename(new URL(url).pathname).replace(/\W/g, '_');
      const map = Object.fromEntries(names.map((name) => [name, `${prefix}_${name}`]));
      const scoped = source
        .replace(/\.([A-Za-z_][\w-]*)/g, (_full, name) => `.${map[name]}`)
        .replace(/:global\(([^)]+)\)/g, '$1')
        .replace(/global\(([^)]+)\)/g, '$1');
      return {
        format: 'module',
        shortCircuit: true,
        source: `globalThis.__PB_CAPTURE_CSS = (globalThis.__PB_CAPTURE_CSS ?? '') + ${JSON.stringify(scoped)}; export default ${JSON.stringify(map)};`,
      };
    }
    return nextLoad(url, context);
  },
});
