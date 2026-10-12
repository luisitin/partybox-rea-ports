// Generation is explicit; CI consumes committed evidence and fixtures without changing them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { game } from '../server/index';
import { simulate } from './run';

it.skipIf(process.env.PB_WRITE_EVIDENCE !== '1')(
  'writes one eight-seat match with all phase fixtures',
  () => {
    const run = simulate(8, 42);
    const path = resolve(import.meta.dirname, '../fixtures');
    mkdirSync(path, { recursive: true });
    for (const phase of game.phases) expect(run.fixtures[phase]).toBeDefined();
    expect(run.fixtures['score-last']).toBeDefined();
    for (const [name, fixture] of Object.entries(run.fixtures))
      writeFileSync(resolve(path, `${name}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  },
);
