import assert from 'node:assert/strict';
import { test } from './test-support.ts';
import {
  age,
  agentOf,
  cleanCause,
  diffText,
  favicon,
  filterItems,
  gateOf,
  groupNeeds,
  keyOf,
  laneTrack,
  notice,
  pageTitle,
  pipeline,
  prFacts,
  runTitle,
  shortPath,
  signature,
  stateLabel,
  tail,
  tone,
} from './view.ts';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const ago = (seconds: any) => new Date(NOW - seconds * 1000).toISOString();
const FLOW: any = {
  lanes: {
    feature: ['triage', 'specify', 'plan', 'implement'],
    bug: ['triage', 'bug', 'plan', 'implement'],
    chore: ['triage', 'chore'],
    hotfix: ['triage', 'hotfix'],
  },
  stages: [
    { name: 'Triage', steps: ['triage'] },
    { name: 'Define', steps: ['specify', 'bug', 'chore', 'hotfix'] },
    { name: 'Plan', steps: ['plan'] },
    { name: 'Implement', steps: ['implement'] },
  ],
  steps: { plan: { gate: 'auto' }, implement: { gate: 'me', hint: 'It lands the change when the build is done.' } },
};
const card = (extra: any) => ({
  sessionId: null,
  number: 1,
  type: 'bug',
  step: null,
  state: null,
  agent: null,
  ...extra,
});

test('Needs you groups its cards by reason and keeps their order inside each group', () => {
  const cards = [
    card({ number: 1, step: 'plan' }),
    card({ number: 2, state: 'no-progress' }),
    card({ number: 3, state: 'waits' }),
    card({ number: 4, state: 'blocked' }),
    card({ number: 5, state: 'dirty-tree' }),
    card({ number: 6, state: 'something-new' }),
  ];
  assert.deepEqual(
    groupNeeds(cards).map((group) => [group.key, group.cards.map((c) => c.number)]),
    [
      ['answer', [3]],
      ['stuck', [2, 5]],
      ['input', [4]],
      ['ready', [1, 6]],
    ],
  );
  assert.deepEqual(groupNeeds([]), []);
});

test('the lane track marks the steps before the current one as done', () => {
  assert.deepEqual(
    (laneTrack(card({ type: 'feature', step: 'plan' }), FLOW) as any).map((s: any) => `${s.name}:${s.state}`),
    ['triage:done', 'specify:done', 'plan:now', 'implement:next'],
  );
  assert.deepEqual(
    (laneTrack(card({ type: 'bug', step: 'bug' }), FLOW) as any).map((s: any) => s.state),
    ['done', 'now', 'next', 'next'],
  );
  assert.deepEqual(
    (laneTrack(card({ type: 'chore', step: 'chore' }), FLOW) as any).map((s: any) => s.state),
    ['done', 'now'],
  );
  assert.equal(laneTrack(card({ type: 'feature', step: 'finish' }), FLOW), null);
  assert.equal(laneTrack(card({ type: 'feature', step: 'plan' }), null), null);
});

test('the title of Run adds the hint of the step', () => {
  assert.equal(
    runTitle('implement', FLOW),
    'Start the implement step. It lands the change when the build is done. (Enter)',
  );
  for (const flow of [FLOW, null]) assert.equal(runTitle('plan', flow), 'Start the plan step (Enter)');
  assert.deepEqual([gateOf(FLOW, 'plan'), gateOf(FLOW, 'triage'), gateOf(null, 'plan')], ['auto', null, null]);
});

test('a blocked card shows its reason', () => {
  const blocked = card({ number: 394, state: 'blocked', reason: 'needs info', title: 'T' });
  assert.equal(stateLabel(blocked), 'needs info');
  assert.deepEqual(notice(blocked), { title: '#394 needs info', body: 'T' });
  assert.deepEqual(
    groupNeeds([blocked]).map((group) => group.key),
    ['input'],
  );
});

test('the lane track is absent when the lane or the step is unknown', () => {
  assert.equal(laneTrack(card({ type: null, step: 'triage' }), FLOW), null);
  assert.equal(laneTrack(card({ type: 'feature', step: null }), FLOW), null);
  assert.equal(laneTrack(card({ type: 'chore', step: 'plan' }), FLOW), null);
});

test('a card with no type has no lane track when a lane has the key null', () => {
  assert.equal(laneTrack(card({ type: null, step: 'triage' }), { lanes: { null: ['triage', 'plan'] } }), null);
});

test('an agent shows its name and letter, and an unknown agent shows its own id', () => {
  assert.deepEqual(agentOf(card({ agent: 'claude' })), { name: 'Claude Code', letter: 'C' });
  assert.deepEqual(agentOf(card({ agent: 'aider' })), { name: 'aider', letter: 'A' });
  assert.equal(agentOf(card({})), null);
});

test('an agent whose id is a key that each object inherits shows its own id', () => {
  assert.deepEqual(agentOf(card({ agent: 'constructor' })), { name: 'constructor', letter: 'C' });
});

test('an age is coarse by default and counts seconds when it is fine', () => {
  assert.equal(age(ago(42), NOW), '42s');
  assert.equal(age(ago(4 * 60 + 3), NOW), '4m');
  assert.equal(age(ago(4 * 60 + 3), NOW, true), '4m 03s');
  assert.equal(age(ago(3 * 3600 + 5 * 60), NOW, true), '3h 05m');
  assert.equal(age(ago(3 * 86400), NOW), '3d');
  assert.equal(age(new Date(NOW + 5000).toISOString(), NOW), '0s');
  assert.equal(age('not a date', NOW), '');
});

test('a key is a valid identifier from the issue number, else from the session id', () => {
  assert.equal(keyOf(card({ number: 394 })), 'k-394');
  assert.equal(keyOf(card({ number: null, sessionId: 'a1b2.c3/d4' })), 'k-a1b2-c3-d4');
});

test('the tab names the repository and counts what needs you', () => {
  assert.equal(pageTitle('fwrh', 3), '(3) fwrh · Agent board');
  assert.equal(pageTitle('fwrh', 0), 'fwrh · Agent board');
});

test('the tone of the tab icon follows the most urgent column', () => {
  const columns = (needs: any, running: any) => ({ needs, running, idle: [], done: [] });
  assert.equal(tone(columns([card({})], [])), 'needs');
  assert.equal(tone(columns([], [card({ state: 'works' })])), 'works');
  assert.equal(tone(columns([], [card({ state: 'starts' })])), 'calm');
  assert.match(favicon('needs'), /^data:image\/svg\+xml,.*FF7A45/);
  assert.doesNotMatch(favicon('calm'), /circle/);
});

test('the input and ready groups of Needs you are compact rows, and the others are full cards', () => {
  const cards = [
    card({ number: 1, state: 'waits' }),
    card({ number: 2, state: 'no-progress' }),
    card({ number: 3, state: 'blocked' }),
    card({ number: 4, step: 'plan' }),
  ];
  assert.deepEqual(
    groupNeeds(cards).map((group) => [group.key, group.isCompact]),
    [
      ['answer', false],
      ['stuck', false],
      ['input', true],
      ['ready', true],
    ],
  );
});

test('a waiting session names what it waits for, and a session that herdr cannot read says so', () => {
  assert.deepEqual(
    ['dialog', 'turn', null].map((waitFor) => stateLabel(card({ state: 'waits', waitFor }))),
    ['waits for your answer', 'turn ended', 'waits for you'],
  );
  assert.equal(stateLabel(card({ state: 'unknown' })), 'state unknown');
  assert.equal(stateLabel(card({ state: 'no-progress' })), 'no progress');
});

test('the signature of a card changes with its column, its state, its step, and what it waits for', () => {
  const base = card({ state: 'waits', step: 'plan', waitFor: 'dialog' });
  const variants = [
    signature(base, 'needs'),
    signature(base, 'running'),
    signature({ ...base, waitFor: 'turn' }, 'needs'),
    signature({ ...base, step: 'implement' }, 'needs'),
    signature({ ...base, state: 'works' }, 'needs'),
  ];
  assert.equal(new Set(variants).size, variants.length);
  assert.equal(signature({ ...base, title: 'new title' }, 'needs'), variants[0]);
});

test('a notice names the issue and the reason, and its body is the title', () => {
  assert.deepEqual(notice(card({ number: 394, state: 'waits', waitFor: 'dialog', title: 'T' })), {
    title: '#394 waits for your answer',
    body: 'T',
  });
  assert.deepEqual(notice(card({ number: 395, state: 'waits', waitFor: 'turn' })), {
    title: '#395 ended its turn',
    body: '',
  });
  assert.deepEqual(notice(card({ number: null, sessionId: 's', state: 'waits', title: 'look at the logs' })), {
    title: 'A session waits for your answer',
    body: 'look at the logs',
  });
  assert.equal(notice(card({ number: 388, state: 'no-progress' })).title, '#388 made no progress');
  assert.equal(notice(card({ number: 37, step: 'plan' })).title, '#37 is ready to run plan');
});

test('the tail counts the cards below the fold by group, and is empty when none is', () => {
  assert.equal(
    tail([
      { short: 'stuck', count: 1 },
      { short: 'ready to run', count: 3 },
    ]),
    '4 more below: 1 stuck, 3 ready to run',
  );
  assert.equal(tail([]), '');
});

test('the diff text and the facts of a pull request', () => {
  assert.equal(diffText({ files: 3, added: 18, removed: 4 }), '+18 −4');
  assert.equal(diffText(null), '');
  assert.deepEqual(
    prFacts({ number: 9, url: 'u', draft: true, checks: 'fail', review: 'changes' }).map((fact) => [
      fact.kind,
      fact.text,
    ]),
    [
      ['pr', 'Draft PR #9'],
      ['checks-fail', 'CI failed'],
      ['review-changes', 'Changes requested'],
    ],
  );
  assert.deepEqual(
    prFacts({ number: 9, url: 'u', draft: false, checks: null, review: null }).map((fact) => fact.text),
    ['PR #9'],
  );
  assert.deepEqual(prFacts(null), []);
});

test('the pipeline places each issue at its step, holds the issues with no step, and keeps the sessions with no issue apart', () => {
  const cards = [
    card({ number: 1, step: 'triage' }),
    card({ number: 2, step: 'hotfix' }),
    card({ number: 3, step: 'specify' }),
    card({ number: 4, step: 'implement' }),
    card({ number: 5, step: null }),
    card({ number: null, sessionId: 's' }),
  ];
  const { stages, hold, loose } = pipeline(cards, FLOW);
  assert.deepEqual(
    stages.map((s) => [s.key, s.name, s.cards.map((c) => c.number)]),
    [
      [0, 'Triage', [1]],
      [1, 'Define', [2, 3]],
      [2, 'Plan', []],
      [3, 'Implement', [4]],
    ],
  );
  assert.deepEqual([hold.map((c) => c.number), loose.map((c) => c.sessionId)], [[5], ['s']]);
  const bare = pipeline(cards, null);
  assert.deepEqual(
    [bare.stages, bare.hold.map((c) => c.number), bare.loose.map((c) => c.sessionId)],
    [[], [1, 2, 3, 4, 5], ['s']],
  );
});

test('the search matches a number from its first digits, the exact number first, and words anywhere', () => {
  const item = (number: any, label: any, context = '') => ({ number, label, context });
  const items = [
    item(37, 'Run plan', 'Quality Gate'),
    item(388, 'Resume the implement session', 'toolbar buttons'),
    item(3, 'Run triage'),
    item(null, 'Read the issues again'),
  ];
  assert.deepEqual(
    filterItems(items, '#3').map((i) => i.number),
    [3, 37, 388],
  );
  assert.deepEqual(
    filterItems(items, '38').map((i) => i.number),
    [388],
  );
  assert.deepEqual(
    filterItems(items, 'run gate').map((i) => i.number),
    [37],
  );
  assert.deepEqual(
    filterItems(items, '  issues ').map((i) => i.label),
    ['Read the issues again'],
  );
  assert.equal(filterItems(items, '').length, 4);
});

test('a worktree path shows from .claude/worktrees on, and another path stays whole', () => {
  assert.equal(shortPath('/home/me/repo/.claude/worktrees/407-x'), '.claude/worktrees/407-x');
  assert.equal(shortPath('/home/me/repo'), '/home/me/repo');
});

test('palette search finds Run choices and the unavailable default action', () => {
  const items = [
    { number: 402, label: 'Run #402 with opencode', context: 'Issue 402' },
    { number: null, label: 'Default agent is read-only', context: '', isDisabled: true },
  ];
  assert.deepEqual(
    filterItems(items, 'opencode').map((i) => i.label),
    ['Run #402 with opencode'],
  );
  assert.deepEqual(filterItems(items, 'default agent'), [items[1]]);
});

test('a cause shows its first line with no controls and 200 characters at most', () => {
  assert.equal(cleanCause('binary missing\nsecond line'), 'binary missing');
  assert.equal(cleanCause('  \n  ok  \nmore'), 'ok');
  assert.equal(cleanCause('fi\x00rst\x7fline'), 'firstline');
  assert.equal(cleanCause(null), '');
  const long = `firstline ${'a'.repeat(500)}`;
  assert.equal(cleanCause(`${long}\nsecond`), long.slice(0, 200));
  assert.ok(!/[\u0000-\u001f\u007f]/.test(cleanCause('a\x01b\nc')));
});
