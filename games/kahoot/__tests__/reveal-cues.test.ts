// Exercise the real cue hooks with a held clock and persistent refs, without starting a browser.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LightningControllerView, LightningTvView } from '../server/views';
import { useStandingsCue, useVerdictCue } from '../client/useRevealCue';

const runtime = vi.hoisted(() => ({
  now: 10_000,
  ref: null as { current: unknown } | null,
  play: vi.fn(),
  buzz: vi.fn(),
}));
vi.mock('react', () => ({
  useRef: (initial: unknown) => (runtime.ref ??= { current: initial }),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock('@partybox/game-sdk/ui', () => ({
  useServerNow: (_interval: number, paused: boolean, heldAt?: number) =>
    paused ? (heldAt ?? runtime.now) : runtime.now,
  useSound: () => runtime.play,
  buzz: runtime.buzz,
}));

beforeEach(() => {
  runtime.now = 10_000;
  runtime.ref = null;
  vi.clearAllMocks();
});

const base = {
  phaseId: 'reveal',
  question: { id: 'q1' },
  round: { final: false },
  revealAt: 10_000,
  paused: false,
};
const television = (extra = {}): LightningTvView => ({ ...base, ...extra }) as LightningTvView;
const handset = (extra = {}): LightningControllerView =>
  ({
    ...base,
    me: { role: 'player' },
    outcome: { correct: true, delta: 950 },
    ...extra,
  }) as LightningControllerView;

describe('donor reveal cues', () => {
  it.each([
    ['correct', false, 300, 1],
    ['wrong', false, 300, 0],
    ['wrong', false, 300, null],
    ['correct', true, 1_200, 1],
    ['wrong', true, 1_200, 0],
    ['wrong', true, 1_200, null],
  ] as const)('%s waits for final=%s at %i ms with pick %s', (cue, final, beat, myPickIndex) => {
    const correct = cue === 'correct';
    const view = handset({
      round: { final },
      myPickIndex,
      outcome: { correct, delta: correct ? 950 : 0 },
    });
    useVerdictCue(view);
    runtime.now += beat - 1;
    useVerdictCue(view);
    expect(runtime.play).not.toHaveBeenCalled();
    expect(runtime.buzz).not.toHaveBeenCalled();
    runtime.now++;
    useVerdictCue(view);
    useVerdictCue(view);
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith(cue);
    expect(runtime.buzz).toHaveBeenCalledExactlyOnceWith(correct ? [30, 40, 30] : 120);
  });

  it.each([true, false])('spectators never get a personal verdict when correct=%s', (correct) => {
    const view = handset({ me: { role: 'spectator' }, outcome: { correct, delta: 0 } });
    useVerdictCue(view);
    runtime.now += 1_500;
    useVerdictCue(view);
    expect(runtime.play).not.toHaveBeenCalled();
    expect(runtime.buzz).not.toHaveBeenCalled();
  });

  it.each([
    [false, 300],
    [true, 1_200],
  ] as const)('pause holds the wrong verdict for final=%s until %i ms', (final, beat) => {
    const view = handset({ round: { final }, outcome: { correct: false, delta: 0 } });
    useVerdictCue(view);
    runtime.now += 60_000;
    useVerdictCue({ ...view, paused: true, clockHeldAt: 10_000 + beat - 1 });
    expect(runtime.play).not.toHaveBeenCalled();
    expect(runtime.buzz).not.toHaveBeenCalled();
    const resumed = { ...view, revealAt: runtime.now - beat + 1 };
    useVerdictCue(resumed);
    expect(runtime.play).not.toHaveBeenCalled();
    expect(runtime.buzz).not.toHaveBeenCalled();
    runtime.now++;
    useVerdictCue(resumed);
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('wrong');
    expect(runtime.buzz).toHaveBeenCalledExactlyOnceWith(120);
    runtime.now += 60_000;
    useVerdictCue({ ...resumed, revealAt: resumed.revealAt + 60_000 });
    expect(runtime.play).toHaveBeenCalledTimes(1);
    expect(runtime.buzz).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, 300],
    [true, 1_200],
  ] as const)('late mounts skip wrong verdicts for final=%s after %i ms', (final, beat) => {
    const view = handset({ round: { final }, outcome: { correct: false, delta: 0 } });
    runtime.now += beat;
    useVerdictCue(view);
    expect(runtime.play).not.toHaveBeenCalled();
    expect(runtime.buzz).not.toHaveBeenCalled();
    useVerdictCue({ ...view, phaseId: 'question' });
    const next = {
      ...view,
      question: { id: 'q2' },
      revealAt: runtime.now,
    } as LightningControllerView;
    useVerdictCue(next);
    runtime.now += beat;
    useVerdictCue(next);
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('wrong');
    expect(runtime.buzz).toHaveBeenCalledExactlyOnceWith(120);
  });

  it('legacy snapshots tally at 2300 ms, once, and the wager finale keeps its own cues', () => {
    useStandingsCue(television());
    runtime.now += 2_299;
    useStandingsCue(television());
    expect(runtime.play).not.toHaveBeenCalled();
    runtime.now++;
    useStandingsCue(television());
    useStandingsCue(television());
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('tally');
    runtime.ref = null;
    runtime.play.mockClear();
    runtime.now = 10_000;
    useStandingsCue(television({ round: { final: true } }));
    runtime.now += 3_000;
    useStandingsCue(television({ round: { final: true } }));
    expect(runtime.play).not.toHaveBeenCalled();
  });

  it('new snapshots tally at their reading-safe scoreboard beat rather than the legacy beat', () => {
    const view = television({ leaderboardAt: 18_000, nextAt: 18_000 });
    useStandingsCue(view);
    runtime.now = 12_300;
    useStandingsCue(view);
    runtime.now = 17_999;
    useStandingsCue(view);
    expect(runtime.play).not.toHaveBeenCalled();
    runtime.now = 18_000;
    useStandingsCue(view);
    useStandingsCue(view);
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('tally');
  });

  it('pause shifts a reading-safe scoreboard cue and cannot replay its tally', () => {
    const view = television({ leaderboardAt: 18_000, nextAt: 18_000 });
    useStandingsCue(view);
    runtime.now = 77_999;
    useStandingsCue({ ...view, paused: true, clockHeldAt: 17_999 });
    expect(runtime.play).not.toHaveBeenCalled();
    const resumed = { ...view, revealAt: 70_000, leaderboardAt: 78_000, nextAt: 78_000 };
    useStandingsCue(resumed);
    expect(runtime.play).not.toHaveBeenCalled();
    runtime.now = 78_000;
    useStandingsCue(resumed);
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('tally');
    runtime.now = 138_000;
    useStandingsCue({ ...resumed, revealAt: 130_000, leaderboardAt: 138_000, nextAt: 138_000 });
    expect(runtime.play).toHaveBeenCalledTimes(1);
  });

  it('the last classic chart has a Next beat without a scoreboard tally', () => {
    const view = television({
      quizMode: 'classic',
      round: { final: false, last: true },
      nextAt: 18_000,
    });
    useStandingsCue(view);
    runtime.now = 18_000;
    useStandingsCue(view);
    expect(runtime.play).not.toHaveBeenCalled();
  });

  it('pause holds an upcoming cue; resume preserves the beat and cannot replay it', () => {
    useStandingsCue(television());
    runtime.now += 60_000;
    useStandingsCue(television({ paused: true, clockHeldAt: 11_000 }));
    expect(runtime.play).not.toHaveBeenCalled();
    useStandingsCue(television({ revealAt: 69_000 }));
    expect(runtime.play).not.toHaveBeenCalled();
    runtime.now = 71_300;
    useStandingsCue(television({ revealAt: 69_000 }));
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('tally');
    runtime.now += 60_000;
    useStandingsCue(television({ revealAt: 129_000 }));
    expect(runtime.play).toHaveBeenCalledTimes(1);
  });

  it('a late mount skips spent cues, and a fresh question re-arms the next cue', () => {
    runtime.now += 3_000;
    useStandingsCue(television());
    expect(runtime.play).not.toHaveBeenCalled();
    useStandingsCue(television({ phaseId: 'question' }));
    useStandingsCue(television({ question: { id: 'q2' }, revealAt: 13_000 }));
    runtime.now += 2_300;
    useStandingsCue(television({ question: { id: 'q2' }, revealAt: 13_000 }));
    expect(runtime.play).toHaveBeenCalledExactlyOnceWith('tally');
    runtime.ref = null;
    useVerdictCue(handset());
    expect(runtime.buzz).not.toHaveBeenCalled();
  });
});
