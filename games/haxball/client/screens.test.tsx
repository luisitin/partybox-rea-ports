import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneOnlyProvider, ServerClockProvider } from '@partybox/game-sdk/ui';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { enterGoal } from '../server/phases/goal';
import type { State } from '../server/types';
import { Controller } from './Controller';
import { Tv } from './Tv';
import { clockText, goalCredit, jersey, matchHeadline, shortName } from './match';

const kit = testKit(game, { players: testPlayers(8), t0: 1700000000000 });
function renderPhone(state: State, id = 'p1', phoneOnly = false): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <PhoneOnlyProvider value={phoneOnly}>
        <Controller
          view={{ ...game.controllerView(state, id), vip: null }}
          me={state.players[id] ?? { id, name: 'Spectator', avatarId: 'fox' }}
          send={() => {
            throw new Error('Static rendering must not send controls');
          }}
        />
      </PhoneOnlyProvider>
    </ServerClockProvider>,
  );
}
function renderTv(state: State): string {
  return renderToStaticMarkup(
    <ServerClockProvider offsetMs={state.clock - Date.now()}>
      <Tv view={{ ...game.tvView(state), vip: null }} />
    </ServerClockProvider>,
  );
}

describe('Haxball actual phone and TV screens', () => {
  it('shows each uniquely numbered jersey on the original public SVG pitch and rosters', () => {
    const state = kit.start({ seed: 24 });
    const html = renderTv(state);
    expect(html).toContain('data-haxball-pitch="true"');
    expect(html).toContain('role="timer"');
    expect(html).toContain('Half 1 / 2');
    expect(html).toContain('Get behind the ball · Kick sends it away from you · release to rearm');
    for (const disc of state.discs)
      expect(html).toContain(`data-jersey="${jersey(disc.team, disc.number)}"`);
    expect(html).not.toMatch(/acceptedSeq|kickArmed|phaseAt=|<button/);
  });

  it('gives a player a team/jersey identity, all eight movement cells and a separate held kick', () => {
    const state = kit.start();
    const view = game.controllerView(state, 'p1');
    const html = renderPhone(state);
    expect(html).toContain(`${jersey(view.team!, view.number!)} · you`);
    expect(html.match(/data-hax-control=/g) ?? []).toHaveLength(9);
    expect(html).toContain('aria-label="Move up and right"');
    expect(html).toContain('aria-label="Hold Kick near the ball; release after kicking"');
    expect(html).toContain('Attack the');
    expect(html).not.toContain('data-haxball-pitch="true"');
  });

  it('makes a phone-only player the stage above controls without TV directions', () => {
    const state = kit.start();
    const html = renderPhone(state, 'p1', true);
    expect(html).toContain('data-haxball-stage="true"');
    expect(html).toContain('data-haxball-pitch="true"');
    expect(html).toContain('data-hax-control="kick"');
    expect(html).not.toMatch(/on the TV|Look at the TV|watch the TV/i);
  });

  it.each([false, true])(
    'spectators watch the full pitch with no input controls (phone-only=%s)',
    (mode) => {
      const html = renderPhone(kit.start(), 'spectator', mode);
      expect(html).toContain('Watching Haxball');
      expect(html).toContain('data-haxball-pitch="true"');
      expect(html).toContain('You are watching the match.');
      expect(html).not.toContain('Controls return');
      expect(html).not.toMatch(/<button|data-hax-control=/);
    },
  );

  it.each([false, true])(
    'spectators never promise controls between phases (phone-only=%s)',
    (mode) => {
      const start = kit.start();
      const goal: State = { ...start, phase: { ...start.phase, id: 'goal' } };
      const halftime = kit.vip(start, 'skip', kit.t0 + 1000);
      const paused = kit.vip(start, 'pause', kit.t0 + 1000);
      const done = kit.vip(start, 'end', kit.t0 + 1000);
      for (const state of [goal, halftime, paused, done]) {
        const html = renderPhone(state, 'spectator', mode);
        expect(html).toContain('You are watching the match.');
        expect(html).not.toMatch(/Controls return|Controls are released|<button|data-hax-control=/);
      }
    },
  );

  it('a paused player sees the held public stage and no controls', () => {
    const paused = kit.vip(kit.start(), 'pause', kit.t0 + 1000);
    const html = renderPhone(paused, 'p1', true);
    expect(html).toContain('Match paused');
    expect(html).toContain('Controls are released');
    expect(html).not.toMatch(/<button|data-hax-control=/);
  });

  it('a permanent leaver returns to watching with its retained jersey and no controls', () => {
    const start = kit.start();
    const left = kit.player(start, 'p1', false, 'left', kit.t0 + 100);
    const returned = kit.player(left, 'p1', true, undefined, kit.t0 + 200);
    const html = renderPhone(returned, 'p1', true);
    expect(html).toContain('you left the match');
    expect(html).toContain('Your team keeps its number. You are watching.');
    expect(html).toContain('data-haxball-pitch="true"');
    expect(html).not.toMatch(/<button|data-hax-control=/);
  });

  it('credits an own goal without making its scorer a member of the scoring team', () => {
    const start = kit.start();
    const scorer = start.discs.find((d) => d.team === 'blue')!;
    const goal: State = {
      ...start,
      phase: { ...start.phase, id: 'goal' },
      goals: { red: 1, blue: 0 },
      lastGoal: { team: 'red', scorerId: scorer.id, ownGoal: true },
    };
    expect(renderTv(goal)).toContain('Red goal!');
    expect(renderPhone(goal, scorer.id, true)).toContain(
      `Own goal by ${jersey('blue', scorer.number)}`,
    );
    expect(renderPhone(goal)).not.toMatch(/<button|data-hax-control=/);
    expect(renderPhone(goal)).toContain('Controls return when play begins.');
  });

  it.each([false, true])(
    'keeps named last-goal credit after reset, at half-time and at the result (own goal=%s)',
    (ownGoal) => {
      const start = kit.start();
      const scorer = start.discs.find((d) => d.team === (ownGoal ? 'blue' : 'red'))!;
      const goal = enterGoal(start, { team: 'red', scorerId: scorer.id, ownGoal }, kit.t0 + 100);
      const resumed = kit.vip(goal, 'skip', kit.t0 + 200);
      const halftime = kit.vip(resumed, 'skip', kit.t0 + 300);
      const second = kit.vip(halftime, 'skip', kit.t0 + 400);
      const done = kit.vip(second, 'end', kit.t0 + 500);
      const creditedName = start.players[scorer.id]!.name;
      const credit = `Last goal: ${ownGoal ? 'Own goal by' : 'Scored by'} ${jersey(scorer.team, scorer.number)} · ${creditedName}`;
      expect(resumed.phase.id).toBe('play');
      for (const state of [resumed, halftime, second, done]) {
        for (const html of [renderTv(state), renderPhone(state, 'spectator', true)]) {
          expect(html).toContain('data-hax-goal-credit="true"');
          expect(html).toContain(credit);
          expect(html).not.toContain('Back to the centre for kick-off');
        }
      }
      for (const html of [renderTv(halftime), renderPhone(halftime, 'p1', true)]) {
        expect(html).toContain('Teams keep their jerseys. Goals switch when play restarts.');
        expect(html).toContain(credit);
      }
    },
  );

  it('keeps active compact last-goal credit short while exposing the full own-goal name', () => {
    const start = kit.start();
    const scorer = start.discs.find((d) => d.team === 'blue')!;
    const name = 'W'.repeat(64);
    const maximum: State = {
      ...start,
      players: { ...start.players, [scorer.id]: { ...start.players[scorer.id]!, name } },
    };
    const goal = enterGoal(
      maximum,
      { team: 'red', scorerId: scorer.id, ownGoal: true },
      kit.t0 + 100,
    );
    const resumed = kit.vip(goal, 'skip', kit.t0 + 200);
    const html = renderPhone(resumed, scorer.id, true);
    const creditedHeadline =
      html.match(/<h2[^>]*data-hax-goal-credit="true"[^>]*>[^<]*<\/h2>/)?.[0] ?? '';
    const shortCredit = `Last goal: Own goal by ${jersey(scorer.team, scorer.number)}`;
    const fullCredit = `${shortCredit} · ${name}`;
    expect(creditedHeadline).toContain(`aria-label="${fullCredit}"`);
    expect(creditedHeadline).toContain(`title="${fullCredit}"`);
    expect(creditedHeadline).toContain(`>${shortCredit}</h2>`);
    expect(html).not.toContain('<p data-hax-goal-credit=');
    expect(html).toContain('Half 1 / 2');
    expect(html).toContain('data-haxball-pitch="true"');
    expect(html.match(/data-hax-control=/g) ?? []).toHaveLength(9);
    expect(html).toContain(`${jersey(scorer.team, scorer.number)} · you`);
  });

  it('identifies the scoring team honestly when no scorer can be credited', () => {
    const start = kit.start();
    const goal = enterGoal(start, { team: 'blue', scorerId: null, ownGoal: false }, kit.t0 + 100);
    const resumed = kit.vip(goal, 'skip', kit.t0 + 200);
    expect(renderTv(goal)).toContain('Blue goal · no credited scorer');
    for (const html of [renderTv(resumed), renderPhone(resumed, 'spectator', true)]) {
      expect(html).toContain('Last goal: Blue goal · no credited scorer');
      expect(html).not.toContain('Back to the centre for kick-off');
    }
  });

  it('half-time explains the next restart honestly to players and spectators', () => {
    const half = kit.vip(kit.start(), 'skip', kit.t0 + 1000);
    expect(half.phase.id).toBe('halftime');
    for (const mode of [false, true]) {
      for (const id of ['p1', 'spectator']) {
        const html = renderPhone(half, id, mode);
        expect(html).toContain('>Half-time</h2>');
        expect(html).toContain('aria-label="Next half starts in"');
        expect(html).toContain('Teams keep their jerseys. Goals switch when play restarts.');
        expect(html).not.toMatch(
          /Keep your team|Change the goal you attack|<button|data-hax-control=/,
        );
      }
    }
    const tv = renderTv(half);
    expect(tv).toContain('>Half-time</h2>');
    expect(tv).toContain('aria-label="Next half starts in"');
    expect(tv).toContain('Teams keep their jerseys. Goals switch when play restarts.');
    expect(renderPhone(half, 'p1', true)).toContain('Controls return when play begins.');
    const second = kit.vip(half, 'skip', kit.t0 + 2000);
    const html = renderPhone(second);
    expect(html).toContain('Half 2 / 2');
    const own = game.controllerView(second, 'p1');
    expect(html).toContain(own.team === 'red' ? '← left' : 'right →');
  });

  it.each([
    { red: 2, blue: 1 },
    { red: 0, blue: 3 },
    { red: 1, blue: 1 },
  ])('terminal score %j has honest team result and full roster', (goals) => {
    const start = kit.start();
    const done = kit.vip({ ...start, goals }, 'end', kit.t0 + 1000);
    const headline =
      goals.red === goals.blue ? 'A draw!' : goals.red > goals.blue ? 'Red wins!' : 'Blue wins!';
    expect(renderPhone(done, 'p1', true)).toContain('The final team scores are above.');
    for (const html of [
      renderTv(done),
      renderPhone(done, 'p1', true),
      renderPhone(done, 'spectator', true),
    ]) {
      expect(html).toContain(headline);
      expect(html).toContain('data-jersey="R4"');
      expect(html).toContain('data-jersey="B4"');
      expect(html).not.toMatch(/<button|data-hax-control=/);
    }
  });

  it('64-character common names keep unique visible jersey identities and full accessible names', () => {
    const start = kit.start();
    const maximum: State = {
      ...start,
      players: Object.fromEntries(
        Object.entries(start.players).map(([id, p]) => [
          id,
          { ...p, name: `${'W'.repeat(61)} ${id}`.slice(0, 64) },
        ]),
      ),
    };
    const html = renderTv(maximum);
    expect(html).toContain('data-jersey="R1"');
    expect(html).toContain('data-jersey="B1"');
    expect(html).toContain('W'.repeat(61));
    expect(shortName('W'.repeat(64))).toHaveLength(20);
    expect(shortName('W'.repeat(64))).toContain('…');
  });

  it('own pending/armed/consumed states come from authoritative views, not predicted ball distance', () => {
    const state = kit.start();
    const id = 'p1';
    const intent = state.intents[id]!;
    const armed: State = {
      ...state,
      intents: {
        ...state.intents,
        [id]: { ...intent, kickHeld: true, kickArmed: true, until: state.clock + 650 },
      },
    };
    expect(renderPhone(armed)).toContain('Kick armed · get close to the ball');
    const consumed: State = {
      ...armed,
      intents: {
        ...armed.intents,
        [id]: { ...armed.intents[id]!, kickArmed: false, lastKickAt: state.clock },
      },
    };
    expect(renderPhone(consumed)).toContain('Kick connected · release Kick to rearm');
  });

  it('an odd roster names its helper without disguising it as another human', () => {
    const state = testKit(game, { players: testPlayers(7), t0: kit.t0 }).start();
    const html = renderPhone(state, 'spectator', true);
    expect(html).toContain('Blue Helper');
    expect(html).toContain('· helper');
    expect(html).not.toMatch(/<button|data-hax-control=/);
  });
});

describe('match presentation boundaries', () => {
  it('clamps expired time and presents ties without a fabricated winner', () => {
    expect(clockText(1000, 2000)).toBe('0:00');
    expect(clockText(90500, 500)).toBe('1:30');
    expect(
      matchHeadline({ ...game.tvView(kit.start()), phaseId: 'done', goals: { red: 0, blue: 0 } }),
    ).toBe('A draw!');
    expect(goalCredit(game.tvView(kit.start()))).toBe('');
  });
});
