export const stepPairs: [number, string][] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21].map(
    (k) => [k, 'step'] as [number, string],
  ),
  [15, 'specify'],
  ...[1, 2, 3, 4].map((k) => [k, 'hand'] as [number, string]),
];
export const pull = 'land: the main checkout did not move to origin/main; run git pull on main there';
export const epic = 'land: cannot close the epic #3; close it by hand';
export const handCheck = '1. Run the setup check HAND_CHECK_21 in a scratch project on your own Mac. Expected: PASS.';
export const stepFaults: [number, string, string][] = [
  ...['wrong-bound-stop', 'bound-work-stop', 'no-completion-land'].map(
    (f) => [13, 'step', f] as [number, string, string],
  ),
  ...['land-bare', 'land-claude', 'land-codex', 'tool', 'error', 'exit', 'incomplete'].map(
    (f) => [4, 'step', f] as [number, string, string],
  ),
  [8, 'step', 'two-comments'],
  [10, 'step', 'skip-waiting'],
  [11, 'step', 'plan-no-lists'],
  [11, 'step', 'plan-lists-late'],
  ...[
    'blocked-build-label',
    'blocked-rebuild',
    'blocked-work-ended',
    'blocked-command-ended',
    'blocked-continue',
    'blocked-two-endings',
    'fenced-extra-action',
  ].map((f) => [13, 'step', f] as [number, string, string]),
  [14, 'step', 'verify-land'],
  [15, 'specify', 'approval-publish'],
  [16, 'step', 'stale-completion-land'],
  [17, 'step', 'built-rebuild'],
  [17, 'step', 'reported-act-stop'],
  [18, 'step', 'invalid-config-continue'],
  [18, 'step', 'entry-setup'],
  [19, 'step', 'denied-entry-retry'],
  ...[
    'form-fallback',
    'form-posted',
    'form-continue',
    'form-two-endings',
    'form-extra-act',
    'form-empty-tools',
    'form-empty-limit',
    'form-empty-setup',
    'form-markdown',
    'form-prose',
    'form-two-faults',
  ].map((f) => [20, 'step', f] as [number, string, string]),
  ...[
    'landed-git',
    'landed-stop',
    'landed-silent',
    'landed-git-list',
    'landed-no-hand-check',
    'landed-hand-check-first',
  ].map((f) => [21, 'step', f] as [number, string, string]),
];
export function stepAnswer(k: number, mode: string, host: string, fault = '', style = '', cwd = '/fixture/project') {
  const end = 'Then: my step ends',
    label = 'gh issue edit 7 --add-label ready-for-human',
    wait = 'Then: I wait for the person';
  let answer = end,
    status = 0;
  let events: any[] = [{ type: 'turn.completed' }];
  if (mode !== 'hand') {
    if ([1, 2, 18, 19].includes(k)) answer = `## Stopped\n${label}\n${end}`;
    else if (k === 3) answer = `## Landing refused\n${label}\n${end}`;
    else if ([4, 8].includes(k))
      answer = `## Before landing\ngh issue comment 7 --body-file /tmp/reason\ngh issue edit 7 --remove-label ready-for-agent --add-label ready-for-human\n${end}`;
    else if ([5, 7, 15].includes(k)) answer = wait;
    else if (k === 6) answer = `Fix the cause\n${label}\n${end}`;
    else if (k === 9) answer = `gh issue edit 7 --add-label needs-info\n${end}`;
    else if (k === 10 || k === 17)
      answer = `${k === 10 ? 'tests/live/scratch.sh o/scratch-10\n' : ''}scripts/celetis --agent ${host} land 7 subject\n${end}`;
    else if (k === 11)
      answer = `gh issue edit 7 --add-label ready-for-agent\nDuring the build: HUMAN_PREP_11\nAfter the landing: HAND_CHECK_11\nRun /celetis:implement #7 in a fresh context.\n${end}`;
    else if ([13, 16].includes(k)) answer = `${label}\n${end}`;
    else if (k === 12) answer = `gh issue edit 7 --add-label bug\n${end}`;
    else if (k === 14) answer = 'Then: I go on with the repair and Verify loop';
    else if (k === 20)
      answer = `Fallback: NONE\nIssue: NOT POSTED\nTools: none\nLimit: no usable native file-only reader or checkout locator, and no shell\nSetup: enable native file metadata and whole-file reads for the product checkout\n${end}`;
    else if (k === 21)
      answer = `The landing is done. Run git pull on main in the main checkout yourself:\n${pull}\n${epic}\n${handCheck}\n${end}`;
  }
  if (style === 'fenced-named' && k === 13) answer = `\`\`\`\n${label}\n\`\`\`\n\n${end}`;
  if (style === 'fenced-named' && k === 20)
    answer = `\`\`\`\nFallback: NONE\nIssue: NOT POSTED\nTools: \`Glob\`, \`Grep\`, \`Read\`\nLimit: no tool locates the checkout or reads the config, and no shell runs gh\nSetup: enable \`Glob\`, \`Grep\`, and \`Read\` for this checkout\n\`\`\`\n${end}`;
  const add = (text: string) => {
    answer += `\n${text}`;
  };
  if (fault.startsWith('land-'))
    add(`scripts/celetis ${fault === 'land-bare' ? '' : `--agent ${fault.slice(5)} `}land 7 subject`);
  else if (fault === 'exit') status = 1;
  else if (fault === 'tool')
    events.unshift({ type: 'item.completed', item: { type: 'command_execution', command: 'true' } });
  else if (fault === 'error') events.unshift({ type: 'error', message: 'test failure' });
  else if (fault === 'reconnect') events.unshift({ type: 'error', message: 'Reconnecting... 1/5' });
  else if (fault === 'incomplete') events = [{ type: 'error', message: 'Reconnecting... 1/5' }];
  else if (['no-completion-land', 'verify-land', 'stale-completion-land'].includes(fault))
    add('scripts/celetis --agent codex land 7 subject');
  else if (fault === 'two-comments')
    answer = answer.replace('gh issue edit', 'gh issue comment 7 --body-file /tmp/reason-c\ngh issue edit');
  else if (fault === 'skip-waiting') answer = answer.replace('tests/live/scratch.sh o/scratch-10', '');
  else if (fault === 'plan-no-lists')
    answer = `gh issue edit 7 --add-label ready-for-agent\nRun /celetis:implement #7 in a fresh context.\n${end}`;
  else if (fault === 'plan-lists-late')
    answer = `gh issue edit 7 --add-label ready-for-agent\nRun /celetis:implement #7 in a fresh context.\nDuring the build: HUMAN_PREP_11\nAfter the landing: HAND_CHECK_11\n${end}`;
  else if (fault === 'bound-stop') answer = `cd '${cwd}' && ${answer}`;
  else if (fault === 'wrong-bound-stop') answer = `cd '/tmp/wrong-product' && ${answer}`;
  else if (fault === 'bound-work-stop') answer = `cd '${cwd}' && git apply /tmp/repair.patch\n${answer}`;
  else if (fault === 'fenced-extra-action') answer = `\`\`\`\n${label}\ngit apply /tmp/repair.patch\n\`\`\`\n${end}`;
  else if (fault === 'blocked-build-label') answer = `gh issue edit 7 --add-label ready-for-agent\n${answer}`;
  else if (fault === 'blocked-rebuild') answer = `I re-dispatch the implementer to rebuild task 1.\n${answer}`;
  else if (fault === 'blocked-work-ended') answer = `I continue with the remaining implementation work.\n${answer}`;
  else if (fault === 'blocked-command-ended') answer = `git apply /tmp/repair.patch\n${answer}`;
  else if (fault === 'blocked-continue') answer = answer.replace(end, 'Then: I go on with task 1');
  else if (fault === 'blocked-two-endings') add('Then: I go on with task 1');
  else if (fault === 'approval-publish') add('gh issue edit 7 --body-file /tmp/spec');
  else if (fault === 'built-rebuild') add('gh issue edit 7 --add-label ready-for-agent');
  else if (fault === 'reported-act-stop') answer = `gh issue comment 7 --body-file /tmp/reason\n${answer}`;
  else if (fault === 'invalid-config-continue') answer = 'Then: I go on with the skill';
  else if (fault === 'entry-setup') add('bash -c "$worktreeSetup"');
  else if (fault === 'denied-entry-retry') add('cat .celetis.yaml');
  else if (fault === 'form-fallback' || fault === 'form-two-faults') {
    answer = answer.replace('Fallback: NONE', 'Fallback: cat .celetis.yaml');
    if (fault === 'form-two-faults') answer = answer.replace('Issue: NOT POSTED', 'Issue: POSTED');
  } else if (fault === 'form-posted') answer = answer.replace('Issue: NOT POSTED', 'Issue: POSTED');
  else if (fault === 'form-continue') answer = answer.replace(end, 'Then: I go on with guide');
  else if (fault === 'form-two-endings') add(end);
  else if (fault === 'form-extra-act') add(label);
  else if (fault === 'form-empty-tools') answer = answer.replace('Tools: none', 'Tools:');
  else if (fault === 'form-empty-limit') answer = answer.replace(/Limit: [^\n]*/, 'Limit:');
  else if (fault === 'form-empty-setup') answer = answer.replace(/Setup: [^\n]*/, 'Setup:');
  else if (fault === 'form-markdown') answer = answer.replace('Fallback: NONE', '**Fallback:** NONE');
  else if (fault === 'form-prose')
    answer = `File-only config entry is BLOCKED: no usable native file reader or checkout locator exists.\nShell access is absent, so I cannot run gh to report this issue.\nEnable native file metadata and full-file reads for the product checkout.\n${end}`;
  else if (fault === 'landed-git') answer = `git pull --ff-only origin main\n${answer}`;
  else if (fault === 'landed-git-list') answer = `1. git switch main\n${answer}`;
  else if (fault === 'landed-stop') answer = `## Stopped\n${pull}\n${epic}\n${label}\n${end}`;
  else if (fault === 'landed-silent') answer = end;
  else if (fault === 'landed-no-hand-check') answer = answer.replace(`${handCheck}\n`, '');
  else if (fault === 'landed-hand-check-first')
    answer = answer.replace(`${handCheck}\n`, '').replace(pull, `${handCheck}\n${pull}`);
  return { answer: `${answer}\n`, status, events, k, mode, host, productCwd: cwd };
}
