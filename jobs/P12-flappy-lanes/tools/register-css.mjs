// Node 24 loader for static React previews; retains the actual CSS Modules selectors and styles.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

globalThis.__flappyCss = [];
globalThis.React = React;
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.css')) return nextLoad(url, context);
    let css = readFileSync(fileURLToPath(url), 'utf8');
    const mapping = {};
    if (url.endsWith('.module.css')) {
      const prefix = basename(fileURLToPath(url)).replace(/\W/g, '_');
      const globals = [];
      css = css.replace(/:global\(([^)]+)\)/g, (_, selector) => {
        globals.push(selector);
        return `__GLOBAL_${globals.length - 1}__`;
      });
      css = css.replace(/\.([A-Za-z_][\w-]*)/g, (_, name) => {
        mapping[name] = `${prefix}_${name}`;
        return `.${mapping[name]}`;
      });
      css = css.replace(/__GLOBAL_(\d+)__/g, (_, i) => globals[Number(i)]);
    }
    globalThis.__flappyCss.push(css);
    return {
      format: 'module',
      source: `export default ${JSON.stringify(mapping)};`,
      shortCircuit: true,
    };
  },
});
