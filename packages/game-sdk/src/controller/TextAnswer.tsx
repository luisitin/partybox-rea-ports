// Free-text input phase: prompt, textarea, character counter, submit in the sticky footer (the
// iOS keyboard never covers it). T-0218: the unsent draft outlives a reload (`useDraft`). T-0225:
// from the tap to the server's echo the button reads "Sending…" (busy, not done) and takes no
// second tap; a 4 s silence gives the button back saying the answer was not sent.
import { useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '../ui/lang';
import { useDraft } from './draft';
import { useKeyboardInset } from './keyboardInset';
import { PrimaryButton } from './PrimaryButton';
import { Screen } from './Screen';
import styles from './TextAnswer.module.css';
import { SDK_LINES, usePhoneOnly } from './phoneOnly';
import { STRINGS } from './strings';

/** How long an empty field sits before it breathes (I-001 C). */
const STALL_MS = 3000;
/** How long a sent answer waits for the server's echo before the button is offered again. */
const ECHO_TIMEOUT_MS = 4000;

interface Pending {
  key: string | undefined;
  /** No echo in time: the field is live again and says so. */
  failed: boolean;
}

export interface TextAnswerProps {
  prompt: ReactNode;
  /** Small text above the prompt (e.g. "Round 2 · Prompt 1 of 2"). */
  kicker?: string;
  placeholder?: string;
  maxLength?: number;
  /** Already accepted by the server → button shows ✓ and input locks. */
  submitted: boolean;
  /** After the deadline the input is disabled. */
  disabled?: boolean;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  /** Distinguishes prompts so the draft resets when the prompt changes (and names its saved copy). */
  promptKey?: string;
  /** Forwarded to the Screen frame (e.g. `pb-enter` so a new prompt rises in as a new card). */
  className?: string;
  /** Under "You said …" once submitted (default: "Waiting for the others — look at the TV", or
   *  without the TV in a phone-only room — see `SDK_LINES`). */
  submittedHint?: ReactNode;
  /**
   * I-795 I: shown above the prompt and given whatever height the prompt, a one-line field and the
   * button leave (a drawing to guess). With a lead the field starts one line tall (it grows as
   * the text wraps), the counter is left out, and an open keyboard shrinks the lead, not the field.
   */
  lead?: ReactNode;
}

export function TextAnswer(props: TextAnswerProps): JSX.Element {
  const phoneOnly = usePhoneOnly();
  const L = useT(STRINGS);
  const {
    prompt,
    kicker,
    placeholder,
    maxLength = 80,
    submitted,
    disabled,
    submitLabel = L('Submit'),
    onSubmit,
    promptKey,
    className,
    submittedHint,
    lead,
  } = props;
  const inset = useKeyboardInset(lead !== undefined && !submitted);
  const draft = useDraft(promptKey);
  const [text, setText] = useState(() => (submitted ? '' : draft.read()));
  const lastKey = useRef(promptKey);
  useEffect(() => {
    if (lastKey.current !== promptKey) {
      lastKey.current = promptKey;
      setText(draft.read());
    }
  }, [promptKey, draft]);
  // T-0218: the server has it; the saved copy is done
  useEffect(() => {
    if (submitted) draft.clear();
  }, [submitted, draft]);
  const [pending, setPending] = useState<Pending | null>(null);
  // "Adjust state when a prop changes": the echo (or a new prompt) ends the wait.
  if (pending !== null && (submitted || pending.key !== promptKey)) setPending(null);
  const sending = pending !== null && !pending.failed;
  useEffect(() => {
    if (!sending) return;
    const handle = setTimeout(
      () => setPending((p) => (p !== null ? { ...p, failed: true } : p)),
      ECHO_TIMEOUT_MS,
    );
    return () => clearTimeout(handle);
  }, [sending]);
  const edit = (value: string): void => {
    const next = value.slice(0, maxLength);
    setText(next);
    draft.write(next);
  };
  // The draft stays until the echo (the effect above clears it): a send lost on the Wi-Fi keeps it.
  const send = (): void => {
    if (sending) return;
    setPending({ key: promptKey, failed: false });
    onSubmit(trimmed);
  };
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !submitted && !disabled && !sending;
  // I-001 C: a field left empty for 3 s breathes until a character lands — sequencing, not a
  // timer the phone shows, so it is not gated on reduced motion (the keyframe itself is). The
  // flag is armed by the timer and read only while the field is still empty and live; a keystroke
  // clears it in render, so a field emptied again waits its 3 s afresh.
  const idle = text.length === 0 && !submitted && !disabled;
  const [stalledFlag, setStalledFlag] = useState(false);
  if (stalledFlag && !idle) setStalledFlag(false);
  useEffect(() => {
    if (!idle) return;
    const handle = setTimeout(() => setStalledFlag(true), STALL_MS);
    return () => clearTimeout(handle);
  }, [idle]);
  const stalled = stalledFlag && idle;
  if (submitted) {
    // The dead textarea + counter added nothing once the answer was in; show what was sent instead.
    return (
      <Screen
        className={className}
        footer={
          <PrimaryButton done onClick={() => undefined}>
            {L('Submitted')}
          </PrimaryButton>
        }
      >
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <p className={styles.prompt}>{prompt}</p>
        <div className={styles.sent} role="status">
          {trimmed ? (
            <>
              <span className={styles.sentLabel}>{L('You said')}</span>
              <span className={styles.sentText}>{trimmed}</span>
            </>
          ) : (
            <span className={styles.sentLabel}>{L('Your answer is in')}</span>
          )}
          <span className={styles.sentHint}>
            {submittedHint ?? SDK_LINES.waiting(phoneOnly, L)}
          </span>
        </div>
      </Screen>
    );
  }
  return (
    <Screen
      className={`${className ?? ''} ${inset > 0 ? styles.squeezed : ''}`}
      footer={
        <PrimaryButton
          onClick={() => canSubmit && send()}
          disabled={!canSubmit}
          reason={
            trimmed.length === 0 && !submitted && !disabled
              ? L('Type your answer first')
              : undefined
          }
          done={submitted}
          busy={sending}
        >
          {submitted
            ? L('Submitted')
            : sending
              ? L('Sending…')
              : pending?.failed && canSubmit
                ? L('Not sent — tap to send again')
                : submitLabel}
        </PrimaryButton>
      }
    >
      {lead !== undefined ? <div className={styles.lead}>{lead}</div> : null}
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <p className={styles.prompt}>{prompt}</p>
      <textarea
        className={`${styles.input} ${lead !== undefined ? styles.inputOne : ''} ${stalled ? styles.stalled : ''}`}
        value={text}
        onChange={(e) => edit(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={lead !== undefined ? 1 : 3}
        disabled={submitted || disabled}
        readOnly={sending}
        autoCapitalize="sentences"
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSubmit) send();
          }
        }}
        aria-label={L('your answer')}
      />
      {disabled && trimmed ? (
        <p className={styles.late} role="status">
          {L("Time's up — your answer wasn't sent.")}
        </p>
      ) : lead !== undefined ? null : (
        // I-001 B: keyed on the length so every keystroke remounts the counter and it bumps once.
        <p
          key={text.length}
          className={`${styles.counter} ${text.length > 0 ? styles.typed : ''}`}
          aria-live="off"
        >
          {text.length} / {maxLength}
        </p>
      )}
    </Screen>
  );
}
