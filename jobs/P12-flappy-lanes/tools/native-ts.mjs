// Native Node 24 type stripping, with the SDK's extensionless relative imports resolved as TS.
// This avoids the transpiler subprocess on the heavily shared Windows desktop.
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@partybox/game-sdk') return nextResolve(new URL('../../../packages/game-sdk/src/index.ts', import.meta.url).href, context);
    if (specifier === '@partybox/shared') return nextResolve(new URL('../../../packages/shared/src/index.ts', import.meta.url).href, context);
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
