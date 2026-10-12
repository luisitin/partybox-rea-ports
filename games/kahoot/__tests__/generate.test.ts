// Opt-in reproducible fixtures, all from one fully played eight-seat match.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { currentQuestion } from '../server/content';
import type { State } from '../server/types';

it.skipIf(process.env.PB_WRITE_EVIDENCE !== '1')(
  'generates every phase fixture from a played match',
  () => {
    const kit = testKit(game, { players: testPlayers(8), settings: { rounds: 5 }, seed: 19 });
    mkdirSync('games/kahoot/fixtures', { recursive: true });
    let s = kit.start();
    const saved = new Set<string>();
    const save = (state: State, name = state.phase.id): void => {
      if (saved.has(name)) return;
      writeFileSync(`games/kahoot/fixtures/${name}.json`, JSON.stringify(state, null, 2) + '\n');
      saved.add(name);
    };
    for (let step = 0; step < 60 && s.phase.id !== 'done'; step++) {
      save(s);
      if (s.phase.id === 'question') {
        for (let i = 1; i <= 8 && s.phase.id === 'question'; i++) {
          const q = currentQuestion(s);
          s = kit.input(
            s,
            `p${i}`,
            { type: 'answer', round: s.round, choice: i <= 3 ? q.correct : (i + s.round) % 4 },
            s.openedAt + 300 + i * 800,
          );
        }
      } else {
        if (s.phase.id === 'reveal' && s.round === s.deck.length) save(s, 'reveal-last');
        if (s.phase.id === 'podium') save(s, `podium-${s.podiumStep}`);
        s = kit.timer(s);
      }
    }
    save(s);
    expect(s.phase.id).toBe('done');
    expect([...saved]).toEqual(expect.arrayContaining([...game.phases]));
  },
);
