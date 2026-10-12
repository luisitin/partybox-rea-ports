// Controller (phone) view for Lightning Round: a ChoiceGrid for the question (locked after one
// tap, ✓/✗ in reveal), a ChoiceGrid of wager options before the final, waiting screens otherwise.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import {
  ChoiceGrid,
  WaitingScreen,
  buzz,
  useMediaQuery,
  useSecondsLeft,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps, Translator } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Outcome, RoomRows, Stake, Worth, wagerLabel } from './ControllerBits';
import { CustomStake } from './CustomStake';
import { useCustomWager } from './useCustomWager';
import { PhoneNext } from './NextStep';
import { useRevealBeat } from './reveal-clock';
import { useVerdictCue } from './useRevealCue';
import styles from './Controller.module.css';
import { difficultyText, pointsText, roundLabel } from './labels';
import { finalBetLine } from './final-bet';
import { STRINGS } from './strings';
import { FINAL_REVEAL_HOLD_MS, REVEAL_BEAT_MS } from './timing';
import { ContentLang } from '@partybox/game-sdk/ui';

function roundKicker(view: LightningControllerView, L: Translator): string {
  const where = roundLabel(view.round, L);
  return view.question ? `${where} · ${L.sent(view.question.subcategoryLabel)}` : where;
}

/** The line under the answers once locked in: how fast the pick was, and where to look. */
function lockedLine(spare: number, phoneOnly: boolean, L: Translator): string {
  if (spare <= 3) return phoneOnly ? L('✓ Just made it') : L('✓ Just made it — look at the TV');
  return phoneOnly
    ? L('✓ Locked in with {seconds} s to spare', { seconds: spare })
    : L('✓ Locked in with {seconds} s to spare — look at the TV', { seconds: spare });
}

export function Controller({
  view,
  send,
  skip,
}: GameControllerProps<LightningControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const { phaseId } = view;
  // The streak carried into the question: `myStreak` is already reset in the reveal view.
  const [streakBefore, setStreakBefore] = useState(0);
  const custom = useCustomWager(view);
  // Speed is the point: remember the header's seconds-left at the tap so the locked line can say
  // how fast the pick was (same rounded number the shell prints, so hint and header agree).
  const secondsLeft = useSecondsLeft(view.deadline, view.paused);
  // The final: four long answers, a long question and a two-line bet footer do not fit most
  // phones (record-review p04 on an SE, p05 on a 659-px iPhone page: D under the fold
  // mid-question). Below 760 px the bet is in the kicker only ("… · you bet 1822") and the final
  // has no footer in its question or reveal, so nothing toggles; taller phones keep it (I-026 C).
  const roomy = !useMediaQuery('(max-height: 760px)');
  const [lockedAt, setLockedAt] = useState<{ questionId: string; seconds: number } | null>(null);
  if (phaseId === 'question' && streakBefore !== view.myStreak) setStreakBefore(view.myStreak);
  // The phone never spoils the TV: ✓/✗ and the outcome card wait for the TV's reveal beat.
  // `deadline` is unique per phase entry, so it keys the hold; the beat counts from the TV's
  // `revealAt`, so a reloaded phone lands on the current beat. The final reveal waits for the
  // TV's verdict beat (not collapsed under reduced motion: the TV is another device).
  const isFinal = view.round?.final === true;
  const shown = useRevealBeat(
    phaseId === 'reveal' ? view.deadline : null,
    view.revealAt,
    isFinal ? FINAL_REVEAL_HOLD_MS : REVEAL_BEAT_MS,
    view.paused,
    view.clockHeldAt,
  );
  // Quiz Rush's personal cue waits for Lightning's verdict beat, alongside the existing buzz.
  useVerdictCue(view);
  // I-565 A: one short buzz the moment the room is waiting on me alone, once per question (buzz()
  // no-ops without navigator.vibrate; haptics.ts: the player's switch, not reduced motion)
  const pending = view.players.filter((p) => p.connected && p.status === 'active');
  const waitedOn =
    phaseId === 'question' &&
    view.myPickIndex === null &&
    pending.length === 1 &&
    pending[0]?.id === view.me.id;
  const waitedQ = waitedOn ? (view.question?.id ?? null) : null;
  const [buzzedQ, setBuzzedQ] = useState<string | null>(null);
  if (waitedQ !== null && waitedQ !== buzzedQ) setBuzzedQ(waitedQ);
  useEffect(() => {
    if (buzzedQ !== null) buzz(40);
  }, [buzzedQ]);
  if (view.me.role === 'spectator') {
    return (
      <WaitingScreen
        title={L('Spectating')}
        hint={L('You are in for the next game.')}
        mood="watch"
      />
    );
  }
  if (phaseId === 'intro') {
    return (
      <WaitingScreen
        // ADR-053: the shell's stage showed the rules; the phone's beat is the title, no rule again
        title="Kahoot!"
        hint={L('First question coming up…')}
        mood="wait"
      />
    );
  }
  if ((phaseId === 'question' || phaseId === 'reveal') && view.question) {
    const revealed = phaseId === 'reveal';
    const locked = view.myPickIndex !== null;
    const finalQ = view.round?.final === true;
    // A missing wager counts as 0 (server/phases/wager.ts); the key is only present once tapped.
    const stake = finalQ && phaseId === 'question' ? (view.myWagerAmount ?? 0) : null;
    // Comparing the id at render is the reset; a reconnect after picking gets the default line.
    const spare = locked && lockedAt?.questionId === view.question.id ? lockedAt.seconds : null;
    const lockedHint = spare === null ? undefined : lockedLine(spare, view.phoneOnly === true, L);
    // I-565 A: the room, on the phone — how many are in, and whether it's me they're waiting on
    const playing = view.players.filter(
      (p) => p.connected && p.status !== 'waiting' && p.status !== 'spectator',
    );
    const inCount = playing.filter((p) => p.status === 'submitted').length;
    const holdouts = playing.filter((p) => p.status !== 'submitted');
    const lastOne = !locked && holdouts.length === 1 && holdouts[0]?.id === view.me.id;
    const roomLine =
      phaseId !== 'question' || revealed
        ? null
        : !locked
          ? lastOne
            ? L("Everyone's waiting on you")
            : L('{n}/{total} in', { n: inCount, total: playing.length })
          : holdouts.length > 0 && holdouts.length <= 2
            ? L('waiting for {names}', { names: holdouts.map((p) => p.name).join(', ') })
            : null;
    const questionId = view.question.id;
    return (
      // A new question rises as a new screen; question → reveal keeps the same node.
      <ChoiceGrid
        key={`q${view.round?.number ?? 0}`}
        fill
        promptKey={`${phaseId}:${view.round?.number ?? 0}`}
        tone={finalQ ? 'final' : undefined}
        kicker={
          lastOne && roomLine
            ? roomLine
            : `${
                finalQ && stake !== null && stake > 0
                  ? `${roundKicker(view, L)} · ${L('you bet {stake}', { stake })}`
                  : roundKicker(view, L)
              }${roomLine ? ` · ${roomLine}` : ''}`
        } /* I-039 C; I-565: the room's count (or "Everyone's waiting on you") */
        choices={view.question.choices.map((label, index) => ({ id: String(index), label }))}
        selectedId={locked ? String(view.myPickIndex) : null}
        correctId={
          revealed && shown && view.correctIndex !== undefined ? String(view.correctIndex) : null
        }
        disabled={revealed}
        lockedHint={lockedHint}
        // I-288 B: while it's open, what a right answer is worth now
        prompt={
          <>
            {view.question.text}
            {/* [196a9e]: an ES phone is told the question and answers are English */}
            <ContentLang content={view.contentLang} className={styles.englishNote} />
            {/* I-789 B: after the tap the line keeps its space — locking in moves nothing;
                I-790 C: the reveal band takes its place. The reveal view has no worth, so the
                space is held by hand until the band lands (it went a beat early and the answers
                jumped up under the verdict; record-review p01). */}
            {view.worth && !revealed ? (
              <Worth worth={view.worth} deadline={view.deadline} held={locked} />
            ) : revealed && !shown && !finalQ ? (
              <span className={`${styles.worth} ${styles.worthHeld}`} aria-hidden>
                &nbsp;
              </span>
            ) : null}
          </>
        }
        // I-790 C: the verdict and the two numbers, one band under the question
        band={
          revealed && shown ? (
            <Outcome view={view} streakBefore={streakBefore} />
          ) : revealed && finalQ ? (
            // The final has no "+N now" line to stand in: its band's space is held from the cut,
            // so the answers never move when the verdict lands (record-review p03)
            <div className={styles.bandHeld} aria-hidden>
              <Outcome view={view} streakBefore={streakBefore} />
            </div>
          ) : undefined
        }
        // A "phone only" room: the TV's rows, on the phone under the answers (the owner).
        after={
          revealed && shown && view.phoneOnly && view.rows ? <RoomRows rows={view.rows} /> : null
        }
        onPick={(id) => {
          if (secondsLeft !== null) setLockedAt({ questionId, seconds: secondsLeft });
          send({ type: 'pick', index: Number(id) });
        }}
        footer={
          revealed && shown && view.next && skip ? (
            // I-589: the owner's Next button, on the VIP's phone only
            <PhoneNext
              next={view.next}
              skip={skip}
              phaseKey={view.deadline}
              revealAt={view.revealAt}
              paused={view.paused}
              clockHeldAt={view.clockHeldAt}
            />
          ) : revealed && finalQ && roomy ? (
            // Stays past the verdict (the final has no Next): the answers never jump when the
            // TV's bets start landing (record-review p01).
            <div className={styles.stake} role="status">
              🎲 {finalBetLine(view, shown, L)}
            </div>
          ) : !revealed && stake !== null && roomy ? (
            <Stake amount={stake} live={!locked} />
          ) : null
        }
      />
    );
  }
  if (phaseId === 'wager') {
    const options = view.wagerChoices ?? [];
    const placed = view.myWagerAmount;
    const selected =
      placed === undefined ? null : (options.find((o) => o.amount === placed) ?? null);
    // A custom stake is held only after the server echoes it, just like a preset.
    const customPlaced = placed !== undefined && !selected ? placed : null;
    const potAmount = selected ? selected.amount : customPlaced;
    return (
      <ChoiceGrid
        key="wager"
        fill
        letters={false}
        tone="final"
        promptKey="wager"
        kicker={
          view.finalTopic
            ? // I-550 A; review 6c24ba (3): the category is dropped — the topic names it — so the
              // header stays one or two lines at 200 % text and the chips stay above the fade
              L('Final: {topic}', {
                topic: `${L.sent(view.finalTopic.subcategoryLabel)} · ${difficultyText(view.finalTopic.difficulty, L)}`,
              })
            : L('Final question next')
        }
        prompt={
          <>
            {/* I-026 B: once placed, the prompt is the pot. */}
            {potAmount !== null ? (
              <span key="pot" className={`${styles.pot} pb-pop`}>
                {L('{amount} in the pot', { amount: potAmount })}
              </span>
            ) : (
              <span className={styles.wagerPrompt}>
                {view.myScore > 0
                  ? L('Wager part of your {points}', { points: pointsText(view.myScore, L) })
                  : L('No points yet — you can only wager 0')}
              </span>
            )}
            <span className={styles.rule}>
              {L('Right answer: +wager. Wrong or no answer: −wager.')}
            </span>
          </>
        }
        choices={options.map((o) => ({
          id: String(o.percent),
          label: wagerLabel(o, L),
        }))}
        selectedId={selected ? String(selected.percent) : null}
        disabled={customPlaced !== null || custom.pending}
        onPick={(id) => {
          const option = options.find((o) => String(o.percent) === id);
          if (option) send({ type: 'wager', percent: option.percent });
        }}
        footer={
          view.myScore > 0 ? (
            <CustomStake
              score={view.myScore}
              placed={customPlaced}
              disabled={selected !== null}
              pending={custom.pending}
              failed={custom.failed}
              onPlace={(amount) => {
                custom.place(amount);
                buzz(15);
                send({ type: 'wager', amount });
              }}
            />
          ) : null
        }
        // I-550 (the owner's note): the bet page is laid out to fit — presets two by two
        className={`${styles.wagerScreen} ${potAmount !== null ? styles.placed : ''}`}
      />
    );
  }
  if (phaseId === 'done') {
    return (
      <WaitingScreen
        title={L('Thanks for playing!')}
        hint={
          view.myRank !== undefined
            ? L('You finished #{rank} with {points}.', {
                rank: view.myRank,
                points: pointsText(view.myScore, L),
              })
            : `${pointsText(view.myScore, L)}.`
        }
        mood="done"
      />
    );
  }
  return (
    <WaitingScreen
      title={view.phoneOnly ? L('One moment…') : L('Look at the TV')}
      hint={view.phoneOnly ? L('the next question is on its way') : undefined}
      mood="watch"
    />
  );
}
