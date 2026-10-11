// Repeated guesses retain the keyboard; feedback never echoes a secret or another player's text.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { buzz, useSound, useT } from '@partybox/game-sdk/ui';
import type { DrawGuessControllerView } from '../server/index';
import type { Input } from '../server/types';
import styles from './Controller.module.css';
import { STRINGS } from './strings';

export function GuessForm({
  view,
  send,
}: {
  view: DrawGuessControllerView;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  // Rejoining an already-solved turn stays quiet; only this phone's fresh success celebrates.
  const wasSolved = useRef(view.solved);
  useEffect(() => {
    if (view.solved && !wasSolved.current) {
      play('correct');
      buzz([30, 40, 30]);
    }
    wasSolved.current = view.solved;
  }, [view.solved, play]);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const disabled = !!view.paused || view.solved || view.feedback === 'limited';
  const feedback =
    view.feedback === 'close'
      ? L('So close! Check the spelling.')
      : view.feedback === 'wrong'
        ? L('Keep guessing — watch the next line.')
        : view.feedback === 'limited'
          ? L('Guess limit reached. Enjoy the drawing!')
          : view.solved
            ? L('You got it! Keep the word to yourself.')
            : sent
              ? L('Guess sent. Keep watching!')
              : L('Any idea? You can guess more than once.');
  const submit = (): void => {
    const guess = text.trim();
    if (disabled || !guess) return;
    send({ type: 'guess', text: guess });
    setText('');
    setSent(true);
  };
  return (
    <form
      className={styles.guessForm}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className={styles.feedback} role="status" data-correct={view.solved || undefined}>
        {feedback}
      </p>
      {!view.solved ? (
        <>
          <label className={styles.guessLabel} htmlFor="draw-and-guess-input">
            {L('Your guess')}
          </label>
          <div className={styles.guessRow}>
            <input
              id="draw-and-guess-input"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSent(false);
              }}
              maxLength={60}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="none"
              enterKeyHint="send"
              placeholder={L('Type the word…')}
              disabled={disabled}
            />
            <button
              type="submit"
              disabled={disabled || !text.trim()}
              onPointerDown={(event) => event.preventDefault()}
            >
              {L('Guess')}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.solved} aria-hidden="true">
          ✓
        </div>
      )}
    </form>
  );
}
