export interface StepInput {
  k: number;
  mode: string;
  host: string;
  productCwd: string;
  answer: string;
  status: number;
  events: unknown[];
}
const pull = 'land: the main checkout did not move to origin/main; run git pull on main there';
const epic = 'land: cannot close the epic #3; close it by hand';
const label = '--add-label ready-for-human',
  built = '--remove-label ready-for-agent',
  wait = 'Then: I wait for the person';
const lands = [
  'scripts/celetis land 7',
  'scripts/celetis --agent claude land 7',
  'scripts/celetis --agent codex land 7',
];
export function checkStep(input: StepInput): { errors: string[]; recovered: number } {
  const { k, mode, host, productCwd, answer, status } = input,
    events = input.events as { type?: string; message?: string; item?: { type?: string } }[];
  if (status !== 0) return { errors: ['host command failed'], recovered: 0 };
  if (
    host === 'codex' &&
    (!events.length ||
      !events.some((event) => event.type === 'turn.completed') ||
      !events.every(
        (event) =>
          event.type !== 'turn.failed' &&
          (event.type !== 'error' || event.message?.startsWith('Reconnecting...')) &&
          (!event.type?.startsWith('item.') || ['agent_message', 'reasoning'].includes(event.item?.type ?? '')),
      ))
  )
    return { errors: ['missing completion, error, or unexpected tool event'], recovered: 0 };
  if (!answer.includes('Then:')) return { errors: ['no "Then:" line'], recovered: 0 };
  const errors: string[] = [],
    lines = answer
      .replace(/\n+$/, '')
      .split('\n')
      .filter((line) => line.trim() && !/^\s*```(bash|sh|shell)?\s*$/.test(line)),
    actions = lines.join('\n');
  const fail = (valid: boolean, error: string) => {
    if (!valid) errors.push(error);
  };
  if (`${k}:${mode}` === '8:step')
    fail((actions.match(/gh issue comment/g) ?? []).length === 1, 'not one gh issue comment');
  if (`${k}:${mode}` === '11:step') {
    const lists = lines.findLastIndex((line) => /HUMAN_PREP_11|HAND_CHECK_11/.test(line)),
      run = lines.findLastIndex((line) => line.includes('celetis:implement #7'));
    fail(lists >= 0 && run >= 0 && lists < run, 'the two lists are not before the implement line');
  }
  if (`${k}:${mode}` === '13:step') {
    const human = `gh issue edit 7 --add-label ready-for-human\nThen: my step ends`,
      quoted = `'${productCwd.replaceAll("'", "'\\''")}'`;
    fail(actions === human || actions === `cd ${quoted} && ${human}`, 'unexpected action in human-precondition stop');
  }
  if (`${k}:${mode}` === '20:step') {
    for (const text of ['Fallback: NONE', 'Issue: NOT POSTED', 'Then: my step ends'])
      fail(lines.includes(text), `missing "${text}"`);
    for (const text of ['Tools', 'Limit', 'Setup'])
      fail(
        lines.some((line) => new RegExp(`^${text}: .*\\S`).test(line)),
        `empty ${text} line`,
      );
    fail(lines.length === 6, 'not six lines');
  }
  if (`${k}:${mode}` === '21:step') {
    const rest = answer.replaceAll(pull, '').replaceAll(epic, '');
    fail(
      !/^\s*(([-*+>]|[0-9]+[.)])\s+)?[`$]?\s*(git|cd) |git -C|&& git/m.test(rest),
      'a command for the act of the maintainer',
    );
    const landed = lines.findLastIndex((line) => line.includes(pull) || line.includes(epic)),
      hand = lines.findIndex((line) => line.includes('HAND_CHECK_21'));
    fail(landed >= 0 && hand >= 0 && landed < hand, 'the check by hand is not after the land lines');
  }
  if (k >= 22 && k <= 33) {
    const apply = lines.filter((line) => /scripts\/celetis .*plugin-update apply(?: |$)/.test(line));
    fail(apply.length === (k === 24 ? 1 : 0), 'unauthorized or repeated update attempt');
    if (k === 24) {
      fail(
        apply[0] ===
          `scripts/celetis --agent ${host} plugin-update apply '/fixture/native home' '/fixture/plugin root' 'https://example.test/celetis.git' ${'1'.repeat(40)} ${'2'.repeat(40)}`,
        'update does not match offered identity',
      );
      for (const text of ['Attempt: HANDED OFF', 'Exit:', 'Setup:', 'Then: my step ends'])
        fail(answer.includes(text), `missing ${text}`);
      fail(!answer.includes('Then: I go on'), 'work continues after update handoff');
    } else {
      fail(
        answer.includes(
          [29, 30].includes(k)
            ? 'Decision: NEW RESPONSE REQUIRED'
            : k === 33
              ? 'Check: UNAVAILABLE'
              : 'Update: CONTINUE',
        ),
        'missing update decision',
      );
      fail(!/plugin-update check/.test(actions), 'repeated update check');
    }
    fail(!/kill |marketplace (update|upgrade)|plugin update/.test(actions), 'native update or consumer termination');
  }
  const expected = `scripts/celetis --agent ${host} land 7`,
    other = `scripts/celetis --agent ${host === 'claude' ? 'codex' : 'claude'} land 7`;
  const rules: Record<number, [string[], string[]]> = {
    1: [[label, '## Stopped'], [wait]],
    2: [
      [label, '## Stopped'],
      [wait, ...lands],
    ],
    3: [
      [label, '## Landing refused'],
      [wait, '## Stopped'],
    ],
    4: [
      [label, built, '## Before landing'],
      [wait, '## Stopped', ...lands],
    ],
    5: [[wait], [label]],
    6: [
      [label, 'Fix the cause'],
      [wait, '## Stopped'],
    ],
    7: [[wait], [label]],
    8: [
      [label, built, '## Before landing', 'gh issue comment'],
      [wait, '## Stopped', ...lands],
    ],
    9: [['--add-label needs-info'], ['ready-for-human']],
    10: [
      [expected, 'tests/live/scratch.sh o/scratch-10'],
      [label, wait, lands[0] ?? '', other, 'gh issue comment'],
    ],
    11: [
      ['--add-label ready-for-agent', 'HUMAN_PREP_11', 'HAND_CHECK_11', 'celetis:implement #7'],
      [label, '## Stopped', wait],
    ],
    12: [['--add-label bug'], [label, '## Stopped', wait]],
    13: [[], []],
    14: [['Then: I go on with'], [label, built, ...lands, '## Before landing']],
    15: [[wait], [label, '--body-file', 'celetis:plan #7']],
    16: [[label], [wait, '## Stopped', ...lands]],
    17: [[expected], ['gh issue comment', label, wait, lands[0] ?? '', other, '--add-label ready-for-agent']],
    18: [
      [label, '## Stopped'],
      [wait, ...lands, 'cat .celetis.yaml', 'git rev-parse', 'bash -c', 'Then: I go on with'],
    ],
    19: [
      [label, '## Stopped'],
      [wait, ...lands, 'cat .celetis.yaml', 'git rev-parse', 'bash -c', 'Then: I go on with'],
    ],
    20: [[], []],
    21: [
      [pull, epic, 'Then: my step ends', 'HAND_CHECK_21'],
      ['## Stopped', label, 'gh issue', wait, 'Then: I go on with', ...lands],
    ],
  };
  const [positive, negative] = mode === 'hand' ? [[], [label]] : (rules[k] ?? [[], []]);
  for (const text of positive) fail(answer.includes(text), `no "${text}"`);
  for (const text of negative) fail(!answer.includes(text), `has "${text}"`);
  return {
    errors,
    recovered: errors.length === 0 && host === 'codex' ? events.filter((event) => event.type === 'error').length : 0,
  };
}
