// The recap the host writes when a room records (ADR-035): every question with its choices and
// answer, each player's pick, time and points, the wagers on the final, and the standings — read
// from the reveal states in the history, because the live state keeps only the current question.
import { recapMarkdown, recapName } from '@partybox/game-sdk';
import type { GameRecap, RecapContext } from '@partybox/game-sdk';
import { categoryLabel, drawLabel, questionById } from './content';
import { labelOf } from '../content/schema';
import { PICKER_ES } from '../content/labels-es';
import type { State } from './types';
import { isFinalIndex, questionLangOf } from './types';

/** ADR-054: a Spanish game's recap is written in Spanish (its questions are); English otherwise. */
const RECAP_ES: Readonly<Record<string, string>> = {
  Players: 'Jugadores',
  Settings: 'Ajustes',
  questions: 'preguntas',
  's each': 's cada una',
  '_The game was ended early._': '_La partida terminó antes de tiempo._',
  'Final question': 'Pregunta final',
  Question: 'Pregunta',
  easy: 'fácil',
  medium: 'media',
  hard: 'difícil',
  'no answer': 'sin respuesta',
  bet: 'apostó',
  in: 'en',
  '## Final scores': '## Puntuaciones finales',
  '## Awards': '## Premios',
};

export function recap(state: State, ctx: RecapContext<State>): GameRecap | null {
  const es = questionLangOf(state) === 'es';
  const T = (s: string): string => (es ? (RECAP_ES[s] ?? s) : s);
  const label = (s: string): string => (es ? (PICKER_ES[s] ?? s) : s);
  const drawn = (): string => {
    const subs = state.drawnSubs ?? [];
    const head = label(labelOf(state.drawnFrom));
    return subs.length === 0 ? head : `${head} · ${subs.map((t) => label(labelOf(t))).join(', ')}`;
  };
  const name = (id: string): string => recapName(ctx.players, state, id);
  const body: string[] = [`${T('Players')}: ${ctx.players.map((p) => p.name).join(', ')}`];
  body.push(
    `${T('Settings')}: ${state.settings.questions} ${T('questions')} · ${state.settings.answerSeconds} ${T('s each')} · ${es ? drawn() : drawLabel(state.drawnFrom, state.drawnSubs ?? [])}`,
    '',
  );
  const seen = new Set<number>();
  for (const h of ctx.history) {
    if (h.phase !== 'reveal') continue;
    const st = h.state;
    if (seen.has(st.index)) continue;
    seen.add(st.index);
    const id = st.questionIds[st.index];
    const q = id ? questionById(id, st.contentLang) : undefined;
    if (!q) continue;
    const final = isFinalIndex(st, st.index);
    body.push(
      `## ${final ? T('Final question') : `${T('Question')} ${st.index + 1}`} · ${label(categoryLabel(q.category))} · ${label(labelOf(q.subcategory))} · ${T(q.difficulty)}`,
      '',
      `**${q.question}**`,
      '',
    );
    q.choices.forEach((c, i) =>
      body.push(`- ${'ABCD'[i]}. ${c}${i === q.answerIndex ? ' ✓' : ''}`),
    );
    body.push('');
    for (const p of ctx.players) {
      const pick = st.picks[p.id];
      const delta = st.lastDelta[p.id] ?? 0;
      const wager = final ? st.wagers[p.id] : undefined;
      const bet = wager ? ` · ${T('bet')} ${wager}` : '';
      if (!pick)
        body.push(`- ${p.name}: ${T('no answer')}${bet} → ${delta >= 0 ? '+' : ''}${delta}`);
      else
        body.push(
          `- ${p.name}: ${'ABCD'[pick.index]} ${pick.index === q.answerIndex ? '✓' : '✗'} ${T('in')} ${(pick.elapsedMs / 1000).toFixed(1)} s${bet} → ${delta >= 0 ? '+' : ''}${delta}`,
        );
    }
    body.push('');
  }
  return recapMarkdown({
    title: 'Kahoot!',
    at: ctx.history[0]?.at ?? state.phase.startedAt,
    endedEarly: !ctx.results,
    body,
    ranking: ctx.results?.ranking,
    awards: ctx.results?.awards,
    name,
    ...(es
      ? { labels: { endedEarly: T('_The game was ended early._'), scores: T('## Final scores'), awards: T('## Awards') } } // prettier-ignore
      : {}),
  });
}
