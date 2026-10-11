import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { botInput } from '../server/bot';
import { RESTART_MS } from '../server/types';
import { DROP_MS, inputSchema, tolerance } from '../server/world';
import { kit, replaceTower, T0, timeAtOffset, towerOf } from './helpers';

const willing = () => ({ ...createRng(16), float: () => 0.5 });
const hesitant = () => ({ ...createRng(16), float: () => 0.1 });

describe('bots watch alignment', () => {
  it('sharp waits for a perfect, normal accepts a six-unit error, and easy accepts thirteen', () => {
    const initial = kit.start();
    const at = (offset: number) => ({
      ...initial,
      checked: timeAtOffset(towerOf(initial), offset, initial.course),
    });
    const perfect = at(tolerance(towerOf(initial)));
    const input = { type: 'drop', attempt: 0, level: 0 };
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      expect(botInput(perfect, 'a', willing(), skill)).toEqual(input);
    expect(botInput(at(4), 'a', willing(), 'sharp')).toBeNull();
    expect(botInput(at(4), 'a', willing(), 'normal')).toEqual(input);
    expect(botInput(at(9), 'a', willing(), 'normal')).toBeNull();
    expect(botInput(at(9), 'a', willing(), 'easy')).toEqual(input);
    expect(botInput(at(13), 'a', willing(), 'easy')).toEqual(input);
    expect(botInput(at(13.001), 'a', willing(), 'easy')).toBeNull();
    expect(botInput(at(6.001), 'a', willing(), 'normal')).toBeNull();
    expect(botInput(at(0), 'a', hesitant(), 'easy')).toBeNull();
  });

  it('waits for the cooldown and stops in paused, reveal, done, disconnected and spectator states', () => {
    const initial = kit.start();
    expect(botInput({ ...initial, checked: T0 + DROP_MS - 1 }, 'a', willing(), 'sharp')).toBeNull();
    const aligned = { ...initial, checked: timeAtOffset(towerOf(initial), 0, initial.course) };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      expect(
        botInput(kit.vip(aligned, 'pause', aligned.checked), 'a', willing(), skill),
      ).toBeNull();
      expect(botInput(kit.vip(aligned, 'skip', aligned.checked), 'a', willing(), skill)).toBeNull();
      expect(botInput(kit.vip(aligned, 'end', aligned.checked), 'a', willing(), skill)).toBeNull();
      expect(botInput(kit.player(aligned, 'a', false), 'a', willing(), skill)).toBeNull();
      expect(botInput(aligned, 'ghost', willing(), skill)).toBeNull();
      expect(botInput(aligned, '__proto__', willing(), skill)).toBeNull();
    }
  });

  it('retries a crash at the first eligible observation with the current attempt', () => {
    const initial = kit.start();
    const crashed = replaceTower(initial, {
      ...towerOf(initial),
      attempt: 7,
      crashedAt: T0 + 1000,
    });
    expect(
      botInput({ ...crashed, checked: T0 + 1000 + RESTART_MS - 1 }, 'a', willing()),
    ).toBeNull();
    expect(botInput({ ...crashed, checked: T0 + 1000 + RESTART_MS }, 'a', willing())).toEqual({
      type: 'restart',
      attempt: 7,
    });
  });

  it.each(['easy', 'normal', 'sharp'] as BotSkill[])(
    'seeded %s decisions replay and remain schema-valid',
    (skill) => {
      const state = kit.start();
      const first = createRng(160016);
      const replay = createRng(160016);
      for (let offset = -14; offset <= 14; offset += 0.5) {
        const observed = { ...state, checked: timeAtOffset(towerOf(state), offset, state.course) };
        const input = botInput(observed, 'a', first, skill);
        expect(botInput(observed, 'a', replay, skill)).toEqual(input);
        if (input !== null) expect(inputSchema.safeParse(input).success).toBe(true);
      }
      expect(first.state()).toEqual(replay.state());
    },
  );
});
