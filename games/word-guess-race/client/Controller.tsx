// A built-in alphabet keyboard keeps play clear of the operating-system keyboard.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { usePhoneOnly, useServerNow } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { WordGuessControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Board } from './Board';
import { Standings } from './Standings';
import { clockText, keyboardMarks, MARK_LABEL, MARK_SYMBOL } from './tiles';
import styles from './Controller.module.css';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function Controller({
  view,
  send,
}: GameControllerProps<WordGuessControllerView, Input>): JSX.Element {
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const [draft, setDraft] = useState({
    round: view.round,
    version: view.submissionVersion,
    value: '',
  });
  const [pending, setPending] = useState({ round: 0, version: -1 });
  const [localError, setLocalError] = useState('');
  const playing = view.phaseId === 'guess';
  const player = view.me.role === 'player';
  const active = playing && player && !view.finished && !view.paused;
  const waiting = pending.round === view.round && pending.version === view.submissionVersion;
  const value =
    draft.round === view.round && (draft.version === view.submissionVersion || view.error !== null)
      ? draft.value
      : '';
  const marks = keyboardMarks(view.guesses);
  const edit = (next: string): void => {
    if (!active || waiting) return;
    setDraft({ round: view.round, version: view.submissionVersion, value: next });
    setLocalError('');
  };
  const submit = (): void => {
    if (!active || waiting) return;
    if (value.length !== 5) {
      setLocalError('Use five letters.');
      return;
    }
    setPending({ round: view.round, version: view.submissionVersion });
    send({ type: 'guess', word: value, round: view.round });
  };
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (/^[a-z]$/i.test(event.key) && value.length < 5) edit(value + event.key.toLowerCase());
      else if (event.key === 'Backspace') {
        event.preventDefault();
        edit(value.slice(0, -1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, waiting, value, view.round, view.submissionVersion]);
  const stage = phoneOnly || view.stage;
  const solved = view.grids.filter((g) => g.solved).length;
  const leaders = view.players.filter((p) => view.ranks[p.id] === 1);
  const winners =
    leaders.length === 1 ? `${leaders[0]!.name} wins!` : `${leaders.length} players share first.`;
  const message = view.solved
    ? `✓ Solved in ${view.guesses.length}!`
    : view.finished
      ? 'Six chances used. The next word is a fresh start.'
      : 'Fewest guesses wins. Speed breaks a tie.';
  const title =
    view.phaseId === 'done'
      ? view.rank === 1
        ? 'You finished first!'
        : player
          ? `You finished #${view.rank}`
          : 'Final standings'
      : view.phaseId === 'reveal'
        ? `The word was ${view.solution?.toUpperCase() ?? '—'}`
        : `Round ${view.round} of ${view.rounds}`;
  return (
    <div className={styles.screen} data-active={active}>
      <header className={styles.header}>
        <h2>{title}</h2>
        {view.deadline !== null ? (
          <span role="timer" aria-label="Time left">
            {clockText(view.deadline - now)}
          </span>
        ) : null}
      </header>
      <p className={styles.hint}>
        {playing
          ? `${solved}/${view.grids.length} solved · ${player ? message : 'Watch the race'}`
          : view.phaseId === 'done'
            ? `${winners} ${player ? `${view.scores[view.me.id] ?? 0} points` : ''}`
            : player
              ? `+${view.lastPoints[view.me.id] ?? 0} this round · ${view.scores[view.me.id] ?? 0} points`
              : 'Fewest guesses, then active solve time.'}
      </p>
      {playing ? (
        <p className={styles.legend}>✓ Right place · ↔ Move it · × No match here</p>
      ) : null}
      {player ? <Board guesses={view.guesses} draft={active ? value : ''} /> : null}
      {active ? (
        <>
          <p className={styles.feedback} role="status" aria-live="polite">
            {waiting
              ? 'Checking…'
              : localError || view.error || 'House dictionary · common five-letter words'}
          </p>
          <div className={styles.keyboard} aria-label="Letter keyboard">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className={styles.key}
                data-mark={marks[letter]}
                aria-label={`${letter.toUpperCase()}${marks[letter] ? `: ${MARK_LABEL[marks[letter]!]}` : ''}`}
                disabled={waiting || value.length >= 5}
                onClick={() => edit(value + letter)}
              >
                <b>{letter.toUpperCase()}</b>
                {marks[letter] ? (
                  <small aria-hidden="true">{MARK_SYMBOL[marks[letter]!]}</small>
                ) : null}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.delete}
              aria-label="Delete last letter"
              disabled={waiting || value.length === 0}
              onClick={() => edit(value.slice(0, -1))}
            >
              ⌫ Delete
            </button>
            <button
              type="button"
              className={styles.submit}
              disabled={waiting || value.length !== 5}
              onClick={submit}
            >
              Guess
            </button>
          </div>
        </>
      ) : (
        <>
          {playing && player ? (
            <p className={styles.feedback} role="status">
              Your word stays private until the round ends.
            </p>
          ) : null}
          <Standings view={view} grids={playing && !player && stage} />
          {!playing ? (
            <p className={styles.hint}>
              {view.phaseId === 'done'
                ? 'Three shared words. One race.'
                : view.round < view.rounds
                  ? 'Next word starts automatically.'
                  : 'Final standings next.'}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
