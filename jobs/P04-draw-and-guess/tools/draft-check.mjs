// Remount the real controller against the same authoritative turn and SDK storage scope.
export async function draftChecks({ evaluate, settle, button, check, typeGuess, currentDraft }) {
  const remount = async () => {
    await evaluate('p04.remountPhone()');
    await settle();
  };
  const start = await evaluate('p04.info().sent.length');
  await typeGuess('my unsent drawing guess');
  await remount();
  const unsent = await currentDraft();
  check(
    unsent === 'my unsent drawing guess',
    'Unsent guess must survive a same-turn phone remount',
  );
  check(
    (await evaluate('p04.info().sent.length')) === start,
    'Restoring a draft must never submit it',
  );
  await evaluate('p04.advance(1000)');
  await button('Guess');
  await remount();
  const accepted = await currentDraft();
  check(accepted === '', 'An acknowledged guess must not return after remount');

  await evaluate('p04.advance(1000); p04.hold(true)');
  await typeGuess('old accepted guess');
  await button('Guess');
  await typeGuess('new typing during acknowledgement');
  await remount();
  const newer = await currentDraft();
  check(
    newer === 'new typing during acknowledgement',
    'Hydrating an old accepted receipt must preserve newer typing',
  );
  const end = await evaluate('p04.info().sent.length');
  check(end === start + 2, 'Remount must not duplicate any in-flight submission');
  await evaluate('p04.hold(false); p04.ack()');
  await settle();
  return { unsent, accepted, newer, automaticallySent: end - start - 2 };
}
