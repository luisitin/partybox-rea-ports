// A player chip: avatar + name + state glyph. Shared by the TV envelope, lobby, results and games.
// State is never colour-only: submitted shows ✓, disconnected shows ⟳ and dims, spectator shows 👁.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { STRINGS } from '../controller/strings';
import { Avatar } from './Avatar';
import { LeadMark } from './LeadMark';
import { useT } from './lang';
import type { Translator } from './lang';
import styles from './PlayerChip.module.css';

/** A bot named after its owner ("Maximiliano's bot 2", engine bots.ts) splits into the part that
 *  may shrink and the part that tells the bots apart; "Bot 1" and people's names stay whole. */
export function splitBotName(name: string): { head: string; tail: string } | null {
  const m = /^(.*\S)\s+(bot(?:\s+\d+)?)$/i.exec(name);
  return m && m[1] && m[2] ? { head: m[1], tail: m[2] } : null;
}

/** The owner's first name alone, for the tightest chip: "Maximiliano Vega's" → "Maximiliano"
 *  (T-0025: at an SE's two columns the name slot is ~70 px; "Priya's" was cut, "Priya" is whole). */
function firstOwnerName(head: string): string {
  return (head.split(/\s+/)[0] ?? head).replace(/['’]s$/i, '');
}

export interface PlayerChipProps {
  name: string;
  avatarId: string;
  connected?: boolean;
  status?: 'active' | 'submitted' | 'waiting' | 'spectator';
  isVip?: boolean;
  score?: number;
  /** A held-over score (the strip is frozen for a beat): muted, no pop. */
  scoreMuted?: boolean;
  /** Currently leading on points: a "1st" tag before the score (I-268). */
  leader?: boolean;
  /** Highlight (e.g. it is this player's turn). */
  active?: boolean;
  /** I-070 C: this player just nudged the VIP — the chip waves. */
  waving?: boolean;
  /** I-089 A: seconds of disconnect grace left (the TV counts it); shown under the name. */
  awayLeft?: number | null;
  /** I-045 B + the owner's note: the room waits on this player — three pulsing dots over the
   *  avatar, the avatar dimmed under them. */
  thinking?: boolean;
  /** This chip is the viewer: a small "you" tag (not the turn outline). */
  isMe?: boolean;
  /** I-792 E: a tight grid cell (the phone lobby's two columns) gives the name the room: no "you"
   *  tag (the label keeps "(you)"; the lobby rings your chip), the VIP tag is its ★ alone, and the
   *  glyph slot only exists while there is a glyph. */
  compact?: boolean;
  /** A bot player (ADR-028): shows a robot tag so nobody mistakes it for a person. */
  isBot?: boolean;
  /** Renders a ✕ inside the chip (e.g. remove a bot you own); 44 px hit area. */
  onRemove?: () => void;
  removeLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

const GLYPH: Record<NonNullable<PlayerChipProps['status']>, string> = {
  active: '',
  submitted: '✓',
  // No glyph: a row of dashes during a reveal carried nothing; the label keeps it for screen readers.
  waiting: '',
  spectator: '◎',
};

/** The state's words for screen readers, in the device's language (`L` from the caller). */
function stateLabel(state: PlayerChipProps['status'] | 'reconnecting', L: Translator): string {
  switch (state) {
    case 'submitted':
      return L('submitted');
    case 'waiting':
      return L('waiting');
    case 'spectator':
      return L('spectator');
    case 'reconnecting':
      return L('reconnecting');
    default:
      return '';
  }
}

export function PlayerChip(props: PlayerChipProps): JSX.Element {
  const {
    name,
    avatarId,
    connected = true,
    status = 'active',
    isVip,
    score,
    scoreMuted = false,
    leader,
    active,
    waving = false,
    awayLeft = null,
    thinking = false,
    isMe,
    compact = false,
    isBot,
    onRemove,
    removeLabel,
    size = 'md',
  } = props;
  const L = useT(STRINGS);
  const botTail = isBot ? splitBotName(name) : null;
  // The ★ VIP badge pops only when it arrives on a mounted chip (a handover), never on a screen
  // swap — 'adjust state when a prop changes' (review-loop #5).
  const [wasVip, setWasVip] = useState(isVip ?? false);
  const [justVip, setJustVip] = useState(false);
  if ((isVip ?? false) !== wasVip) {
    setWasVip(isVip ?? false);
    setJustVip(isVip === true);
  }
  // I-009 A: a drop and a return on a mounted chip flicker out / snap back — never on a screen
  // swap (the same 'adjust state when a prop changes' rule as the ★ badge above).
  const [wasConnected, setWasConnected] = useState(connected);
  const [blip, setBlip] = useState<'off' | 'back' | null>(null);
  if (connected !== wasConnected) {
    setWasConnected(connected);
    setBlip(connected ? 'back' : 'off');
  }
  const glyph = connected
    ? { text: GLYPH[status], label: stateLabel(status, L) }
    : { text: '⟳', label: stateLabel('reconnecting', L) };
  const locked = status === 'submitted' && connected;
  const classes = [
    styles.chip,
    styles[size],
    active ? styles.active : '',
    waving ? styles.wave : '', // I-070 C: the sender waves while their nudge shows
    !connected ? styles.off : '',
    blip === 'off' ? styles.flicker : blip === 'back' ? styles.snap : '',
    status === 'spectator' ? styles.spectator : '',
    locked ? styles.locked : '',
  ].join(' ');
  // I-268 C: a rise floats "+N" over the score for 2 s — the "went up" the ▲ used to be read as,
  // now a mark of its own. Not while the strip is held (scoreMuted); the held number lands later.
  const [rise, setRise] = useState<{ n: number; at: number } | null>(null);
  const lastScore = useRef(score);
  useEffect(() => {
    const prev = lastScore.current;
    lastScore.current = score;
    if (score === undefined || prev === undefined || scoreMuted || score <= prev) return;
    setRise({ n: score - prev, at: Date.now() });
  }, [score, scoreMuted]);
  useEffect(() => {
    if (!rise) return undefined;
    const t = window.setTimeout(() => setRise(null), 2000);
    return () => window.clearTimeout(t);
  }, [rise]);
  return (
    <div
      className={classes}
      aria-label={`${name}${isMe ? ` ${L('(you)')}` : ''}${isBot ? ` ${L('(bot)')}` : ''}${isVip ? ', VIP' : ''}${glyph.label ? `, ${glyph.label}` : ''}${leader ? `, ${L('leading')}` : ''}`}
    >
      <span className={`${styles.avatar} ${thinking ? styles.avatarThinking : ''}`}>
        <span
          className={`${styles.portrait} ${!connected && awayLeft !== null ? styles.draining : ''}`}
          style={
            !connected && awayLeft !== null
              ? ({ ['--pb-away']: `${(awayLeft / 120) * 360}deg` } as CSSProperties)
              : undefined
          }
        >
          <Avatar avatarId={avatarId} dim={!connected || status === 'spectator'} />
        </span>
        {thinking ? (
          <span className={styles.dots} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </span>
      {/* A bot's name keeps its tail: "Maximiliano's bot 2" truncates the owner, never "bot 2"
          (reviewer 90838c: three chips all read "Ma…" on an SE). */}
      {botTail && compact && onRemove ? (
        // The VIP's lobby chip on an SE: the owner's first name, shrinking, then the tail, whole
        // (reviewer 90838c: "Ma…" three times; T-0025: two owners' bots both read "Bot"). The
        // full name is the label.
        <span className={`${styles.name} ${styles.split}`}>
          <span className={`${styles.nameHead} ${styles.nameFirst}`}>
            {firstOwnerName(botTail.head)}
          </span>
          <span className={styles.nameInitial}>{firstOwnerName(botTail.head).charAt(0)}</span>
          <span className={styles.nameTail}>{botTail.tail}</span>
        </span>
      ) : botTail ? (
        <span className={`${styles.name} ${styles.split}`}>
          <span className={styles.nameHead}>{botTail.head}</span>
          <span className={styles.nameTail}>{botTail.tail}</span>
        </span>
      ) : (
        <span className={styles.name}>{name}</span>
      )}
      {!connected && awayLeft !== null ? (
        <span
          className={styles.away}
          aria-label={L('{seconds} seconds before they drop out', { seconds: awayLeft })}
        >
          {Math.floor(awayLeft / 60)}:{String(awayLeft % 60).padStart(2, '0')}
        </span>
      ) : null}
      {isMe && !compact ? (
        <span className={styles.you} aria-hidden>
          {L('you')}
        </span>
      ) : null}
      {/* A compact chip with a ✕ (the lobby's removable bot) leaves the 🤖 out: at an SE's two
          columns badge + ✕ cut "Bot 1" to "B" (foundation, imposter-defaults review), and the
          ✕ and the name already say it; the chip's label still says "(bot)". */}
      {isBot && !(compact && onRemove) ? (
        <span className={styles.bot} role="img" aria-label={L('bot')}>
          🤖
        </span>
      ) : null}
      {isVip ? (
        <span
          className={`${styles.vip} ${justVip ? styles.vipPop : ''}`}
          aria-hidden
          onAnimationEnd={() => setJustVip(false)}
        >
          {compact ? '★' : '★ VIP'}
        </span>
      ) : null}
      {compact && !glyph.text ? null : (
        // Always in the layout (a reserved slot), so a ✓ landing never shoves the neighbours.
        <span
          className={`${styles.glyph} ${glyph.text ? styles.shown : ''} ${locked ? styles.ok : ''} ${!connected ? styles.spin : ''}`}
          aria-hidden
        >
          {glyph.text}
        </span>
      )}
      {leader && score !== undefined ? <LeadMark className={styles.leader} /> : null}
      {score !== undefined ? (
        <span className={styles.scoreBox}>
          {/* keyed on the value so a change re-mounts and pops in place */}
          <span key={score} className={`${styles.score} ${scoreMuted ? styles.scoreMuted : ''}`}>
            {score}
          </span>
          {rise ? (
            <span key={rise.at} className={styles.rise} aria-hidden>
              +{rise.n}
            </span>
          ) : null}
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={removeLabel ?? L('remove')}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
