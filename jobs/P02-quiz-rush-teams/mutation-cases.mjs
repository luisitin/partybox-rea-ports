// Each anchor is checked for exactly one occurrence in the current source before mutation.
export const mutants = [
  {
    id: 'M01',
    description: 'Speed awards are inflated tenfold',
    file: 'scoring.ts',
    anchor: 'Math.round(1000 * (1 - fraction / 2))',
    replacement: 'Math.round(10000 * (1 - fraction / 2))',
    expected: 'game.test.ts: scoring boundaries; teams.test.ts: mean and room credit',
  },
  {
    id: 'M02',
    description: 'Wrong answers preserve the previous streak',
    file: 'scoring.ts',
    anchor: 'const streak = right ? previousStreak + 1 : 0;',
    replacement: 'const streak = right ? previousStreak + 1 : previousStreak;',
    expected:
      'game.test.ts: wrong answers and timeouts break streaks; teams.test.ts: no-vote room streak',
  },
  {
    id: 'M03',
    description: 'Team gain sums member points instead of averaging',
    file: 'scoring.ts',
    anchor: 'members.reduce((sum, id) => sum + (verdicts[id]?.points ?? 0), 0) / members.length',
    replacement: 'members.reduce((sum, id) => sum + (verdicts[id]?.points ?? 0), 0)',
    expected:
      'teams.test.ts: rounded mean and unequal team sizes; team-properties.test.ts: equal performance',
  },
  {
    id: 'M04',
    description: 'Unanswered offline seats dilute their team',
    file: 'teams.ts',
    anchor:
      'Object.hasOwn(state.answers, id) || (state.players[id]?.connected === true && !state.left.includes(id))',
    replacement: 'true',
    expected:
      'teams.test.ts: unanswered offline exclusion; team-properties.test.ts: offline nonvoters',
  },
  {
    id: 'M05',
    description: 'Already answered departed members are removed from the mean',
    file: 'teams.ts',
    anchor: 'Object.hasOwn(state.answers, id) ||',
    replacement: '',
    expected: 'teams.test.ts: submitted departed member retained in mean and results',
  },
  {
    id: 'M06',
    description: 'Room vote chooses the least popular answer',
    file: 'scoring.ts',
    anchor: 'const highest = Math.max(...counts);',
    replacement: 'const highest = Math.min(...counts);',
    expected:
      'teams.test.ts: plurality and tie candidates; team-properties.test.ts: room plurality',
  },
  {
    id: 'M07',
    description: 'Tied votes always choose the lowest tied index',
    file: 'scoring.ts',
    anchor: 'decision = order[0]!;',
    replacement: 'decision = tied[0]!;',
    expected: 'teams.test.ts: seeded ties reach both tied choices',
  },
  {
    id: 'M08',
    description: 'Room speed uses summed elapsed instead of the mean',
    file: 'scoring.ts',
    anchor:
      'Object.values(state.answers).reduce((sum, answer) => sum + answer.elapsed, 0) / Object.keys(state.answers).length',
    replacement: 'Object.values(state.answers).reduce((sum, answer) => sum + answer.elapsed, 0)',
    expected: 'teams.test.ts: mean accepted elapsed gives 925 points',
  },
  {
    id: 'M09',
    description: 'Room streak is reset before every collective verdict',
    file: 'scoring.ts',
    anchor: 'state.roomStreak, state.answerMs,',
    replacement: '0, state.answerMs,',
    expected: 'teams.test.ts: second correct room answer includes the shared streak bonus',
  },
  {
    id: 'M10',
    description: 'Discussion deadline never opens the question',
    file: 'phases/talk.ts',
    anchor:
      'return isTimerFor(state, event) && state.phase.deadline !== null && event.now >= state.phase.deadline ? next(state, event.now) : state;',
    replacement: 'return state;',
    expected: 'teams.test.ts: discussion exit; team-properties.test.ts: trace termination',
  },
  {
    id: 'M11',
    description: 'Discussion accepts answer inputs',
    file: 'index.ts',
    anchor: 'talk: reduceTalk,',
    replacement: 'talk: reduceQuestion,',
    expected:
      'teams.test.ts: no discussion taps; team-properties.test.ts: out-of-phase inputs ignored',
  },
  {
    id: 'M12',
    description: 'Paused time is included in answer speed',
    file: 'index.ts',
    anchor: 'openedAt: state.openedAt + pausedFor(state, event.now)',
    replacement: 'openedAt: state.openedAt',
    expected:
      'game.test.ts: pause accounting; team-properties.test.ts: later elapsed excludes pause',
  },
  {
    id: 'M13',
    description: 'Duplicate votes overwrite the first choice',
    file: 'phases/question.ts',
    anchor: 'event.input.round !== state.round || Object.hasOwn(state.answers, event.playerId)',
    replacement: 'event.input.round !== state.round',
    expected: 'game.test.ts: first answer locks; teams.test.ts: immutable room votes',
  },
  {
    id: 'M14',
    description: 'Stale round votes are accepted',
    file: 'phases/question.ts',
    anchor: 'event.input.round !== state.round ||',
    replacement: '',
    expected: 'game.test.ts: stale round answers; team-properties.test.ts: hostile round receipts',
  },
  {
    id: 'M15',
    description: 'Public questions expose the answer key and explanation',
    file: 'content.ts',
    anchor: 'return { id: q.id, prompt: q.prompt, options: [...q.options] };',
    replacement: 'return { ...q, options: [...q.options] };',
    expected: 'game.test.ts and team-properties.test.ts: public view secret diffs',
  },
  {
    id: 'M16',
    description: 'First submitted vote becomes the TV decision before reveal',
    file: 'index.ts',
    anchor:
      "teams: publicTeams(state), decision: state.phase.id === 'reveal' ? state.decision : null,",
    replacement:
      "teams: publicTeams(state), decision: state.phase.id === 'reveal' ? state.decision : (Object.values(state.answers)[0]?.choice ?? null),",
    expected:
      'teams.test.ts: decision null before reveal; team-properties.test.ts: other-player choice diffs',
  },
  {
    id: 'M17',
    description: 'Phones expose the first opponent selection',
    file: 'index.ts',
    anchor: 'selected: answer?.choice ?? null,',
    replacement: 'selected: Object.values(state.answers)[0]?.choice ?? null,',
    expected:
      'game.test.ts and team-properties.test.ts: opponent choices cannot change another phone',
  },
  {
    id: 'M18',
    description: 'Final opponent team totals appear before the podium',
    file: 'index.ts',
    anchor:
      "score: withheld && !own ? (state.previousScores[team.members[0] ?? ''] ?? 0) : (state.teamScores[team.id] ?? 0),",
    replacement: 'score: state.teamScores[team.id] ?? 0,',
    expected: 'teams.test.ts: final opponent totals withheld; unrevealed group ranks',
  },
  {
    id: 'M19',
    description: 'First podium beat shows every final standing',
    file: 'index.ts',
    anchor: 'rows.filter((r) => r.rank <= 3 && r.rank >= 3 - state.podiumStep)',
    replacement: 'rows',
    expected: 'game.test.ts: server podium tiers; teams.test.ts: group podium tiers',
  },
  {
    id: 'M20',
    description: 'VIP end credits the unfinished question before producing results',
    file: 'index.ts',
    anchor: 'end: enterDone,',
    replacement: 'end: (state, now) => enterDone(enterReveal(state, now), now),',
    expected: 'teams.test.ts: unfinished end produces zero result credit',
  },
];
