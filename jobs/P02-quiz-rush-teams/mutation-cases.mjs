// Unique current-canonical anchors; all mutants compile and must fail behavioral assertions.
export const mutants = [
  {
    id: 'M01',
    description: 'Base points inflated',
    file: 'types.ts',
    anchor: 'BASE_POINTS = 500',
    replacement: 'BASE_POINTS = 5000',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M02',
    description: 'Speed points inflated',
    file: 'types.ts',
    anchor: 'SPEED_MAX_POINTS = 500',
    replacement: 'SPEED_MAX_POINTS = 5000',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M03',
    description: 'Streak cap inflated',
    file: 'types.ts',
    anchor: 'STREAK_CAP_POINTS = 300',
    replacement: 'STREAK_CAP_POINTS = 3000',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M04',
    description: 'Teams sum instead of average',
    file: 'scoring.ts',
    anchor: 'eligible.reduce((sum, id) => sum + (lastDelta[id] ?? 0), 0) / eligible.length',
    replacement: 'eligible.reduce((sum, id) => sum + (lastDelta[id] ?? 0), 0)',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M05',
    description: 'Absent unanswered seats dilute means',
    file: 'teams.ts',
    anchor: '(state.players[id]?.connected === true && isParticipating(state, id))',
    replacement: 'true',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M06',
    description: 'Answered departures removed from means',
    file: 'teams.ts',
    anchor: 'Object.hasOwn(state.picks, id) ||',
    replacement: '',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M07',
    description: 'Plurality answer shifted to a different shape',
    file: 'scoring.ts',
    anchor: 'decision = selected === null ? undefined : Number(selected);',
    replacement: 'decision = selected === null ? undefined : (Number(selected) + 1) % 4;',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M08',
    description: 'Tied room votes always select lowest instead of seeded tie',
    file: 'scoring.ts',
    anchor:
      'const [selected, after] = majorityPick(Object.fromEntries(Object.entries(state.picks).map(([id, pick]) => [id, String(pick.index)])), rng,);',
    replacement:
      'const [selected, after] = [Object.values(state.picks).map((pick) => String(pick.index)).sort()[0] ?? null, rng] as const;',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M09',
    description: 'Room speed sums accepted vote times',
    file: 'scoring.ts',
    anchor: 'votes.reduce((n, pick) => n + pick.elapsedMs, 0) / votes.length',
    replacement: 'votes.reduce((n, pick) => n + pick.elapsedMs, 0)',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M10',
    description: 'Shared streak never advances beyond one',
    file: 'scoring.ts',
    anchor: 'decision === question.answerIndex ? roomStreak + 1 : 0',
    replacement: 'decision === question.answerIndex ? 1 : 0',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M11',
    description: 'Discussion never exits',
    file: 'phases/talk.ts',
    anchor:
      'return isTimerFor(state, event) && state.phase.deadline !== null && event.now >= state.phase.deadline ? next(state, event.now) : state;',
    replacement: 'return state;',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M12',
    description: 'Discussion routes taps through answer reducer',
    file: 'index.ts',
    anchor: 'talk: reduceTalk,',
    replacement: 'talk: reduceQuestion,',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M13',
    description: 'Duplicate answer replaces the first',
    file: 'phases/question.ts',
    anchor: 'Object.hasOwn(state.picks, event.playerId) ||',
    replacement: '',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M14',
    description: 'Stale question ID accepted',
    file: 'phases/question.ts',
    anchor: 'event.input.questionId !== state.questionIds[state.index] ||',
    replacement: '',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M15',
    description: 'Stale opening timestamp accepted',
    file: 'phases/question.ts',
    anchor: 'event.input.questionStartedAt !== state.phase.startedAt',
    replacement: 'false',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M16',
    description: 'Disconnected seat submits',
    file: 'phases/question.ts',
    anchor: '!state.players[event.playerId]?.connected ||',
    replacement: '',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M17',
    description: 'Pause duration erodes speed score',
    file: 'index.ts',
    anchor: "['answerClosesAt', 'questionReadableUntil', 'wagerClosesAt', 'wagerReadableUntil']",
    replacement: "['questionReadableUntil', 'wagerClosesAt', 'wagerReadableUntil']",
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M18',
    description: 'Final team totals spoil the last reveal',
    file: 'views.ts',
    anchor: "if (state.phase.id === 'reveal' && isLastIndex(state, state.index)) teams = [];",
    replacement: '',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M19',
    description: 'First podium beat exposes future team tiers',
    file: 'views.ts',
    anchor:
      'teams = teams.filter((team) => team.rank >= (state.podiumRank ?? 1) && team.rank <= 3);',
    replacement: 'teams = teams.filter((team) => team.rank >= 1 && team.rank <= 3);',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M20',
    description: 'VIP end scores an unfinished question',
    file: 'index.ts',
    anchor: 'end: enterDone,',
    replacement: 'end: (state, now) => enterDone(enterReveal(state, now), now),',
    expected:
      'canonical group-server/classic-server/scoring/answer-window/VIP behavioral assertions',
  },
  {
    id: 'M21',
    description: 'Custom IDs lose exact public-prompt bot facts',
    file: 'classic.ts',
    anchor: "return id.startsWith('custom-') ? CLASSIC_PROMPT_FACTS.get(prompt) : undefined;",
    replacement:
      "return id.startsWith('disabled-custom-') ? CLASSIC_PROMPT_FACTS.get(prompt) : undefined;",
    expected:
      'custom-bot-public-facts learned facts, public-key independence and three calibrated strengths',
  },
  {
    id: 'M22',
    description: 'Final group reveal removes the usable VIP podium window',
    file: 'pacing.ts',
    anchor: "? readMs(Math.max(uiWords('Show podium', 'Mostrar el podio'), longestName + 3))",
    replacement: '? 0',
    expected:
      'group-pacing final-window duration, live pre-deadline skip and hidden-score assertions',
  },
  {
    id: 'M23',
    description: 'Final room outcomes expose a reconstructible shared gain',
    file: 'views.ts',
    anchor: 'const hiddenRoomGain = room && hidden;',
    replacement: 'const hiddenRoomGain = false;',
    expected:
      'group-final-room-privacy zero final delta, absent base/bonus and nonreconstructible shared total',
  },
  {
    id: 'M24',
    description: 'Presence updates recompute frozen reveal cuts',
    file: 'pacing.ts',
    anchor:
      "if (state.phase.id === 'reveal' && state.groupRevealBeats) return state.groupRevealBeats;",
    replacement: '',
    expected:
      'group-reveal-cut-stability permanent leave/reconnect and paused uniform cut assertions',
  },
];
