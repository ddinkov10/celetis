import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTRACT, check, readDocument } from './contract.ts';
import { test } from './test-support.ts';

const TEXT = readFileSync(new URL('./fixtures/contract-1.json', import.meta.url), 'utf8');
const good = () => JSON.parse(TEXT);
const bad = (change: any) => {
  const doc = good();
  change(doc);
  return check(doc);
};
const PR = { number: 9, url: 'https://example.test/pull/9', draft: false, checks: 'pass', review: null };
const row = (index: any, fields: any) => (d: any) => {
  Object.assign(d.issues[index], fields);
};

test('the example of the spec is a document of contract 1', () => {
  assert.equal(CONTRACT, 1);
  assert.deepEqual(check(good()), []);
  assert.deepEqual(readDocument(TEXT), { doc: good(), failures: [], isOtherContract: false });
});

const RULES: any[] = [
  [
    'tracker',
    (d: any) => {
      delete d.tracker;
    },
  ],
  [
    'tracker',
    (d: any) => {
      d.tracker = '';
    },
  ],
  [
    'flow.lanes',
    (d: any) => {
      d.flow.lanes = [];
    },
  ],
  [
    'flow.lanes.Bug',
    (d: any) => {
      d.flow.lanes.Bug = ['triage'];
    },
  ],
  [
    'flow.lanes.chore',
    (d: any) => {
      d.flow.lanes.chore = [];
    },
  ],
  [
    'flow.lanes.chore[1]',
    (d: any) => {
      d.flow.lanes.chore[1] = 'do-it';
    },
  ],
  [
    'flow.stages',
    (d: any) => {
      delete d.flow.stages;
    },
  ],
  [
    'flow.stages[0].name',
    (d: any) => {
      d.flow.stages[0].name = 7;
    },
  ],
  [
    'flow.stages[1].steps[0]',
    (d: any) => {
      d.flow.stages[1].steps[0] = 'review';
    },
  ],
  [
    'flow.lanes.chore[2]',
    (d: any) => {
      d.flow.lanes.chore.push('triage');
    },
  ],
  [
    'flow.stages[2].steps[1]',
    (d: any) => {
      d.flow.stages[2].steps.push('triage');
    },
  ],
  [
    'flow.steps.review',
    (d: any) => {
      d.flow.steps.review = {};
    },
  ],
  [
    'flow.steps.plan.gate',
    (d: any) => {
      d.flow.steps.plan.gate = 'you';
    },
  ],
  [
    'flow.steps.plan.hint',
    (d: any) => {
      d.flow.steps.plan.hint = 7;
    },
  ],
  [
    'noRun',
    (d: any) => {
      d.noRun = false;
    },
  ],
  [
    'noRun',
    (d: any) => {
      d.noRun = '';
    },
  ],
  [
    'runner',
    (d: any) => {
      d.runner = 'on';
    },
  ],
  [
    'issues',
    (d: any) => {
      d.issues = {};
    },
  ],
  [
    'issues[0]',
    (d: any) => {
      d.issues[0] = 430;
    },
  ],
  ['issues[0].number', row(0, { number: '430' })],
  ['issues[0].number', row(0, { number: 0 })],
  ['issues[0].number', row(0, { number: 2 ** 53 })],
  ['issues[1].number', row(1, { number: 430 })],
  ['issues[0].title', row(0, { title: null })],
  ['issues[0].url', row(0, { url: 'javascript:alert(1)' })],
  ['issues[0].type', row(0, { type: 'epic' })],
  ['issues[0].step', row(0, { step: 'review' })],
  ['issues[0].step', row(0, { step: null })],
  ['issues[0].step', row(0, { state: 'stuck', step: null })],
  ['issues[0].started', row(0, { started: 'yes' })],
  ['issues[0].urgent', row(0, { urgent: 1 })],
  ['issues[0].updatedAt', row(0, { updatedAt: 'yesterday' })],
  ['issues[2].closedAt', row(2, { closedAt: null })],
  ['issues[0].path', row(0, { state: 'dirty' })],
  ['issues[0].path', row(0, { state: 'dirty', path: 'lane' })],
  ['issues[1].reason', row(1, { reason: null })],
  ['issues[1].reason', row(1, { reason: '' })],
  ['issues[1].act', row(1, { act: 7 })],
  ['issues[0].pr', row(0, { pr: 9 })],
  ['issues[0].pr.number', row(0, { pr: { ...PR, number: 0 } })],
  ['issues[0].pr.url', row(0, { pr: { ...PR, url: 'ftp://x' } })],
  ['issues[0].pr.draft', row(0, { pr: { ...PR, draft: 'no' } })],
  ['issues[0].pr.checks', row(0, { pr: { ...PR, checks: 'green' } })],
  ['issues[0].pr.review', row(0, { pr: { ...PR, review: 'ok' } })],
  [
    'agents',
    (d: any) => {
      d.agents = [];
    },
  ],
  [
    'agents.Claude',
    (d: any) => {
      d.agents = { Claude: { available: true, cause: null } };
    },
  ],
  [
    'agents.claude.available',
    (d: any) => {
      d.agents = { claude: { cause: null } };
    },
  ],
  [
    'agents.claude.available',
    (d: any) => {
      d.agents = { claude: { available: 1, cause: null } };
    },
  ],
  [
    'agents.claude.cause',
    (d: any) => {
      d.agents = { claude: { available: false, cause: '' } };
    },
  ],
  [
    'agents.claude.cause',
    (d: any) => {
      d.agents = { claude: { available: false, cause: null } };
    },
  ],
  [
    'agents.claude.cause',
    (d: any) => {
      d.agents = { claude: { available: true, cause: 'x' } };
    },
  ],
  [
    'defaultAgent',
    (d: any) => {
      d.agents = { claude: { available: true, cause: null } };
      d.defaultAgent = 'opencode';
    },
  ],
  [
    'defaultAgent',
    (d: any) => {
      d.defaultAgent = 7;
    },
  ],
  [
    'defaultAgent',
    (d: any) => {
      d.defaultAgent = 'Claude';
    },
  ],
];
RULES.forEach(([place, change], index) => {
  test(`rule ${index}: a bad ${place} is refused at its place`, () => {
    const failures = bad(change);
    assert.ok(failures.length > 0 && (failures[0] as any).startsWith(`${place}: `), failures.join('\n'));
  });
});

test('a failure names the place and the rule, and each failure has its own line', () => {
  assert.deepEqual(bad(row(0, { state: 'waiting' })), ['issues[0].state: "waiting" is not a state of contract 1']);
  assert.deepEqual(
    bad((d: any) => {
      d.contract = 2;
      d.tracker = 7;
    }),
    ['the data has contract 2; this board reads contract 1'],
  );
  assert.deepEqual(
    bad((d: any) => {
      delete d.contract;
    }),
    ['contract: is not an integer'],
  );
  assert.deepEqual(check([]), ['document: is not an object']);
  assert.equal(
    bad((d: any) => {
      d.tracker = 7;
      d.issues[1].state = 'waiting';
    }).length,
    2,
  );
  for (const text of ['', 'npm warn\n{}'])
    assert.deepEqual(readDocument(text), { doc: null, failures: ['the data is not JSON'], isOtherContract: false });
});

test('a step is in a lane one time at most, and in the stages one time at most', () => {
  assert.deepEqual(
    bad((d: any) => {
      d.flow.lanes.chore.push('triage');
    }),
    ['flow.lanes.chore[2]: "triage" is in the lane two times'],
  );
  assert.deepEqual(
    bad((d: any) => {
      d.flow.stages[2].steps.push('triage');
    }),
    ['flow.stages[2].steps[1]: "triage" is in the stages two times'],
  );
  assert.deepEqual(
    bad((d: any) => {
      d.flow.stages[0].steps.push('triage');
    }),
    ['flow.stages[0].steps[1]: "triage" is in the stages two times'],
  );
});

test('readDocument tells a document of another contract from each other failure', () => {
  const read = (change: any) => {
    const doc = good();
    change(doc);
    return readDocument(JSON.stringify(doc));
  };
  assert.deepEqual(
    read((d: any) => {
      d.contract = 2;
      d.tracker = 7;
    }),
    { doc: null, failures: ['the data has contract 2; this board reads contract 1'], isOtherContract: true },
  );
  for (const change of [
    (d: any) => {
      d.tracker = 7;
    },
    (d: any) => {
      delete d.contract;
    },
    (d: any) => {
      d.contract = '2';
    },
  ])
    assert.equal(read(change).isOtherContract, false);
  assert.deepEqual(readDocument('[]'), { doc: null, failures: ['document: is not an object'], isOtherContract: false });
});

test('an absent field, a null, an unknown field, and a step outside the lane of its type pass', () => {
  assert.deepEqual(
    bad((d: any) => {
      delete d.flow.steps;
      delete d.noRun;
      delete d.runner;
      d.extra = 1;
    }),
    [],
  );
  assert.deepEqual(bad(row(1, { type: 'bug', step: 'specify', url: null, pr: PR, more: [] })), []);
  assert.deepEqual(bad(row(0, { type: null, started: null, urgent: false, act: null })), []);
});

test('agents and defaultAgent pass when absent, good, and fail at their place when bad', () => {
  assert.deepEqual(check(good()), []);
  assert.deepEqual(
    bad((d: any) => {
      d.agents = null;
      d.defaultAgent = null;
    }),
    [],
  );
  const withAgents = (d: any) => {
    d.agents = { claude: { available: true, cause: null }, opencode: { available: false, cause: 'binary missing' } };
    d.defaultAgent = 'claude';
  };
  assert.deepEqual(bad(withAgents), []);
});
