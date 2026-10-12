// Node 24 synchronous CSS-module capture for the SSR verification tool.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
globalThis.__partyboxCapturedCss ??= [];

registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !new URL(url).pathname.endsWith('.css')) {
      return nextLoad(url, context);
    }

    const filename = fileURLToPath(url);
    const localPath = relative(repository, filename).replaceAll('\\', '/');
    const name = basename(filename, '.module.css').replace(/[^a-zA-Z0-9_]/g, '_');
    const hash = createHash('sha256').update(localPath).digest('hex').slice(0, 8);
    const prefix = `pb_${name}_${hash}_`;
    const classes = {};
    const globals = [];
    const original = readFileSync(filename, 'utf8');
    let css = original;

    if (filename.endsWith('.module.css')) {
      // Preserve global selectors before qualifying the module's own selectors.
      css = css.replace(/:global\(([^()]*)\)/g, (_match, selector) => {
        globals.push(selector);
        return `__PB_GLOBAL_${globals.length - 1}__`;
      });
      // Only rewrite selector preludes: decimal values and quoted text stay intact.
      css = css.replace(/(^|[{}])([^{}]+)(?=\{)/g, (_match, boundary, prelude) => {
        const selector = prelude.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (_part, key) => {
          classes[key] = `${prefix}${key}`;
          return `.${classes[key]}`;
        });
        return `${boundary}${selector}`;
      });
      css = css.replace(/__PB_GLOBAL_(\d+)__/g, (_match, index) => globals[Number(index)]);
      // CSS Modules' animation-name escape becomes ordinary CSS in standalone HTML.
      css = css.replace(/\bglobal\(([^()]*)\)/g, '$1');
    }

    if (!globalThis.__partyboxCapturedCss.some((entry) => entry.url === url)) {
      globalThis.__partyboxCapturedCss.push({ url, localPath, css });
    }
    return {
      format: 'module',
      source: `export default ${JSON.stringify(classes)};`,
      shortCircuit: true,
    };
  },
});
