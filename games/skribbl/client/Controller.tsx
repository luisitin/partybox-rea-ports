import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, JSX } from 'react';
import { buzz, useDraft, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { DrawControllerView, Input } from '../server/types';
import { DrawingPad } from './DrawingPad';
import {
  acknowledgeGuess,
  editGuess,
  emptyGuessDraft,
  nextGuessRequest,
  pauseGuess,
  restoreGuessDraft,
  saveGuessDraft,
  submitGuess,
} from './guessDraft';
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
  const phase = view.phaseId;
  const player = view.me.role === 'player';
  const guessing = player && !view.isDrawer && phase === 'draw' && !view.solved;
  const inkKey = `ink:${view.me.id}:${view.turn}`;
  const inkSlot = useDraft(inkKey);
  const previousInkSlot = useRef(inkSlot);
  useEffect(() => {
    if (previousInkSlot.current !== inkSlot) {
      previousInkSlot.current.clear();
      previousInkSlot.current = inkSlot;
    }
    if (!(player && view.isDrawer && phase === 'draw')) inkSlot.clear();
  }, [inkSlot, player, view.isDrawer, phase]);
  const slotKey = `guess:${view.me.id}:${view.turn}`;
  const slot = useDraft(slotKey);
  const loadedSlot = useRef({ slot, slotKey });
  const draftReady = loadedSlot.current.slot === slot && loadedSlot.current.slotKey === slotKey;
  const [draft, setDraft] = useState<GuessDraft>(() =>
    guessing
      ? restoreGuessDraft(slot.read(), view.turn, view.guessReceipt)
      : emptyGuessDraft(view.turn),
  );
  const requestSerial = useRef(0);
  useEffect(() => {
    if (loadedSlot.current.slot === slot && loadedSlot.current.slotKey === slotKey) return;
    loadedSlot.current.slot.clear();
    loadedSlot.current = { slot, slotKey };
    setDraft(
      guessing
        ? restoreGuessDraft(slot.read(), view.turn, view.guessReceipt)
        : emptyGuessDraft(view.turn),
    );
    // The current pushed receipt wins on a new slot; ordinary receipt changes use the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, slotKey]);
  useEffect(() => {
    setDraft((current) => acknowledgeGuess(current, view.turn, view.guessReceipt));
  }, [slot, view.turn, view.guessReceipt]);
  useEffect(() => {
    // Process a matching receipt first; only unresolved submissions need pause recovery.
    if (view.paused) setDraft((current) => pauseGuess(current, view.turn));
  }, [view.paused, view.turn]);
  useEffect(() => {
    if (!guessing) {
      slot.clear();
      setDraft((current) =>
        current.text === '' && current.pending === undefined && current.turn === view.turn
          ? current
          : emptyGuessDraft(view.turn),
      );
    } else if (draftReady && draft.turn === view.turn) slot.write(saveGuessDraft(draft));
  }, [slot, guessing, draftReady, draft, view.turn]);
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
  const text = draftReady && draft.turn === view.turn ? draft.text : '';
  const leaders = leaderNames(view, view.players);
  const title =
    phase === 'choose'
      ? view.isDrawer && player
        ? L('Pick a word')
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
    if (!value || !view.canGuess || view.paused || !draftReady) return;
    // A restored in-flight ID must not be reused by its manual retry after refresh.
    if (!requestSerial.current && draft.pending) requestSerial.current = draft.pending.request;
    requestSerial.current = nextGuessRequest(requestSerial.current, view.guessReceipt);
    const request = requestSerial.current;
    const next = submitGuess(draft, view.turn, request, value, view.guessReceipt.revision);
    slot.write(saveGuessDraft(next));
    setDraft(next);
    send({ type: 'guess', text: value, request });
  };
  const pausedDraft = draft.turn === view.turn && draft.pending?.paused === true;
  const awaiting = draft.turn === view.turn && draft.pending !== undefined && !pausedDraft;

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
          <p>{L('Keep it secret!')}</p>
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
          draftKey={inkKey}
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
                {awaiting
                  ? L('Guess sent…')
                  : pausedDraft
                    ? view.paused
                      ? L('Guess kept for retry')
                      : L('Tap Guess to retry')
                    : L.sent(view.feedback || L('What is the picture?'))}
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
                  disabled={view.paused || !view.canGuess || !draftReady}
                  onChange={(event) => {
                    const value = event.target.value;
                    const next = editGuess(draft, view.turn, value);
                    slot.write(saveGuessDraft(next));
                    setDraft(next);
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
