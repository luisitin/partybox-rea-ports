import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { DrawControllerView, Input } from '../server/types';
import { DrawingPad } from './DrawingPad';
import { acknowledgeGuess, editGuess, nextGuessRequest, submitGuess } from './guessDraft';
import type { GuessDraft } from './guessDraft';
import { Pencil, Picture } from './Picture';
import { leaderNames, Roster } from './Roster';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<DrawControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const play = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const [draft, setDraft] = useState<GuessDraft>({ turn: -1, text: '', edit: 0 });
  const requestSerial = useRef(0);
  useEffect(() => {
    setDraft((current) => acknowledgeGuess(current, view.turn, view.guessReceipt));
  }, [view.turn, view.guessReceipt]);
  const [visibleHeight, setVisibleHeight] = useState<number>();
  useEffect(() => {
    // Mobile keyboards can shrink the visual viewport without shrinking 100dvh (notably Safari).
    const resize = (): void =>
      setVisibleHeight(window.visualViewport?.height ?? window.innerHeight);
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  const fit: CSSProperties | undefined =
    visibleHeight === undefined
      ? undefined
      : {
          maxHeight: `calc(${visibleHeight}px - var(--pb-space-8) - var(--pb-space-6) - var(--pb-space-1))`,
        };
  const phase = view.phaseId;
  const player = view.me.role === 'player';
  const celebrated = useRef('');
  useEffect(() => {
    const key = `${view.turn}:${view.me.id}`;
    if (
      !player ||
      view.isDrawer ||
      !view.solved ||
      view.myPoints <= 0 ||
      celebrated.current === key
    )
      return;
    celebrated.current = key;
    play('correct');
    buzz(40);
  }, [view.turn, view.me.id, view.isDrawer, view.solved, view.myPoints, player, play]);
  const seconds = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const stage = phoneOnly || view.phoneStage || !player;
  const text = draft.turn === view.turn ? draft.text : '';
  const leaders = leaderNames(view, view.players);
  const guessing = player && !view.isDrawer && phase === 'draw' && !view.solved;
  const title =
    phase === 'choose'
      ? view.isDrawer && player
        ? L('Pick your secret word')
        : L('{name} is choosing', { name: view.drawerName })
      : phase === 'draw'
        ? view.isDrawer && player
          ? (view.secret ?? '')
          : view.mask
        : phase === 'reveal'
          ? (view.answer ?? '')
          : leaders.length === 1
            ? L('{name} wins!', { name: leaders[0] ?? '' })
            : L('A tie at the top!');
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !view.canGuess || view.paused) return;
    requestSerial.current = nextGuessRequest(requestSerial.current, view.guessReceipt);
    const request = requestSerial.current;
    setDraft((current) =>
      submitGuess(current, view.turn, request, value, view.guessReceipt.revision),
    );
    send({ type: 'guess', text: value, request });
  };
  const awaiting = draft.turn === view.turn && draft.pending !== undefined;

  return (
    <section
      className={styles.screen}
      style={fit}
      data-phase={phase}
      data-drawing={view.isDrawer && phase === 'draw'}
      data-stage={stage}
      data-compact={visibleHeight !== undefined && visibleHeight <= 600}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {phase === 'reveal'
              ? L('The word was')
              : phase === 'done'
                ? L('Drawing champions')
                : L('Turn {n} of {m}', { n: view.turn, m: view.turns })}
          </p>
          <h2 className={styles.title} data-mask={phase === 'draw' && !view.isDrawer}>
            {title}
          </h2>
          {phase === 'draw' && view.isDrawer && player ? (
            <p className={styles.artistProgress} role="status">
              {L('{n}/{m} guessed it', { n: view.solvedCount, m: view.guesserCount })}
            </p>
          ) : null}
        </div>
        {phase === 'draw' || phase === 'choose' ? (
          <p
            className={styles.clock}
            role="timer"
            aria-label={view.paused ? L('Paused') : L('Time left')}
          >
            {view.paused ? L('Paused') : L('{n}s', { n: seconds })}
          </p>
        ) : null}
      </header>

      {phase === 'choose' && view.isDrawer && player ? (
        <div className={styles.choose}>
          <Pencil />
          <p>{L('Pick a picture you can draw. Keep it secret!')}</p>
          <div className={styles.choices} role="group" aria-label={L('Secret word choices')}>
            {view.choices?.map((word, index) => (
              <button
                key={index}
                type="button"
                disabled={view.paused}
                onClick={() => send({ type: 'choose', index })}
              >
                <span aria-hidden="true">{index + 1}</span>
                {word}
              </button>
            ))}
          </div>
        </div>
      ) : phase === 'draw' && view.isDrawer && player ? (
        <DrawingPad
          key={view.turn}
          strokes={view.strokes}
          inkRevision={view.inkRevision}
          disabled={view.paused}
          send={send}
        />
      ) : (
        <>
          {stage || phase === 'reveal' ? (
            <div className={styles.picture}>
              <Picture strokes={view.strokes} />
            </div>
          ) : (
            <div className={styles.breath}>
              <Pencil />
            </div>
          )}
          {phase === 'choose' ? (
            <p className={styles.message}>{L('Get ready to guess the picture.')}</p>
          ) : null}
          {phase === 'draw' ? (
            <div className={styles.status}>
              <p>{L('Artist: {name}', { name: view.drawerName })}</p>
              <p>{L('{n} of {m} guessed it', { n: view.solvedCount, m: view.guesserCount })}</p>
              {view.solved && player ? (
                <p className={styles.correct} role="status">
                  {L('Correct! +{n} points', { n: view.myPoints })}
                </p>
              ) : null}
            </div>
          ) : null}
          {guessing ? (
            <form className={styles.guess} onSubmit={submit}>
              <div className={styles.feedback} aria-live="polite">
                {awaiting ? L('Guess sent…') : L.sent(view.feedback || L('What is the picture?'))}
                {!awaiting && view.lastGuess ? (
                  <span>{L('Your guess: {word}', { word: view.lastGuess })}</span>
                ) : null}
              </div>
              <label htmlFor="draw-guess-input">{L('Your guess')}</label>
              <div className={styles.answerBar}>
                <input
                  id="draw-guess-input"
                  value={text}
                  maxLength={40}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="send"
                  disabled={view.paused || !view.canGuess}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => editGuess(current, view.turn, value));
                  }}
                />
                <button type="submit" disabled={!text.trim() || view.paused || !view.canGuess}>
                  {L('Guess')}
                </button>
              </div>
            </form>
          ) : null}
          {phase === 'reveal' || phase === 'done' || (stage && phase === 'draw' && !guessing) ? (
            <Roster
              board={view}
              players={view.players}
              ranked={phase !== 'draw'}
              gains={phase === 'reveal'}
              final={phase === 'done'}
              me={view.me.id}
            />
          ) : null}
          {phase === 'reveal' && player ? (
            <p className={styles.message}>
              {L('+{n} this turn · {m} points total', {
                n: view.gains[view.me.id] ?? 0,
                m: view.scores[view.me.id] ?? 0,
              })}
            </p>
          ) : null}
          {phase === 'reveal' && view.nextArtistName ? (
            <p className={styles.message}>
              {L('Next artist: {name}', { name: view.nextArtistName })}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
