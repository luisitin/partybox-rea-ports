// Visible behavior checks against root-generated public views, using real browser input events.
const power = 'section[aria-label="Power-ups"] button';
const pending = (state) =>
  state.powers.length === 2 && state.powers.every((button) => button.disabled);
const status = (state) => state.statuses.join(' ');
const retry = (state) => /not confirmed|retry|tap again/i.test(status(state));
const sending = (state) => /sending|waiting|confirming/i.test(status(state));
const sameInput = (actual, expected) =>
  actual &&
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([key, value]) => actual[key] === value);

export async function runInteractionScenarios(tools) {
  const { evaluate, readUi, waitFor, click, select, check, snapshot, views } = tools;
  for (const name of [
    'ranking',
    'rankingUpdated',
    'freezeUnavailable',
    'doubleAccepted',
    'freezeAccepted',
    'answerAccepted',
    'nextAccepted',
  ])
    if (!Object.hasOwn(views, name)) throw new Error(`Missing public interaction fixture: ${name}`);
  const reset = () => evaluate('window.harness.reset("ranking")');
  const setView = (name) => evaluate(`window.harness.setView(${JSON.stringify(name)})`);
  const advanceClock = () => evaluate('window.harness.setClock(window.harness.now + 4500)');

  await reset();
  let state = await readUi();
  check(
    'highest-scoring eligible rival is the initial target',
    state.target?.value === 'p7',
    state.target,
  );
  check(
    'target choices exclude self and finished seats',
    !state.target.options.some((option) => ['p1', 'p2'].includes(option.value)),
    state.target.options,
  );
  const leader = state.target.options.find((option) => option.value === 'p7');
  check(
    'leader choice shows full identity, score and place',
    leader?.text.includes('Alexandria Challenger p7') &&
      leader.text.includes('840') &&
      /1/.test(leader.text),
    leader,
  );
  // Change away and back so preservation tests a real onChange rather than an implicit default.
  await select('p3');
  await select('p7');
  await setView('rankingUpdated');
  state = await readUi();
  check(
    'explicit target survives a leaderboard reorder',
    state.target.value === 'p7' && state.target.options[0]?.value === 'p3',
    state.target,
  );
  check('picker changes do not send a power', state.sent.length === 0, state.sent);
  await snapshot('selection');
  await setView('freezeUnavailable');
  state = await readUi();
  check(
    'offline selected rival is removed and eligible leader becomes fallback',
    state.target.value === 'p3' && !state.target.options.some((option) => option.value === 'p7'),
    state.target,
  );
  await setView('rankingUpdated');
  state = await readUi();
  check(
    'returning rival does not resurrect an invalidated explicit selection',
    state.target.value === 'p3' && state.target.options.some((option) => option.value === 'p7'),
    state.target,
  );

  await reset();
  await click(power, '×2');
  state = await waitFor((next) => next.sent.length === 1, 'double request');
  check(
    'double sends the exact server input',
    sameInput(state.sent[0], { type: 'power', power: 'double', charge: 1 }),
    state.sent,
  );
  check(
    'pending double disables both powers and announces sending',
    pending(state) && sending(state),
    { powers: state.powers, statuses: state.statuses },
  );
  check(
    'double is not armed before authoritative acceptance',
    !state.text.includes('×2 armed'),
    state.statuses,
  );
  await click(power, '×2');
  await click(power, 'Freeze 3s');
  state = await readUi();
  check('repeated power taps send no duplicate while pending', state.sent.length === 1, state.sent);
  await snapshot('double-pending');
  await setView('rankingUpdated');
  state = await readUi();
  check(
    'unrelated score push does not confirm a pending double',
    pending(state) && !state.text.includes('×2 armed'),
    state.statuses,
  );
  await advanceClock();
  state = await waitFor(
    (next) => next.powers.some((button) => !button.disabled),
    'double retry window',
  );
  check(
    'unconfirmed double allows explicit retry after four seconds',
    retry(state),
    state.statuses,
  );
  await snapshot('double-retry');
  await click(power, '×2');
  state = await waitFor((next) => next.sent.length === 2, 'double retry request');
  check(
    'retry sends one additional double request',
    state.sent.every((input) => sameInput(input, { type: 'power', power: 'double', charge: 1 })),
    state.sent,
  );
  await setView('doubleAccepted');
  state = await waitFor(
    (next) => next.text.includes('×2 armed'),
    'authoritative double acceptance',
  );
  check(
    'accepted double is armed and cannot spend energy twice',
    pending(state) && !sending(state) && !retry(state),
    { powers: state.powers, statuses: state.statuses },
  );
  await snapshot('double-accepted');

  await reset();
  await select('p3');
  await select('p7');
  await click(power, 'Freeze 3s');
  state = await waitFor((next) => next.sent.length === 1, 'freeze request');
  check(
    'freeze sends the explicitly selected rival',
    sameInput(state.sent[0], { type: 'power', power: 'freeze', target: 'p7', charge: 1 }),
    state.sent,
  );
  check(
    'pending freeze disables powers and rival selection',
    pending(state) && state.target.disabled && sending(state),
    { target: state.target, powers: state.powers, statuses: state.statuses },
  );
  await click(power, 'Freeze 3s');
  state = await readUi();
  check('repeated freeze tap sends no duplicate', state.sent.length === 1, state.sent);
  await snapshot('freeze-pending');
  await setView('rankingUpdated');
  state = await readUi();
  check(
    'unrelated standings push retains pending freeze and target',
    pending(state) && state.target.value === 'p7' && sending(state),
    state.target,
  );
  await advanceClock();
  state = await waitFor(
    (next) => next.powers.some((button) => !button.disabled),
    'freeze retry window',
  );
  check(
    'unconfirmed freeze allows an explicit retry',
    retry(state) && !state.target.disabled,
    state.statuses,
  );
  await click(power, 'Freeze 3s');
  state = await waitFor((next) => next.sent.length === 2, 'freeze retry request');
  check(
    'freeze retry preserves rival and energy charge',
    state.sent.every((input) =>
      sameInput(input, { type: 'power', power: 'freeze', target: 'p7', charge: 1 }),
    ),
    state.sent,
  );
  await setView('freezeAccepted');
  state = await waitFor(
    (next) => pending(next) && !sending(next) && !retry(next),
    'authoritative freeze acceptance',
  );
  check(
    'accepted freeze removes the frozen rival from targets',
    !state.target.options.some((option) => option.value === 'p7'),
    state.target,
  );
  check(
    'accepted freeze announces confirmation from public state',
    /frozen|freeze.*confirmed|freeze.*applied|freeze.*sent/i.test(status(state)),
    state.statuses,
  );
  check('authoritative freeze does not send another request', state.sent.length === 2, state.sent);
  await snapshot('freeze-accepted');

  await reset();
  await select('p3');
  await select('p7');
  await click(power, 'Freeze 3s');
  await waitFor((next) => next.sent.length === 1, 'freeze before another request wins charge');
  await setView('doubleAccepted');
  state = await waitFor(
    (next) => next.text.includes('×2 armed'),
    'different power authoritative acceptance',
  );
  check(
    'energy decline confirms spending without attributing the last request kind',
    status(state).includes('Power used') &&
      state.text.includes('×2 armed') &&
      !/rival frozen|freeze (?:confirmed|applied|sent)/i.test(status(state)) &&
      state.sent.length === 1,
    { statuses: state.statuses, sent: state.sent },
  );

  await reset();
  await select('p3');
  await select('p7');
  await click(power, 'Freeze 3s');
  await waitFor((next) => next.sent.length === 1, 'freeze before rival disconnect');
  await setView('freezeUnavailable');
  state = await readUi();
  check(
    'rival disconnect without energy change does not confirm pending freeze',
    pending(state) && sending(state),
    state.statuses,
  );
  await advanceClock();
  state = await waitFor(
    (next) => next.powers.some((button) => !button.disabled),
    'disconnected rival retry window',
  );
  check(
    'rejected freeze allows another eligible rival after timeout',
    retry(state) && !state.target.disabled && state.target.value === 'p3',
    { target: state.target, statuses: state.statuses },
  );
  await select('p3');
  await click(power, 'Freeze 3s');
  state = await waitFor((next) => next.sent.length === 2, 'replacement rival freeze');
  check(
    'replacement freeze retains the same authoritative energy charge',
    sameInput(state.sent[1], { type: 'power', power: 'freeze', target: 'p3', charge: 1 }),
    state.sent,
  );
  await snapshot('freeze-disconnected-retry');

  await reset();
  const answer = views.answerAccepted.feedback?.answer;
  if (!answer || !views.ranking.question.options.includes(answer))
    throw new Error('Answer acceptance fixture must match an option in the ranking question.');
  await click('[aria-label="Choose an answer"] button', answer);
  state = await waitFor((next) => next.sent.length === 1, 'answer request');
  const expectedChoice = views.ranking.question.options.indexOf(answer);
  check(
    'answer submits the public question id/cursor and selected option',
    state.sent[0].type === 'answer' &&
      state.sent[0].questionId === views.ranking.question.id &&
      state.sent[0].index === views.ranking.question.index &&
      state.sent[0].choice === expectedChoice,
    state.sent,
  );
  check(
    'pending answer selects one option and disables duplicate answers',
    state.answers.every((button) => button.disabled) &&
      state.answers.filter((button) => button.selected).length === 1 &&
      sending(state),
    state.answers,
  );
  await click('[aria-label="Choose an answer"] button', answer);
  state = await readUi();
  check('repeat answer tap sends no duplicate', state.sent.length === 1, state.sent);
  await snapshot('answer-pending');
  await advanceClock();
  state = await waitFor(
    (next) => next.answers.every((button) => !button.disabled),
    'answer retry window',
  );
  check(
    'unconfirmed answer exposes retry without advancing cursor',
    retry(state) && state.answers.length === 4,
    state.statuses,
  );
  await click('[aria-label="Choose an answer"] button', answer);
  await waitFor((next) => next.sent.length === 2, 'answer retry request');
  await setView('answerAccepted');
  state = await waitFor(
    (next) => next.answers.length === 0 && next.text.includes('Next question'),
    'authoritative answer feedback',
  );
  check(
    'accepted answer replaces choices with actual public feedback',
    state.text.includes(answer) &&
      state.text.includes(views.answerAccepted.feedback.explanation) &&
      state.sent.length === 2,
    state.statuses,
  );
  await snapshot('answer-accepted');

  await evaluate('window.harness.reset("answerAccepted")');
  await click('[role="status"][data-correct] button');
  state = await waitFor((next) => next.sent.length === 1, 'Next request');
  check(
    'Next sends the authoritative answered cursor',
    sameInput(state.sent[0], { type: 'next', index: views.answerAccepted.answered }),
    state.sent,
  );
  check(
    'pending Next keeps feedback, disables its button and announces sending',
    state.next?.disabled && state.answers.length === 0 && sending(state),
    { next: state.next, statuses: state.statuses },
  );
  await click('[role="status"][data-correct] button');
  state = await readUi();
  check('repeat Next tap sends no duplicate', state.sent.length === 1, state.sent);
  await snapshot('next-pending');
  await advanceClock();
  state = await waitFor((next) => next.next && !next.next.disabled, 'Next retry window');
  check(
    'unconfirmed Next allows explicit retry while keeping feedback',
    retry(state) && state.answers.length === 0,
    state.statuses,
  );
  await click('[role="status"][data-correct] button');
  await waitFor((next) => next.sent.length === 2, 'Next retry request');
  await setView('nextAccepted');
  state = await waitFor(
    (next) => next.answers.length === 4 && next.next === null,
    'authoritative Next acceptance',
  );
  check(
    'accepted Next reveals the actual public next question and keeps score',
    state.text.includes(views.nextAccepted.question.prompt) &&
      views.nextAccepted.score === views.answerAccepted.score &&
      state.header.includes(String(views.nextAccepted.score)) &&
      state.sent.length === 2,
    { statuses: state.statuses, sent: state.sent },
  );
  await snapshot('next-accepted');

  await evaluate('window.harness.reset("departed")');
  state = await readUi();
  check(
    'returned permanent leaver watches retained score without input controls',
    state.text.includes('You left this race') &&
      state.text.includes('Left race') &&
      state.text.includes(String(views.departed.score)) &&
      state.answers.length === 0 &&
      state.powers.length === 0 &&
      state.target === null &&
      state.next === null &&
      state.sent.length === 0 &&
      state.cues.length === 0,
    { header: state.header, sent: state.sent, cues: state.cues },
  );
  await snapshot('departed');

  await evaluate('window.harness.reset("freezeVictim")');
  state = await readUi();
  check(
    'victim sees the named rival and cannot answer while frozen',
    status(state).includes(views.freezeVictim.frozenBy) &&
      status(state).includes('froze you') &&
      state.answers.length === 4 &&
      state.answers.every((button) => button.disabled),
    state.statuses,
  );
  await snapshot('freeze-victim');

  await reset();
  await click('[aria-label="Choose an answer"] button', answer);
  await waitFor((next) => next.sent.length === 1, 'answer before cue audit');
  await evaluate('new Promise(resolve=>setTimeout(resolve,150))');
  await setView('answerAccepted');
  state = await waitFor((next) => next.cues.length === 1, 'own correct verdict cue');
  const vibrationCount = state.vibrations.length;
  check('one accepted correct answer cues once', state.cues[0] === 'correct', state.cues);
  for (const name of ['answerAccepted', 'podiumAccepted', 'doneAccepted']) {
    // Space pushes beyond the SDK haptic dedup window, so it cannot mask a replay.
    await evaluate('new Promise(resolve=>setTimeout(resolve,150))');
    await setView(name);
    state = await readUi();
    check(
      `${name}: retained verdict does not replay sound or haptics`,
      state.cues.length === 1 && state.vibrations.length === vibrationCount,
      { cues: state.cues, vibrations: state.vibrations },
    );
  }
  check(
    'terminal stage keeps the last answer and explanation available',
    state.text.includes(views.doneAccepted.feedback.answer) &&
      state.text.includes(views.doneAccepted.feedback.explanation),
    state.text,
  );
  await snapshot('terminal-feedback');

  await reset();
  await setView('podiumAccepted');
  state = await waitFor((next) => next.cues.length === 1, 'direct answer-to-podium verdict');
  check(
    'a verdict first received with podium still cues once',
    state.cues[0] === 'correct' && state.text.includes(views.podiumAccepted.feedback.answer),
    state.cues,
  );
  await setView('doneAccepted');
  state = await readUi();
  check('direct podium verdict stays single on done', state.cues.length === 1, state.cues);
}
