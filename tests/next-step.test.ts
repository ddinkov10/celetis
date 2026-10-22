import { expect, setDefaultTimeout } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { command, type Fixture, isolatedArgs, root, withFixture } from './lib/fixture.ts';

import { referenceTests } from './lib/reference.ts';

const { test, expected } = referenceTests('next-step');
setDefaultTimeout(25_000);

const entry = join(root, 'scripts/next-step.ts');
const usage = 'usage: scripts/celetis next-step <issue number> | --open | --json, e.g. scripts/celetis next-step 276\n';
const info = 'Answer the questions on the issue, then remove the label.';
const act = 'Do the human step (e.g. the hotfix ship checklist), then remove the label.';
function issue(number = 7, state = 'open', labels = '', body = '', comments: string[] = [], days = 0) {
  return {
    number,
    title: `Issue ${number}`,
    state,
    html_url: `https://github.com/o/r/issues/${number}`,
    labels: labels
      .split(',')
      .filter(Boolean)
      .map((name) => ({ name })),
    body: body || null,
    comments: comments.map((body) => ({ body })),
    updated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    closed_at: state === 'closed' ? new Date(Date.now() - days * 86400000).toISOString().replace(/\.\d+Z$/, 'Z') : null,
  };
}
function pr(
  number: number,
  branch: string,
  runs: unknown[] = [],
  statuses: string[] = [],
  reviews: [string, string][] = [],
  draft = false,
  reviewers: string[] = [],
  teams: string[] = [],
) {
  return {
    number,
    html_url: `https://github.com/o/r/pull/${number}`,
    head: { ref: branch, sha: `sha${number}` },
    draft,
    runs,
    statuses: statuses.map((state) => ({ state })),
    reviews: reviews.map(([login, state]) => ({ user: { login }, state })),
    requested_reviewers: reviewers.map((login) => ({ login })),
    requested_teams: teams.map((slug) => ({ slug })),
  };
}
const check = (status: string, conclusion: string | null) => ({ status, conclusion });
type Issue = ReturnType<typeof issue> & { pull_request?: unknown };
type State = { single?: Issue; issues?: Issue[]; prs?: ReturnType<typeof pr>[]; pageSize?: number; fail?: string };
async function resolver(f: Fixture, realPs = false) {
  await f.repository();
  await f.config('landing: merge\nworktreeSetup: touch "$NEXT_STEP_TEST_STATE/setup-ran"\n');
  await f.write('repo dir/.gitignore', '.claude/worktrees/\n');
  for (const args of [
    ['add', '.'],
    ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'base'],
  ])
    expect((await command('git', args, { cwd: f.repo, env: f.env })).code).toBe(0);
  const stateFile = await f.write('state.json', '{}');
  const log = join(f.dir, 'gh-log');
  await f.stub(
    'gh',
    String.raw`import {readFileSync,appendFileSync} from 'node:fs';
await Bun.stdin.text();
const args = process.argv.slice(2); appendFileSync(process.env.GH_LOG!,JSON.stringify(args)+'\n');
const s = JSON.parse(readFileSync(process.env.GH_STATE!,'utf8'));
if(args.shift() !== 'api') {console.error('HTTP 403: GitHub GraphQL is not available from Claude Code sessions');process.exit(1);}
const paginate=args.includes('--paginate'),slurp=args.includes('--slurp');
const endpoint=args.find(v=>!v.startsWith('-'))!;
const path=endpoint.split('?')[0].replace('repos/{owner}/{repo}/','');
if(s.fail==='all'||s.fail===path){console.error('HTTP 502');process.exit(1);}
const issues=s.issues??[],prs=s.prs??[];
let value, list=false, wrap=(x:any)=>x;
if(/^issues\/\d+\/comments$/.test(path)) {const n=Number(path.split('/')[1]);value=[...issues,...(s.single?[s.single]:[])].find(i=>i.number===n)?.comments??[];list=true;}
else if(/^issues\/\d+$/.test(path)){if(!s.single){console.error('no issue');process.exit(1);}value={...s.single,comments:s.single.comments.length};}
else if(path==='issues'){const q=new URLSearchParams(endpoint.split('?')[1]);value=issues.filter(i=>i.state===q.get('state')&&(!q.has('since')||i.updated_at>=q.get('since'))).map(i=>({...i,comments:i.comments.length}));list=true;}
else if(path==='pulls'){value=prs.map(({runs,statuses,reviews,...p})=>p);list=true;}
else if(/^commits\/.*\/check-runs$/.test(path)){value=prs.find(p=>p.head.sha===path.split('/')[1])?.runs??[];list=true;wrap=x=>({check_runs:x});}
else if(/^commits\/.*\/status$/.test(path)){value=prs.find(p=>p.head.sha===path.split('/')[1])?.statuses??[];list=true;wrap=x=>({statuses:x});}
else if(/^pulls\/\d+\/reviews$/.test(path)){value=prs.find(p=>p.number===Number(path.split('/')[1]))?.reviews??[];list=true;}
else {console.error('unexpected endpoint '+endpoint);process.exit(1);}
if(list&&(!paginate||!endpoint.includes('per_page=100'))){console.error('list needs pagination');process.exit(1);}
const pages=[];if(list){const size=s.pageSize??100;for(let i=0;i<value.length;i+=size)pages.push(wrap(value.slice(i,i+size)));if(!pages.length)pages.push(wrap([]));}
if(list&&!slurp){console.error('typed pagination needs --slurp');process.exit(1);}console.log(JSON.stringify(list?pages:value));`,
  );
  if (!realPs)
    await f.stub(
      'ps',
      `import {readFileSync} from 'node:fs'; const [flag,pid,output,field] = process.argv.slice(2); if(flag!=='-p'||output!=='-o'||field!=='command=')process.exit(2);let owner;try{owner=JSON.parse(readFileSync(process.env.PS_OWNER!,'utf8'));}catch{process.exit(1);}if(owner.fail){console.error('process query failed');process.exit(1);}if(String(owner.pid)!==pid)process.exit(1);console.log(owner.command);`,
    );
  const env = {
    ...f.env,
    PS_OWNER: join(f.dir, 'ps-owner'),
    PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
    GH_STATE: stateFile,
    GH_LOG: log,
    NEXT_STEP_TEST_STATE: f.dir,
  };
  const state = async (value: State) => {
    await writeFile(stateFile, JSON.stringify(value));
    await rm(log, { force: true });
  };
  const run = async (args: string[], cwd = f.repo, compare = true) => {
    const result = await f.bun(entry, args, { cwd, env });
    const calls = await readFile(log, 'utf8').catch(() => '');
    if (compare) {
      const old = await expected(f.dir, await readFile(stateFile, 'utf8'));
      expect(result.code).toBe(old.code);
      expect(result.stdout).toBe(old.stdout);
      expect(result.stderr).toBe(old.stderr);
    }
    return {
      ...result,
      calls: calls
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]),
    };
  };
  const json = async () => {
    const result = await run(['--json']);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    return JSON.parse(result.stdout);
  };
  const lane = async (name = '7-crash') => {
    const path = join(f.repo, '.claude/worktrees', name);
    expect((await command('git', ['worktree', 'add', '-qb', name, path], { cwd: f.repo, env })).code).toBe(0);
    return path;
  };
  return { state, run, json, lane, env, log };
}

const cases: [string, string, string, string[], string][] = [
  ['closed', 'wontfix', '', [], 'stop #7 is closed as wontfix.'],
  ['closed', 'bug', '', [], 'stop #7 is finished.'],
  ['closed', 'enhancement,ready-for-human', 'Spec: x', ['## Plan', '## Landing refused'], 'stop #7 is finished.'],
  ['closed', 'bug,wontfix', '', [], 'stop #7 is closed as wontfix.'],
  ['open', 'bug,needs-info', '', [], `stop #7 needs info. ${info}`],
  ['open', 'hotfix,ready-for-human', '', [], `stop #7 is ready-for-human. ${act}`],
  [
    'open',
    'enhancement,ready-for-human',
    'Spec: x',
    ['## Plan', '## Before landing'],
    `stop #7 is ready-for-human. ${act}`,
  ],
  [
    'open',
    'enhancement,ready-for-human',
    'Spec: x',
    ['## Plan', '## Landing refused'],
    `stop #7 is ready-for-human. ${act}`,
  ],
  ['open', 'epic', '', [], 'stop #7 is an epic. Each child runs its own flow.'],
  ['open', 'needs-triage', 'It breaks', [], 'run /celetis:triage #7'],
  ['open', 'enhancement', 'Intent: add X', [], 'run /celetis:feature #7'],
  ['open', 'enhancement', '', [], 'run /celetis:feature #7'],
  ['open', 'enhancement,needs-info', 'Intent: add X', [], `stop #7 needs info. ${info}`],
  ['open', 'bug', 'It breaks', [], 'run /celetis:bug #7'],
  ['open', 'chore', '', [], 'run /celetis:chore #7'],
  ['open', 'hotfix', '', [], 'run /celetis:hotfix #7'],
  ['open', 'enhancement', 'Spec: 2026-09-25', [], 'run /celetis:plan #7'],
  ['open', 'bug', '', ['## Root cause'], 'run /celetis:plan #7'],
  ['open', 'enhancement', 'Spec: x', ['see ## Plan'], 'run /celetis:plan #7'],
  ['open', 'enhancement', 'Spec: x', ['## Plan'], 'run /celetis:implement #7'],
  ['open', 'bug', '', ['## Root cause', '## Plan'], 'run /celetis:implement #7'],
  ['open', 'chore', '', ['## Landing refused'], 'run /celetis:chore #7'],
  ['open', 'enhancement', 'Spec: x', ['## Plan', '## Landing refused'], 'run /celetis:implement #7'],
  ['open', 'enhancement', 'Spec: x\n`y`', ['## Plan\n\n1. `a`'], 'run /celetis:implement #7'],
  ['open', 'enhancement', 'Intent: add X\nSpec: later', [], 'run /celetis:feature #7'],
];

test(
  'every resolver state and open-row precedence matches the baseline',
  withFixture(async (f) => {
    const s = await resolver(f);
    for (const [state, labels, body, comments, want] of cases) {
      const value = issue(7, state, labels, body, comments);
      await s.state({ single: value, issues: [value], pageSize: 1 });
      const resolveFinished = await s.run(['7']);
      expect(resolveFinished.code).toBe(0);
      expect(resolveFinished.stdout).toBe(`${want}\n`);
      if (state === 'closed' && labels === 'bug') expect(resolveFinished.stdout).toBe('stop #7 is finished.\n');
      expect(resolveFinished.calls.map((a) => a.find((v) => v.startsWith('repos/')))).toEqual([
        'repos/{owner}/{repo}/issues/7',
        ...(comments.length ? ['repos/{owner}/{repo}/issues/7/comments?per_page=100'] : []),
      ]);
      if (state === 'open') {
        await s.state({ issues: [value], pageSize: 1 });
        expect((await s.run(['--open'])).stdout).toBe(`7\t${want}\n`);
      }
    }
    await s.state({
      single: issue(7, 'open', 'bug', '', ['## Root cause', `## Plan\n${'x'.repeat(40000)}`]),
      pageSize: 1,
    });
    expect((await s.run(['7'])).stdout).toBe('run /celetis:implement #7\n');
    await s.state({ single: issue(7, 'open', 'chore') });
    expect((await s.run(['#7'])).stdout).toBe('run /celetis:chore #7\n');
    await s.state({
      issues: [
        issue(9, 'open', 'epic'),
        issue(7, 'open', 'needs-triage'),
        issue(8, 'open', 'enhancement', 'Spec: x', ['## Plan']),
      ],
    });
    expect((await s.run(['--open'])).stdout).toBe(
      '7\trun /celetis:triage #7\n8\trun /celetis:implement #8\n9\tstop #9 is an epic. Each child runs its own flow.\n',
    );
    await s.state({});
    expect((await s.run(['--open'])).stdout).toBe('');
    expect(await Bun.file(join(f.dir, 'setup-ran')).exists()).toBe(false);
  }),
);

test(
  'usage and config errors stop before GitHub or setup',
  withFixture(async (f) => {
    const s = await resolver(f);
    await s.state({ single: issue(7, 'open', 'chore') });
    for (const args of [[], ['abc'], ['7abc'], ['#'], ['7', '8'], ['--all'], ['--open', '7'], ['--json', '7']]) {
      const result = await s.run(args);
      expect(result).toMatchObject({ code: 2, stdout: '', stderr: usage, calls: [] });
    }
    for (const source of [null, 'landing: invalid\n']) {
      if (source === null) await rm(join(f.repo, '.celetis.yaml'));
      else await f.config(source);
      const result = await s.run(['7']);
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`${f.repo}/.celetis.yaml`);
      expect(result.calls).toEqual([]);
    }
    await f.config('landing: merge\n');
    expect(await Bun.file(join(f.dir, 'setup-ran')).exists()).toBe(false);
    const outside = await s.run(['7'], f.home);
    expect(outside.code).not.toBe(0);
    expect(outside.stdout).toBe('');
    expect(outside.calls).toEqual([]);
  }),
);

test(
  'dirty main and matching lanes keep refusal and landing precedence',
  withFixture(async (f) => {
    const s = await resolver(f);
    const lane = await s.lane();
    await s.state({ single: issue(7, 'open', 'bug'), issues: [issue(7, 'open', 'chore'), issue(8, 'open', 'chore')] });
    const stop = (path: string) => `stop the working tree is dirty: ${path}; commit or stash first\n`;
    await writeFile(join(lane, 'half-done.txt'), 'x');
    for (const cwd of [f.repo, lane]) {
      const result = await s.run(['7'], cwd);
      expect(result.stdout).toBe(stop(lane));
      expect(result.calls).toEqual([]);
    }
    expect((await s.run(['--open'])).stdout).toBe(`7\t${stop(lane)}8\trun /celetis:chore #8\n`);
    await f.write('repo dir/new.txt', 'dirty');
    for (const cwd of [f.repo, lane]) expect((await s.run(['7'], cwd)).stdout).toBe(stop(f.repo));
    expect((await s.run(['--open'], lane)).stdout).toBe(`7\t${stop(f.repo)}8\t${stop(f.repo)}`);
    expect((await s.json()).noRun).toBe(`The main checkout is dirty: ${f.repo}. Commit or stash first.`);
    await rm(join(f.repo, 'new.txt'));
    await rm(join(lane, 'half-done.txt'));
    expect((await s.run(['7'], lane)).stdout).toBe('run /celetis:bug #7\n');
    await mkdir(join(f.repo, 'sub'));
    expect((await s.run(['7'], join(f.repo, 'sub'))).stdout).toBe('run /celetis:bug #7\n');
    await rm(join(f.repo, 'sub'), { recursive: true });
    const other = await s.lane('17-other');
    await writeFile(join(other, 'half-done.txt'), 'x');
    expect((await s.run(['7'])).stdout).toBe('run /celetis:bug #7\n');
    await s.state({
      issues: [issue(7, 'open', 'enhancement,ready-for-human', 'Spec: x', ['## Plan', '## Landing refused'])],
    });
    await writeFile(join(lane, 'half-done.txt'), 'x');
    expect((await s.json()).issues[0]).toMatchObject({ state: 'dirty', path: lane, reason: 'landing refused' });
  }),
);

test(
  'landing locks recognize land.ts and reject stale or unrelated owners',
  withFixture(async (f) => {
    const s = await resolver(f);
    await s.state({
      single: issue(7, 'open', 'enhancement', 'Spec: x', ['## Plan']),
      issues: [issue(7, 'open', 'enhancement', 'Spec: x', ['## Plan']), issue(8, 'open', 'chore')],
    });
    const lock = join(f.repo, '.git/celetis-flow/land-7.lock');
    await mkdir(dirname(lock), { recursive: true });
    const land = await f.write('install dir/scripts/land.ts', `console.log('ready');setInterval(()=>{},1000);`);
    const child = spawn(process.execPath, [...isolatedArgs, land], { env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.once('data', () => resolve());
        child.once('error', reject);
      });
      await writeFile(lock, String(child.pid));
      await f.write('ps-owner', JSON.stringify({ pid: child.pid, command: `${process.execPath} ${land}` }));
      const result = await s.run(['7'], f.repo, false);
      expect(result).toMatchObject({ code: 0, stderr: '' });
      expect(result.stdout).toBe('stop the landing of #7 runs; wait until scripts/celetis land ends\n');
      expect(result.calls).toEqual([]);
      expect((await s.run(['--open'], f.repo, false)).stdout).toBe(
        '7\tstop the landing of #7 runs; wait until scripts/celetis land ends\n8\trun /celetis:chore #8\n',
      );
      await f.write(
        'ps-owner',
        JSON.stringify({ pid: child.pid, command: `${process.execPath} ${land.replace('.ts', '.sh')}` }),
      );
      expect((await s.run(['7'], f.repo, false)).stdout).toBe('run /celetis:implement #7\n');
      await f.write('ps-owner', JSON.stringify({ pid: child.pid, command: `${process.execPath} ${land}` }));
      await f.write('repo dir/dirty', 'x');
      expect((await s.run(['7'], f.repo, false)).stdout).toBe(
        `stop the working tree is dirty: ${f.repo}; commit or stash first\n`,
      );
      await rm(join(f.repo, 'dirty'));
    } finally {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => child.once('close', () => resolve()));
    }
    await rm(join(f.dir, 'ps-owner'));
    for (const value of [String(child.pid), String(process.pid), 'garbage', '']) {
      await writeFile(lock, value);
      await f.write('ps-owner', JSON.stringify({ pid: process.pid, command: '/runtime/other.ts' }));
      expect((await s.run(['7'])).stdout).toBe('run /celetis:implement #7\n');
    }
  }),
);

test(
  'board JSON keeps first PR, mixed checks and latest effective review',
  withFixture(async (f) => {
    const s = await resolver(f);
    const prs = [
      pr(21, 'fix/17-other'),
      pr(
        22,
        'chore/8-a',
        [check('in_progress', null), check('completed', 'timed_out')],
        [],
        [['a', 'CHANGES_REQUESTED']],
      ),
      pr(23, 'chore/8-b', [check('completed', 'success')], [], [['a', 'APPROVED']]),
      pr(24, 'chore/9-a', [check('completed', 'success')], ['pending'], [], true, ['r']),
      pr(25, 'chore/10-a', [check('completed', 'skipped')], ['success'], [['a', 'APPROVED']]),
      pr(26, 'chore/11-a', [check('queued', null)], ['error']),
      pr(27, 'chore/12-a'),
      pr(28, 'dependabot/npm_and_yarn/x-1.2.3', [check('completed', 'failure')], ['error'], [['a', 'APPROVED']]),
    ];
    await s.state({ issues: [7, 8, 9, 10, 11, 12].map((n) => issue(n, 'open', 'chore')), prs, pageSize: 1 });
    const result = await s.json();
    expect(result.noRun).toBe(null);
    expect(result.issues[0]).toEqual({
      number: 7,
      title: 'Issue 7',
      url: 'https://github.com/o/r/issues/7',
      type: 'chore',
      updatedAt: expect.any(String),
      closedAt: null,
      line: 'run /celetis:chore #7',
      state: 'ready',
      reason: null,
      act: null,
      pr: null,
    });
    expect(result.issues.map((i: any) => (i.pr ? [i.pr.number, i.pr.draft, i.pr.checks, i.pr.review] : null))).toEqual([
      null,
      [22, false, 'fail', 'changes'],
      [24, true, 'pending', 'required'],
      [25, false, 'pass', 'approved'],
      [26, false, 'fail', null],
      [27, false, null, null],
    ]);
    const paths = (await readFile(s.log, 'utf8'))
      .trim()
      .split('\n')
      .map((l) => (JSON.parse(l) as string[]).find((v) => v.startsWith('repos/')) as string);
    for (const n of [21, 22, 23, 24, 25, 26, 27])
      for (const path of [`commits/sha${n}/check-runs`, `commits/sha${n}/status`, `pulls/${n}/reviews`])
        expect(paths.filter((p) => p === `repos/{owner}/{repo}/${path}?per_page=100`)).toHaveLength(1);
    expect(paths.some((p) => p.includes('sha28'))).toBe(false);
    const reviewPrs = [
      pr(
        31,
        'chore/7-a',
        [],
        ['failure'],
        [
          ['a', 'CHANGES_REQUESTED'],
          ['a', 'APPROVED'],
        ],
      ),
      pr(
        32,
        'chore/8-a',
        [check('completed', 'success')],
        ['pending'],
        [
          ['a', 'APPROVED'],
          ['a', 'CHANGES_REQUESTED'],
        ],
      ),
      pr(
        33,
        'chore/9-a',
        [],
        [],
        [
          ['a', 'APPROVED'],
          ['b', 'CHANGES_REQUESTED'],
        ],
      ),
      pr(
        34,
        'chore/10-a',
        [],
        [],
        [
          ['a', 'APPROVED'],
          ['a', 'COMMENTED'],
        ],
        false,
        ['b'],
      ),
      pr(
        35,
        'chore/11-a',
        [],
        [],
        [
          ['a', 'CHANGES_REQUESTED'],
          ['a', 'DISMISSED'],
        ],
      ),
      pr(
        36,
        'chore/12-a',
        [],
        [],
        [
          ['a', 'CHANGES_REQUESTED'],
          ['a', 'DISMISSED'],
        ],
        false,
        [],
        ['t'],
      ),
      pr(37, 'chore/13-a', [], [], [], false, ['r']),
      pr(38, 'chore/14-a', [], [], [['a', 'COMMENTED']]),
    ];
    await s.state({
      issues: [7, 8, 9, 10, 11, 12, 13, 14].map((n) => issue(n, 'open', 'chore')),
      prs: reviewPrs,
      pageSize: 1,
    });
    expect((await s.json()).issues.map((i: any) => [i.pr.number, i.pr.checks, i.pr.review])).toEqual([
      [31, 'fail', 'approved'],
      [32, 'pending', 'changes'],
      [33, null, 'changes'],
      [34, null, 'approved'],
      [35, null, null],
      [36, null, 'required'],
      [37, null, 'required'],
      [38, null, null],
    ]);
    for (const conclusion of ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']) {
      await s.state({
        issues: [issue(7, 'open', 'chore')],
        prs: [pr(31, 'chore/7-a', [check('queued', null), check('completed', conclusion)])],
      });
      expect((await s.json()).issues[0].pr.checks).toBe('fail');
    }
  }),
);

test(
  'board refusal reasons use the last level-two heading',
  withFixture(async (f) => {
    const s = await resolver(f);
    const refusal = '## Landing refused\r\nland: PR #9 has a check that is not green (fail)';
    const suffixes = [
      [],
      ['I ran the job again.'],
      ['## Before landing', '## Landing refused'],
      ['### A note'],
      ['## Before landing'],
      ['## Stopped'],
      ['## Plan'],
      ['## Plan'],
      ['see ## Landing refused'],
      ['\n## Landing refused'],
    ];
    const issues = suffixes.map((tail, i) =>
      issue(7 + i, 'open', `${i === 1 ? 'chore' : i === 2 ? 'hotfix' : 'enhancement'},ready-for-human`, 'Spec: x', [
        ...(i === 7 || i === 8 || i === 9 ? [] : ['## Plan', refusal]),
        ...tail,
      ]),
    );
    issues.push(
      issue(17, 'open', 'enhancement,needs-info,ready-for-human', 'Spec: x', ['## Plan', refusal]),
      issue(18, 'open', 'enhancement', 'Spec: x', ['## Plan', refusal]),
      issue(19, 'closed', 'enhancement,ready-for-human', 'Spec: x', ['## Plan', refusal]),
    );
    await s.state({ issues, pageSize: 1 });
    const rows = (await s.json()).issues;
    expect(rows.map((i: any) => [i.number, i.state, i.reason])).toEqual([
      [7, 'blocked', 'landing refused'],
      [8, 'blocked', 'landing refused'],
      [9, 'blocked', 'landing refused'],
      [10, 'blocked', 'landing refused'],
      [11, 'blocked', 'ready for your step'],
      [12, 'blocked', 'ready for your step'],
      [13, 'blocked', 'ready for your step'],
      [14, 'blocked', 'ready for your step'],
      [15, 'blocked', 'ready for your step'],
      [16, 'blocked', 'ready for your step'],
      [17, 'blocked', 'needs info'],
      [18, 'ready', null],
      [19, 'done', null],
    ]);
    expect(rows[0]).toMatchObject({ line: `stop #7 is ready-for-human. ${act}`, act });
  }),
);

test(
  'closed window, pagination, metadata and non-issue filtering keep all rows',
  withFixture(async (f) => {
    const s = await resolver(f);
    const issues: Issue[] = [
      issue(7, 'open', 'chore', '', ['A note']),
      { ...issue(8, 'open', 'chore', '', ['A note']), pull_request: {} },
      issue(9, 'closed', 'bug'),
      { ...issue(10, 'closed', 'bug'), pull_request: {} },
      issue(11, 'closed', 'bug', '', [], 15),
      issue(12, 'open', 'epic'),
      issue(13, 'closed', 'bug,wontfix'),
    ];
    await s.state({ issues, pageSize: 1 });
    expect((await s.run(['--open'])).stdout).toBe(
      '7\trun /celetis:chore #7\n12\tstop #12 is an epic. Each child runs its own flow.\n',
    );
    const rows = (await s.json()).issues;
    expect(rows.map((i: any) => i.number)).toEqual([7, 9]);
    expect(rows[1]).toMatchObject({
      title: issues[2]?.title,
      url: issues[2]?.html_url,
      updatedAt: issues[2]?.updated_at,
      closedAt: issues[2]?.closed_at,
    });
    await s.state({
      issues: [
        issue(7, 'open', 'bug', '', ['## Root cause', '## Plan']),
        issue(8, 'open', 'chore'),
        issue(9, 'closed', 'bug'),
        issue(10, 'closed', 'bug'),
      ],
      prs: [
        pr(22, 'fix/17-other'),
        pr(
          21,
          'chore/8-a',
          [check('completed', 'success'), check('completed', 'failure')],
          [],
          [
            ['a', 'APPROVED'],
            ['b', 'CHANGES_REQUESTED'],
          ],
        ),
        pr(23, 'fix/7-a', [check('completed', 'success')], ['success', 'pending']),
      ],
      pageSize: 1,
    });
    expect((await s.run(['--open'])).stdout).toBe('7\trun /celetis:implement #7\n8\trun /celetis:chore #8\n');
    expect(
      (await s.json()).issues.map((i: any) => [
        i.number,
        i.line,
        i.pr?.number ?? null,
        i.pr?.checks ?? null,
        i.pr?.review ?? null,
      ]),
    ).toEqual([
      [7, 'run /celetis:implement #7', 23, 'pending', null],
      [8, 'run /celetis:chore #8', 21, 'fail', 'changes'],
      [9, 'stop #9 is finished.', null, null, null],
      [10, 'stop #10 is finished.', null, null, null],
    ]);
    const lane = await s.lane('12-batch');
    await writeFile(join(lane, 'dirty'), 'x');
    await s.state({
      issues: [
        issue(7, 'open', 'bug,needs-info'),
        issue(8, 'open', 'hotfix,ready-for-human'),
        issue(9, 'open', 'epic'),
        issue(10, 'closed', 'bug'),
        issue(11, 'closed', 'bug,wontfix'),
        issue(12, 'open', 'chore'),
      ],
    });
    expect((await s.json()).issues.map((i: any) => [i.number, i.state, i.reason, i.act, i.path ?? null])).toEqual([
      [7, 'blocked', 'needs info', info, null],
      [8, 'blocked', 'ready for your step', act, null],
      [10, 'done', null, null, null],
      [12, 'dirty', null, null, lane],
    ]);
  }),
);

test(
  'each GitHub read failure retains its diagnostic and stops output',
  withFixture(async (f) => {
    const s = await resolver(f);
    for (const fail of ['all', 'issues/7/comments'])
      for (const [arg, want] of [
        ['7', 'stop cannot read #7 from GitHub\n'],
        ['--open', 'stop cannot read the open issues from GitHub\n'],
        ['--json', 'stop cannot read the issues from GitHub\n'],
      ]) {
        await s.state({
          single: issue(7, 'open', 'chore', '', ['A note']),
          issues: [issue(7, 'open', 'chore', '', ['A note']), issue(8, 'open', 'chore')],
          fail,
        });
        const result = await s.run([arg as string]);
        expect(result.code).toBe(1);
        expect(result.stdout).toBe(want as string);
        expect(result.stderr).toContain('HTTP 502');
      }
    await s.state({});
    const missing = await s.run(['7']);
    expect(missing.code).toBe(1);
    expect(missing.stdout).toBe('stop cannot read #7 from GitHub\n');
    expect(missing.stderr).toContain('no issue');
    for (const fail of ['commits/sha21/check-runs', 'commits/sha21/status', 'pulls/21/reviews']) {
      await s.state({ issues: [issue(8, 'open', 'chore')], prs: [pr(21, 'chore/8-a'), pr(22, 'chore/8-b')], fail });
      const result = await s.run(['--json']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('stop cannot read the issues from GitHub\n');
      expect(result.stderr).toContain('HTTP 502');
    }
  }),
);

test(
  'duplicate issue pages keep the first record, as in the baseline',
  withFixture(async (f) => {
    const s = await resolver(f);
    await s.state({ issues: [issue(7, 'open', 'chore'), issue(7, 'open', 'bug')], pageSize: 1 });
    expect((await s.json()).issues[0]).toMatchObject({ type: 'chore', line: 'run /celetis:chore #7' });
  }),
);

test(
  'command imports expose main without discovery or output',
  withFixture(async (f) => {
    const probe = await f.write(
      'import.ts',
      `const resolver = await import(${JSON.stringify(entry)}); const scorer=await import(${JSON.stringify(join(root, 'scripts/capscore.ts'))}); console.log(JSON.stringify([typeof resolver.main,typeof scorer.main]));`,
    );
    expect(await f.bun(probe, [], { cwd: f.home })).toEqual({
      code: 0,
      stdout: '["function","function"]\n',
      stderr: '',
    });
  }),
);

test(
  'real process landing owner stays live until land.ts exits',
  withFixture(async (f) => {
    const s = await resolver(f, true);
    await s.state({
      single: issue(7, 'open', 'enhancement', 'Spec: x', ['## Plan']),
      issues: [issue(7, 'open', 'enhancement', 'Spec: x', ['## Plan']), issue(8, 'open', 'chore')],
    });
    const lock = join(f.repo, '.git/celetis-flow/land-7.lock');
    await mkdir(dirname(lock), { recursive: true });
    const land = await f.write('real install/scripts/land.ts', `console.log('ready');setInterval(()=>{},1000);`);
    const child = spawn(process.execPath, [...isolatedArgs, land], { env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.once('data', () => resolve());
        child.once('error', reject);
      });
      await writeFile(lock, String(child.pid));
      const result = await s.run(['7'], f.repo, false);
      expect(result).toMatchObject({
        code: 0,
        stderr: '',
        calls: [],
        stdout: 'stop the landing of #7 runs; wait until scripts/celetis land ends\n',
      });
      expect((await s.run(['--open'], f.repo, false)).stdout).toBe(
        '7\tstop the landing of #7 runs; wait until scripts/celetis land ends\n8\trun /celetis:chore #8\n',
      );
      await writeFile(lock, String(process.pid));
      expect((await s.run(['7'])).stdout).toBe('run /celetis:implement #7\n');
    } finally {
      const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
      child.kill('SIGTERM');
      await closed;
    }
    await writeFile(lock, String(child.pid));
    expect((await s.run(['7'])).stdout).toBe('run /celetis:implement #7\n');
  }),
);

test(
  'a failed landing process query leaves the lock unowned',
  withFixture(async (f) => {
    const s = await resolver(f);
    await s.state({ single: issue(7, 'open', 'enhancement', 'Spec: x', ['## Plan']) });
    await f.write('repo dir/.git/celetis-flow/land-7.lock', '777');
    await f.write('ps-owner', JSON.stringify({ pid: 777, command: '/runtime/land.ts', fail: true }));
    const result = await s.run(['7']);
    expect(result).toMatchObject({ code: 0, stdout: 'run /celetis:implement #7\n', stderr: '' });
  }),
);
