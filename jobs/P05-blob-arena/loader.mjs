// Use the installed TypeScript compiler for portable, dependency-free job tools.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@partybox/game-sdk' || specifier.startsWith('@partybox/game-sdk/')) {
      const suffix = specifier.slice('@partybox/game-sdk'.length);
      return {
        url: new URL(
          `../../packages/game-sdk/src/${suffix ? suffix.slice(1) : 'index'}.ts`,
          import.meta.url,
        ).href,
        shortCircuit: true,
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && context.parentURL) {
        const target = new URL(specifier, context.parentURL);
        for (const suffix of ['.ts', '.tsx', '/index.ts']) {
          const url = new URL(target.href + suffix);
          if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
      const names = [
        ...readFileSync(fileURLToPath(url), 'utf8').matchAll(/\.([a-zA-Z][\w-]*)/g),
      ].map((m) => m[1]);
      return {
        format: 'module',
        source: `export default ${JSON.stringify(Object.fromEntries(names.map((n) => [n, n])))};`,
        shortCircuit: true,
      };
    }
    if (/\.tsx?$/.test(url)) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          verbatimModuleSyntax: true,
        },
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
