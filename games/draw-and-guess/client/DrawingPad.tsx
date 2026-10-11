// The artist has a single paper surface, six named inks and three labelled brush widths.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { DrawGuessControllerView } from '../server/index';
import type { Input, Stroke } from '../server/types';
import { Board, INKS } from './Board';
import styles from './Controller.module.css';
import { STRINGS } from './strings';
import { useDrawing } from './useDrawing';

const WIDTHS: { value: Stroke['size']; label: string }[] = [
  { value: 2, label: 'Small' },
  { value: 5, label: 'Medium' },
  { value: 9, label: 'Large' },
];

export function DrawingPad({
  view,
  send,
}: {
  view: DrawGuessControllerView;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const pad = useDrawing(view, send);
  const disabled = !!view.paused;
  return (
    <div className={styles.drawing}>
      <div className={styles.secret}>
        <span>{L('Draw this — no letters')}</span>
        <b>{view.secret ?? ''}</b>
      </div>
      <div className={styles.drawPaper}>
        <Board
          strokes={pad.strokes}
          label={L('Drawing canvas. Draw with your finger or pointer.')}
          editable={!disabled && !pad.full}
          onPointerDown={pad.down}
          onPointerMove={pad.move}
          onPointerUp={pad.up}
          onPointerCancel={pad.up}
          onLostPointerCapture={pad.up}
        />
      </div>
      <div className={styles.colors} role="group" aria-label={L('Ink colour')}>
        {INKS.map(([name, token], index) => (
          <button
            key={token}
            type="button"
            aria-label={L(name)}
            aria-pressed={pad.color === index}
            disabled={disabled}
            className={styles.color}
            style={{ ['--ink' as string]: `var(${token})` } as CSSProperties}
            onClick={() => pad.setColor(index)}
          >
            <i aria-hidden="true">{pad.color === index ? '✓' : index + 1}</i>
          </button>
        ))}
      </div>
      <div className={styles.widths} role="group" aria-label={L('Brush size')}>
        {WIDTHS.map((width) => (
          <button
            key={width.value}
            type="button"
            aria-pressed={pad.size === width.value}
            disabled={disabled}
            onClick={() => pad.setSize(width.value)}
          >
            {L(width.label)}
          </button>
        ))}
      </div>
      <div className={styles.edits}>
        <button
          type="button"
          disabled={disabled || pad.inkCount === 0}
          onClick={() => pad.edit('undo')}
        >
          {L('Undo stroke')}
        </button>
        <button
          type="button"
          disabled={disabled || pad.inkCount === 0}
          onClick={() => pad.edit('clear')}
        >
          {L('Clear canvas')}
        </button>
      </div>
      <p className={styles.note} role="status">
        {pad.full
          ? L('Canvas full — undo or clear to keep drawing.')
          : L('Your lines appear live for everyone.')}
      </p>
    </div>
  );
}
