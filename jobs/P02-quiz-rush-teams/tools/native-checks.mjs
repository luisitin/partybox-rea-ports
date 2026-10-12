// Each call to check is a counted assertion; measurements are retained in the report.
export async function nativeChecks({ evaluate, settle, tap, viewport, screenshot, check }) {
  const call = async (source) => {
    await evaluate(source);
    await settle();
  };
  const info = () => evaluate('p02.info()');
  const correctCues = (value) => value.cues.filter((cue) => cue === 'correct').length;
  const shapes = ['Triangle', 'Diamond', 'Circle', 'Square'];
  const pads = '[role="group"][aria-label="Answer choices"] button';
  let before = await info();
  check(
    before.phase.id === 'talk' &&
      (await evaluate('document.querySelectorAll("button").length === 0')),
    'Team discussion has no answer buttons',
  );
  check(
    await evaluate(
      '(() => { const q=p02.info().phone.question; return q && q.options.length===4 && !("correct" in q) && !("explanation" in q) && document.body.textContent.includes(q.prompt); })()',
    ),
    'Discussion exposes choices without an answer key',
  );
  await call('p02.deadlineSoon()');
  await evaluate('new Promise(resolve => setTimeout(resolve, 300))');
  await settle();
  let current = await info();
  check(
    current.phase.id === 'question' && current.openedAt >= before.phase.deadline,
    'Real scheduled timer opens the answer clock',
  );
  check(
    JSON.stringify(
      await evaluate(
        `Array.from(document.querySelectorAll('${pads}'), b=>b.getAttribute('aria-label'))`,
      ),
    ) === JSON.stringify(shapes),
    'TV-room phones show four shape-only choices',
  );
  const correct = await evaluate('p02.key()');
  const other = (correct + 1) % 4;
  await evaluate('p02.hold(true)');
  // Consecutive native pointer taps; the second does not wait for an acknowledgement.
  await tap(pads, correct);
  await tap(pads, other);
  await settle();
  current = await info();
  check(
    current.sent.length === 1 &&
      current.answers.p1.choice === correct &&
      (await evaluate(
        `document.querySelectorAll('${pads}')[${correct}].getAttribute('aria-pressed')==='true'`,
      )),
    'Rapid second native tap cannot replace the first choice',
  );
  const accepted = current.answers.p1;
  await call('p02.advance(1400)');
  check(
    await evaluate(
      'Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Send again")',
    ),
    'Held acknowledgement offers an explicit resend',
  );
  await tap(
    'button',
    await evaluate(
      'Array.from(document.querySelectorAll("button")).findIndex(b=>b.textContent.trim()==="Send again")',
    ),
  );
  await settle();
  current = await info();
  check(
    current.sent.length === 2 &&
      current.sent.every((input) => input.choice === correct) &&
      JSON.stringify(current.answers.p1) === JSON.stringify(accepted),
    'Resend preserves both the immutable choice and its scoring time',
  );
  await call('p02.ack(); p02.remount()');
  check(
    (await evaluate(
      `Array.from(document.querySelectorAll('${pads}')).every(b=>b.disabled) && document.querySelectorAll('${pads}')[${correct}].getAttribute('aria-pressed')==='true'`,
    )) && (await info()).sent.length === 2,
    'Controller remount restores the accepted lock without resending',
  );
  before = await info();
  await call('p02.showPhone("p2"); p02.pause(); p02.advance(4000); p02.answer("p2", p02.key())');
  current = await info();
  check(
    current.phase.paused &&
      !current.answers.p2 &&
      (await evaluate(`Array.from(document.querySelectorAll('${pads}')).every(b=>b.disabled)`)),
    'Paused clock and forged answer are ignored',
  );
  await call('p02.resume()');
  current = await info();
  const deadlineShift = current.phase.deadline - before.phase.deadline;
  const startShift = current.openedAt - before.openedAt;
  check(
    deadlineShift >= 4000 &&
      deadlineShift === startShift &&
      current.phase.deadline - current.openedAt === before.phase.deadline - before.openedAt &&
      (await evaluate(`Array.from(document.querySelectorAll('${pads}')).every(b=>!b.disabled)`)),
    'Resume shifts the speed-scoring start and deadline together',
  );
  await call('p02.showPhone("p1")');
  await call('p02.finishAnswers("mixed")');
  current = await info();
  check(
    current.phase.id === 'reveal' &&
      current.phone.verdict.outcome === 'correct' &&
      (await evaluate(
        'document.body.textContent.includes("Your answer: correct!") && document.body.textContent.includes("team points") && document.body.textContent.includes("Team place")',
      )),
    'Team reveal shows personal receipt, team gain and rank',
  );
  const means = current.teams.map((team) => ({
    id: team.id,
    expected: Math.round(
      team.members.reduce((sum, id) => sum + current.verdicts[id].points, 0) / team.members.length,
    ),
    actual: current.teamGains[team.id],
    sameScore: team.members.every((id) => current.scores[id] === current.teamScores[team.id]),
  }));
  check(
    means.every((team) => team.expected === team.actual && team.sameScore),
    'Fixed teams receive the rounded eligible-member mean exactly once',
    means,
  );
  const cueCount = correctCues(current);
  check(cueCount === 1, 'First correct reveal celebrates once');
  await call('p02.remount()');
  check(
    correctCues(await info()) === cueCount,
    'Reveal remount suppresses a duplicate celebration',
  );
  await call('p02.until("done")');
  await call('p02.start("teams")');
  await call('p02.timer()');
  await tap(pads, await evaluate('p02.key()'));
  await call('p02.finishAnswers()');
  current = await info();
  check(
    current.sent.length === 1 &&
      current.phone.verdict.outcome === 'correct' &&
      correctCues(current) === cueCount + 1,
    'Same mounted controller accepts and celebrates a new match',
  );

  await call('p02.start("teams"); p02.timer(); p02.hold(true); p02.pause()');
  const retainedChoice = await evaluate('p02.key()');
  await tap(pads, retainedChoice);
  await call('p02.ack(); p02.advance(1500); p02.remount()');
  current = await info();
  check(
    current.phase.paused &&
      !current.answers.p1 &&
      current.sent.length === 1 &&
      (await evaluate(
        `document.querySelectorAll('${pads}')[${retainedChoice}].getAttribute('aria-pressed')==='true' && Array.from(document.querySelectorAll('${pads}')).every(b=>b.disabled)`,
      )),
    'Unconfirmed choice survives a refresh during a crossing pause without resending',
  );
  await call('p02.resume(); p02.advance(1400)');
  check(
    await evaluate(
      'Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Send again")',
    ),
    'Restored unconfirmed choice offers manual retry after resume',
  );
  await tap(
    'button',
    await evaluate(
      'Array.from(document.querySelectorAll("button")).findIndex(b=>b.textContent.trim()==="Send again")',
    ),
  );
  await settle();
  current = await info();
  check(
    current.sent.length === 2 &&
      current.sent.every((input) => input.choice === retainedChoice) &&
      current.answers.p1.choice === retainedChoice &&
      current.phone.submitted,
    'Restored manual retry sends only the original choice and receives authoritative lock',
  );
  await call('p02.remount(); p02.until("done"); p02.start("teams"); p02.timer()');
  check(
    (await info()).sent.length === 0 &&
      (await evaluate(
        `Array.from(document.querySelectorAll('${pads}')).every(b=>!b.disabled && b.getAttribute('aria-pressed')!=='true')`,
      )),
    'Finished-game pending drafts cannot preselect or send in a new match',
  );

  await call('p02.start("teams", true); p02.timer()');
  check(
    await evaluate(
      `(() => { const q=p02.info().phone.question; const buttons=Array.from(document.querySelectorAll('${pads}')); return document.body.textContent.includes(q.prompt) && buttons.length===4 && buttons.every((b,i)=>b.textContent.includes(q.options[i]) && b.getAttribute('aria-label').includes(q.options[i])); })()`,
    ),
    'Phone-only question includes prompt and all option text',
  );
  await call('p02.showPhone("spectator")');
  check(
    await evaluate(
      `document.querySelectorAll('button').length===0 && document.querySelectorAll('[aria-label="Answer choices"] li').length===4 && document.body.textContent.includes('Watching the quiz')`,
    ),
    'Spectator receives a complete read-only question',
  );

  await call('p02.start("tv-vote"); p02.timer()');
  const roomCorrect = await evaluate('p02.key()');
  await tap(pads, (roomCorrect + 1) % 4);
  const votes = [
    (roomCorrect + 1) % 4,
    roomCorrect,
    roomCorrect,
    roomCorrect,
    (roomCorrect + 1) % 4,
    roomCorrect,
    (roomCorrect + 1) % 4,
    roomCorrect,
  ];
  await call(`p02.vote(${JSON.stringify(votes)})`);
  current = await info();
  const roomVerdicts = Object.values(current.verdicts);
  check(
    current.phase.id === 'reveal' &&
      current.decision === roomCorrect &&
      roomVerdicts.length === 8 &&
      roomVerdicts.every((v) => v.outcome === 'correct' && v.points === roomVerdicts[0].points) &&
      current.teamGains.room === roomVerdicts[0].points,
    'Room plurality produces one shared result including dissenting voters',
  );
  await viewport('tv');
  await call('p02.showTv()');
  check(
    await evaluate(
      `document.querySelectorAll('button').length===0 && document.body.textContent.includes('The room chose ${shapes[roomCorrect]}')`,
    ),
    'TV reveals the chosen plurality and remains read-only',
  );
  await viewport('phone');
  await call('p02.start("tv-vote", true); p02.timer(); p02.timer()');
  current = await info();
  check(
    current.phase.id === 'reveal' &&
      current.decision === null &&
      Object.values(current.verdicts).every((v) => v.outcome === 'timeout' && v.points === 0) &&
      current.teamGains.room === 0 &&
      (await evaluate('document.body.textContent.includes("No votes")')),
    'No-vote deadline reveals a scoreless room timeout',
  );

  const layouts = await layoutChecks({ evaluate, settle, viewport });
  for (const mode of ['teams', 'tv-vote']) {
    const group = layouts.filter((layout) => layout.mode === mode);
    check(
      group.length === 18 && group.every((layout) => layout.fit),
      `${mode}: all six phases fit both phone modes and the TV`,
      group,
    );
  }
  check(
    layouts.every((layout) => layout.touch.every((size) => size.width >= 44 && size.height >= 44)),
    'Every rendered native control meets the 44px touch minimum',
  );
  await viewport('tv');
  await call('p02.start("teams"); p02.timer(); p02.showTv()');
  const type = await evaluate(
    `({body: Array.from(document.querySelectorAll('p, [aria-label="Answer choices"] li span, [aria-label="Teams"] h3')).map(e=>parseFloat(getComputedStyle(e).fontSize)), timer: parseFloat(getComputedStyle(document.querySelector('[role="timer"]')).fontSize)})`,
  );
  check(
    type.body.length > 0 && type.body.every((size) => size >= 32) && type.timer >= 96,
    'TV question body is at least 32px and timer at least 96px',
    type,
  );
  const tvImage = await screenshot();
  await viewport('phone');
  await call('p02.start("teams", true); p02.timer()');
  const phoneImage = await screenshot();
  return {
    layouts,
    images: [
      ['native-tv.png', tvImage],
      ['native-phone.png', phoneImage],
    ],
  };
}

async function layoutChecks({ evaluate, settle, viewport }) {
  const layouts = [];
  for (const mode of ['teams', 'tv-vote']) {
    for (const surface of ['phone-tv', 'phone-only', 'tv']) {
      await viewport(surface === 'tv' ? 'tv' : 'phone');
      for (const phase of ['talk', 'question', 'reveal', 'score', 'podium', 'done']) {
        await evaluate(
          `p02.start('${mode}', ${surface === 'phone-only'}); p02.until('${phase}'); ${surface === 'tv' ? 'p02.showTv()' : ''}`,
        );
        await settle();
        const measure = await evaluate(`(() => {
          const visible = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && !e.closest('[aria-hidden="true"]'); };
          const elements=Array.from(document.querySelectorAll('#root *')).filter(visible);
          const scrollers=elements.filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight>e.clientHeight+2).map(e=>({tag:e.tagName,overflow:e.scrollHeight-e.clientHeight}));
          const escaped=[];
          const walk=document.createTreeWalker(document.getElementById('root'),NodeFilter.SHOW_TEXT);
          for(let node=walk.nextNode();node;node=walk.nextNode()) {
            if(!node.textContent.trim() || !visible(node.parentElement))continue;
            const range=document.createRange();range.selectNodeContents(node);
            for(const r of range.getClientRects())if(r.width>0 && r.height>0 && (r.left< -1 || r.top< -1 || r.right>innerWidth+1 || r.bottom>innerHeight+1))escaped.push(node.textContent.trim());
          }
          const touch=elements.filter(e=>e.tagName==='BUTTON').map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};});
          const pageOverflow=document.documentElement.scrollWidth>innerWidth+1 || document.documentElement.scrollHeight>innerHeight+1;
          return {fit:!pageOverflow && !scrollers.length && !escaped.length,scrollers,escaped,touch,width:innerWidth,height:innerHeight};
        })()`);
        layouts.push({ mode, surface, phase, ...measure });
      }
    }
  }
  return layouts;
}
