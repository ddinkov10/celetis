import { expect, setDefaultTimeout, test } from 'bun:test';
import { join } from 'node:path';
import { command, type Fixture, root, withFixture } from './lib/fixture.ts';

setDefaultTimeout(25_000);

const entry = join(root, 'scripts/capscore.ts');
const baseline = join(root, 'scripts/capscore.sh');
const profile = {
  schema: 1,
  runtime: 'fixture-desktop@1',
  slots: ['small', 'standard', 'large', 'largest'],
  reviewer: { rank: 1, effort: 'medium' },
};
const runtime = {
  schema: 1,
  runtime: 'fixture-desktop@1',
  models: profile.slots.map((id) => ({
    id,
    efforts: ['low', 'medium', 'high', 'xhigh', 'max', ...(id === 'largest' ? ['ultra'] : [])],
  })),
};
const digits = ['1', '0', '2', '1', '1', '0'];
const zero = ['0', '0', '0', '0', '0', '0'];
const all = ['2', '2', '2', '2', '2', '2'];

async function scorer(f: Fixture) {
  await f.repository();
  await f.config('landing: merge\n');
  const profilePath = await f.write('profile.json', JSON.stringify(profile));
  const runtimePath = await f.write('models.json', JSON.stringify(runtime));
  const env: NodeJS.ProcessEnv = {
    ...f.env,
    CELETIS_AGENT: undefined,
    CELETIS_HOST: undefined,
    CAP_EFFORT_BIAS: undefined,
    CAP_CURRENT_MODEL: undefined,
    OPENCODE: undefined,
    CAP_MODEL_PROFILE: profilePath,
    CAP_RUNTIME_MODELS: runtimePath,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_COUNT: '0',
  };
  const run = async (args: string[], extra: NodeJS.ProcessEnv = {}, cwd = f.repo) => {
    const options = { cwd, env: { ...env, ...extra } };
    const result = await f.bun(entry, args, options);
    const old = await command('/bin/bash', [baseline, ...args], options);
    expect(result.code).toBe(old.code);
    expect(result.stdout).toBe(old.stdout);
    if (result.code === 0) expect(result.stderr).toBe(old.stderr);
    return result;
  };
  const json = async (args: string[], extra: NodeJS.ProcessEnv = {}, cwd = f.repo) => {
    const result = await run([...args, '--json'], extra, cwd);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    return JSON.parse(result.stdout);
  };
  const error = async (args: string[], detail: string, extra: NodeJS.ProcessEnv = {}, cwd = f.repo) => {
    const result = await run(args, extra, cwd);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(detail);
  };
  return { run, json, error, env, profilePath, runtimePath };
}

const vectors: [string, string, number[], number, number][] = [
  ['band sum0 -> haiku/low', 'haiku/low', [0, 0, 0, 0, 0, 0], 0, 1],
  ['band sum3 top-haiku', 'haiku/low', [1, 1, 1, 0, 0, 0], 0, 1],
  ['band sum4 bottom-sonnet', 'sonnet/medium', [2, 1, 1, 0, 0, 0], 0, 1],
  ['band sum6 top-sonnet', 'sonnet/medium', [2, 1, 1, 1, 1, 0], 0, 1],
  ['band sum7 bottom-opus', 'opus/high', [2, 1, 2, 1, 1, 0], 0, 1],
  ['band sum9 top-opus', 'opus/high', [2, 2, 2, 2, 1, 0], 0, 1],
  ['band sum10 opus/xhigh', 'opus/xhigh', [2, 2, 2, 2, 2, 0], 0, 1],
  ['band sum11 opus/xhigh', 'opus/xhigh', [2, 2, 2, 2, 2, 1], 0, 1],
  ['band sum12 -> fable/max', 'fable/max', [2, 2, 2, 2, 2, 2], 0, 1],
  ['X=2 floor -> opus/high', 'opus/high', [0, 0, 0, 0, 0, 2], 0, 1],
  ['V=2 floor -> effort high', 'haiku/high', [0, 2, 0, 0, 0, 0], 0, 1],
  ['X=2 no-lower at sum10', 'opus/xhigh', [2, 2, 2, 1, 1, 2], 0, 1],
  ['b2 verify-gates example', 'sonnet/xhigh', [1, 0, 1, 1, 1, 0], 2, 1],
  ['b2 type-lanes example', 'opus/max', [2, 2, 2, 1, 1, 0], 2, 1],
  ['b2 at sum10 -> opus/max', 'opus/max', [2, 2, 2, 2, 2, 0], 2, 1],
  ['sum12 keeps fable/max +b2', 'fable/max', [2, 2, 2, 2, 2, 2], 2, 1],
  ['b2 attempt3 no fable/max<12', 'fable/xhigh', [2, 2, 2, 2, 2, 0], 2, 3],
  ['attempt2 effort +1', 'sonnet/high', [2, 1, 1, 0, 0, 0], 0, 2],
  ['attempt3 model+1 effort>=hi', 'opus/high', [2, 1, 1, 0, 0, 0], 0, 3],
  ['attempt3 from haiku', 'sonnet/high', [0, 0, 0, 0, 0, 0], 0, 3],
  ['attempt4 -> STOP', 'STOP', [0, 0, 0, 0, 0, 0], 0, 4],
  ['model clamps at fable', 'fable/high', [2, 1, 2, 1, 1, 0], 0, 3],
];

test(
  'all internal score vectors keep their exact portable result',
  withFixture(async (f) => {
    const s = await scorer(f);
    for (const [, want, ds, bias, attempt] of vectors) {
      const value = await s.json([
        ...ds.map(String),
        '--bias',
        String(bias),
        '--attempt',
        String(attempt),
        '--agent',
        'claude',
      ]);
      expect(want === 'STOP' ? value.status : `${value.dispatch.model}/${value.dispatch.effort}`).toBe(
        want === 'STOP' ? 'stop' : want,
      );
    }
    const internal = await s.run(['--test']);
    expect(internal.code).toBe(0);
    expect(internal.stdout).toContain('27/27 passed');
  }),
);

test(
  'portable schema, host selection, bias and reviewer routing stay exact',
  withFixture(async (f) => {
    const s = await scorer(f);
    expect(await s.run(digits)).toEqual({
      code: 0,
      stdout: 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh\n',
      stderr: '',
    });
    const claude = await s.json(digits);
    expect(claude).toEqual({
      schema: 1,
      digits: { J: 1, V: 0, B: 2, N: 1, S: 1, X: 0 },
      bias: 2,
      attempt: 1,
      sum: 5,
      status: 'ready',
      host: 'claude',
      rank: 1,
      effort: 'xhigh',
      dispatch: { rank: 1, model: 'sonnet', effort: 'xhigh', runtime: null, reviewer: false },
      line: 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → sonnet/xhigh',
    });
    for (const env of [
      { CELETIS_HOST: 'codex' },
      { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'celetis-flow.host', GIT_CONFIG_VALUE_0: 'codex' },
      { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'celetis-flow.agent', GIT_CONFIG_VALUE_0: 'codex' },
      {
        CELETIS_AGENT: 'claude',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'celetis-flow.host',
        GIT_CONFIG_VALUE_0: 'codex',
      },
    ])
      expect(await s.json(digits, env)).toEqual(claude);
    const codex = await s.json(['--agent', 'codex', ...digits]);
    expect(codex).toEqual({
      ...claude,
      host: 'codex',
      dispatch: { rank: 1, model: 'standard', effort: 'xhigh', runtime: 'fixture-desktop@1', reviewer: false },
      line: 'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → standard/xhigh',
    });
    expect(await s.json(digits, { CELETIS_AGENT: 'codex' })).toEqual(codex);
    expect(await s.json(['--agent', 'claude', ...digits], { CELETIS_AGENT: 'codex' })).toEqual(claude);
    await f.config('landing: merge\nhost: codex\n');
    expect(await s.json(digits)).toEqual(codex);
    for (const [args, env, want] of [
      [[...zero, '--bias', '0'], {}, 'haiku/low'],
      [[...digits], { CAP_EFFORT_BIAS: '0' }, 'sonnet/medium'],
      [[...digits, '--bias', '1'], { CAP_EFFORT_BIAS: '0' }, 'sonnet/high'],
      [[...zero, '--bias', '0', '--reviewer'], {}, 'sonnet/medium'],
      [['0', '0', '0', '0', '0', '2', '--bias', '1'], {}, 'opus/xhigh'],
      [['0', '2', '0', '0', '0', '0', '--bias', '1'], {}, 'haiku/xhigh'],
    ] as [string[], NodeJS.ProcessEnv, string][]) {
      const value = await s.json(['--agent', 'claude', ...args], env);
      expect(`${value.dispatch.model}/${value.dispatch.effort}`).toBe(want);
    }
    expect((await s.json(['--agent', 'codex', ...zero, '--bias', '0', '--reviewer'])).dispatch).toEqual({
      rank: 1,
      model: 'standard',
      effort: 'medium',
      runtime: 'fixture-desktop@1',
      reviewer: true,
    });
    expect((await s.json(['--agent', 'codex', ...all, '--reviewer'])).dispatch).toMatchObject({
      rank: 3,
      effort: 'max',
    });
  }),
);

test(
  'main profiles, explicit profiles and parent model preserve lookup precedence',
  withFixture(async (f) => {
    const s = await scorer(f);
    const config = (slots = profile.slots, key = profile.runtime) =>
      `landing: merge\ncodexProfiles:\n  ${key}:\n    slots: ${JSON.stringify(slots)}\n    reviewer: {rank: 1, effort: medium}\n`;
    const env = { CAP_MODEL_PROFILE: undefined };
    await f.config(config());
    const explicit = await s.json(['--agent', 'codex', ...digits]);
    expect(await s.json(['--agent', 'codex', ...digits], env)).toEqual(explicit);
    await command('git', ['worktree', 'add', '-qb', 'lane', join(f.dir, 'lane')], { cwd: f.repo, env: f.env });
    await f.write('lane/.celetis.yaml', config(['small', 'large', 'standard', 'largest']));
    await f.write('repo dir/subfolder/.keep', '');
    for (const cwd of [join(f.dir, 'lane'), join(f.repo, 'subfolder')])
      expect(await s.json(['--agent', 'codex', ...digits], env, cwd)).toEqual(explicit);
    const other = await f.write(
      'env-profile.json',
      JSON.stringify({ ...profile, slots: ['small', 'large', 'standard', 'largest'] }),
    );
    expect((await s.json(['--agent', 'codex', ...digits], { CAP_MODEL_PROFILE: other })).dispatch.model).toBe('large');
    expect(
      await s.json(['--agent', 'codex', ...digits, '--profile', s.profilePath], { CAP_MODEL_PROFILE: other }),
    ).toEqual(explicit);
    await s.error(['--agent', 'codex', ...digits, '--profile', ''], '--profile');
    await s.error(['--agent', 'codex', ...digits], '--profile', { CAP_MODEL_PROFILE: '' });
    await f.config(config(profile.slots, 'fixture-cli@1'));
    await s.error(['--agent', 'codex', ...digits], 'fixture-desktop@1', env);
    await f.config(config(['small']));
    await s.error(['--agent', 'codex', ...digits], 'codexProfiles.fixture-desktop@1.slots', env);
    await f.config(config(['small', 'standard', 'large', 'unavailable']));
    await s.error(['--agent', 'codex', ...digits], 'unavailable', env);
    await f.config(config());
    const noMedium = await f.write(
      'no-medium.json',
      JSON.stringify({
        ...runtime,
        models: runtime.models.map((m) => ({ ...m, efforts: m.efforts.filter((e) => e !== 'medium') })),
      }),
    );
    await s.error(['--agent', 'codex', ...digits, '--runtime-models', noMedium], 'medium', env);
    await s.error(['--agent', 'codex', ...digits], '--runtime-models', { ...env, CAP_RUNTIME_MODELS: '' });
    for (const source of ['landing: merge\n', 'landing: merge\ncodexProfiles: {}\n']) {
      await f.config(source);
      const score = await s.json(['--agent', 'codex', ...digits], env);
      expect(score.digits).toEqual({ J: 1, V: 0, B: 2, N: 1, S: 1, X: 0 });
      expect(score.dispatch).toMatchObject({ model: null, effort: 'xhigh' });
      expect(score.line).toBe('CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → inherit/xhigh');
    }
    for (const file of ['', join(f.dir, 'missing'), await f.write('bad-runtime', 'not json')])
      expect(
        (
          await s.json(['--agent', 'codex', ...digits, '--runtime-models', file || s.runtimePath], {
            ...env,
            CAP_RUNTIME_MODELS: file,
          })
        ).dispatch.model,
      ).toBe(null);
    expect((await s.json(['--agent', 'codex', ...zero, '--bias', '0', '--reviewer'], env)).dispatch).toEqual({
      rank: 1,
      model: null,
      effort: 'medium',
      runtime: null,
      reviewer: true,
    });
    expect((await s.json(['--agent', 'codex', ...digits], env, join(f.dir, 'lane'))).dispatch.model).toBe(null);
    await f.config('invalid: [\n');
    await s.error(['--agent', 'codex', ...digits], '.celetis.yaml', env);
    await f.write('repo dir/.celetis.yaml', 'landing: merge\n');
    await s.error(['--agent', 'codex', ...digits], '--profile', env, f.home);
    await f.stub('bun', `await Bun.write(process.env.BUN_CALLED!, 'called');process.exit(99);`);
    expect(
      await s.json(
        ['--agent', 'codex', ...digits],
        { PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`, BUN_CALLED: join(f.dir, 'bun-called') },
        f.home,
      ),
    ).toEqual(explicit);
    expect(await Bun.file(join(f.dir, 'bun-called')).exists()).toBe(false);
    await import('node:fs/promises').then((fs) => fs.rm(join(f.repo, '.celetis.yaml')));
    await s.error(['--agent', 'codex', ...digits], '.celetis.yaml', env);
  }),
);

const retries: [string, string[], number, boolean, number, string, unknown[][]][] = [
  [
    'parent',
    digits,
    2,
    false,
    1,
    'medium',
    [
      [1, 'xhigh', 1, null, 'xhigh'],
      [1, 'max', 1, null, 'max'],
      [2, 'xhigh', 2, null, 'max'],
    ],
  ],
  [
    'repeated',
    ['2', '2', '1', '1', '2', '1'],
    2,
    false,
    1,
    'medium',
    [
      [2, 'max', 2, 'large', 'max'],
      [2, 'max', 2, 'large', 'max'],
      [3, 'xhigh', 3, 'large', 'max'],
    ],
  ],
  [
    'repeated-zero',
    ['2', '2', '1', '1', '2', '1'],
    0,
    false,
    1,
    'medium',
    [
      [2, 'high', 2, 'large', 'high'],
      [2, 'xhigh', 2, 'large', 'xhigh'],
      [3, 'high', 3, 'large', 'xhigh'],
    ],
  ],
  [
    'middle',
    digits,
    1,
    false,
    1,
    'medium',
    [
      [1, 'high', 1, 'standard', 'high'],
      [1, 'xhigh', 1, 'standard', 'xhigh'],
      [2, 'high', 2, 'standard', 'xhigh'],
    ],
  ],
  [
    'single',
    digits,
    2,
    false,
    1,
    'medium',
    [
      [1, 'xhigh', 1, 'standard', 'xhigh'],
      [1, 'max', 1, 'standard', 'max'],
      [2, 'xhigh', 2, 'standard', 'max'],
    ],
  ],
  [
    'distinct',
    ['2', '2', '1', '1', '2', '1'],
    2,
    false,
    1,
    'medium',
    [
      [2, 'max', 2, 'large', 'max'],
      [2, 'max', 2, 'large', 'max'],
      [3, 'xhigh', 3, 'largest', 'xhigh'],
    ],
  ],
  [
    'reviewer',
    digits,
    1,
    true,
    2,
    'medium',
    [
      [1, 'high', 2, 'large', 'high'],
      [1, 'xhigh', 2, 'large', 'xhigh'],
      [2, 'high', 2, 'large', 'xhigh'],
    ],
  ],
  [
    'top-reviewer',
    ['2', '2', '1', '1', '2', '1'],
    2,
    true,
    3,
    'xhigh',
    [
      [2, 'max', 3, 'largest', 'xhigh'],
      [2, 'max', 3, 'largest', 'xhigh'],
      [3, 'xhigh', 3, 'largest', 'xhigh'],
    ],
  ],
];

test(
  'Codex retry floors follow the applied model and reviewer clamp',
  withFixture(async (f) => {
    const s = await scorer(f);
    for (const [kind, ds, bias, reviewer, rank, effort, want] of retries) {
      const slots = kind.startsWith('repeated')
        ? ['small', 'standard', 'large', 'large']
        : kind === 'middle'
          ? ['small', 'standard', 'standard', 'largest']
          : kind === 'single'
            ? ['standard', 'standard', 'standard', 'standard']
            : profile.slots;
      const file = await f.write(`${kind}.json`, JSON.stringify({ ...profile, slots, reviewer: { rank, effort } }));
      const values = [];
      for (const attempt of ['1', '2', '3']) {
        const value = await s.json(
          [
            '--agent',
            'codex',
            ...ds,
            '--bias',
            String(bias),
            '--attempt',
            attempt,
            ...(reviewer ? ['--reviewer'] : []),
            ...(kind === 'parent' ? [] : ['--profile', file]),
          ],
          kind === 'parent' ? { CAP_MODEL_PROFILE: undefined } : {},
        );
        values.push([value.rank, value.effort, value.dispatch.rank, value.dispatch.model, value.dispatch.effort]);
      }
      expect(values).toEqual(want);
    }
    const repeated = join(f.dir, 'repeated.json');
    const noMax = await f.write(
      'no-max.json',
      JSON.stringify({
        ...runtime,
        models: runtime.models.map((m) =>
          m.id === 'large' ? { ...m, efforts: ['low', 'medium', 'high', 'xhigh'] } : m,
        ),
      }),
    );
    await s.error(
      [
        '--agent',
        'codex',
        '2',
        '2',
        '1',
        '1',
        '2',
        '1',
        '--attempt',
        '3',
        '--profile',
        repeated,
        '--runtime-models',
        noMax,
      ],
      'large/max',
    );
    expect((await s.json(['--agent', 'codex', ...all, '--profile', repeated])).dispatch.model).toBe('large');
    const top = join(f.dir, 'top-reviewer.json');
    expect((await s.json(['--agent', 'codex', ...zero, '--reviewer', '--profile', top])).dispatch).toMatchObject({
      rank: 3,
      effort: 'xhigh',
    });
  }),
);

test(
  'invalid profiles and runtime allowlists fail before a result',
  withFixture(async (f) => {
    const s = await scorer(f);
    const cases: [string, unknown, string, string][] = [
      ['short', { ...profile, slots: ['small', 'standard', 'large'] }, '--profile', 'four'],
      ['unavailable', { ...profile, slots: ['small', 'standard', 'large', 'unavailable'] }, '--profile', 'unavailable'],
      ['ultra', { ...profile, reviewer: { rank: 1, effort: 'ultra' } }, '--profile', 'reviewer'],
      ['max-floor', { ...profile, reviewer: { rank: 1, effort: 'max' } }, '--profile', 'reviewer'],
      ['float-rank', { ...profile, reviewer: { rank: 1.5, effort: 'medium' } }, '--profile', 'reviewer'],
      ['other-runtime', { ...runtime, runtime: 'fixture-cli@1' }, '--runtime-models', 'runtime'],
      [
        'duplicate',
        { ...runtime, models: [...runtime.models, runtime.models[0]] },
        '--runtime-models',
        'runtime allowlist',
      ],
      [
        'no-xhigh',
        { ...runtime, models: runtime.models.map((m) => ({ ...m, efforts: m.efforts.filter((e) => e !== 'xhigh') })) },
        '--runtime-models',
        'xhigh',
      ],
      [
        'no-medium',
        { ...runtime, models: runtime.models.map((m) => ({ ...m, efforts: m.efforts.filter((e) => e !== 'medium') })) },
        '--runtime-models',
        'medium',
      ],
      ['empty-models', { ...runtime, models: [] }, '--runtime-models', 'runtime allowlist'],
      [
        'duplicate-effort',
        { ...runtime, models: [{ id: 'small', efforts: ['low', 'low'] }] },
        '--runtime-models',
        'runtime allowlist',
      ],
      ['bad-id', { ...runtime, models: [{ id: 'bad id', efforts: ['low'] }] }, '--runtime-models', 'runtime allowlist'],
    ];
    for (const [name, value, flag, detail] of cases)
      await s.error(
        ['--agent', 'codex', ...digits, flag, await f.write(`${name}.json`, JSON.stringify(value))],
        detail,
      );
    for (const flag of ['--profile', '--runtime-models']) {
      await s.error(['--agent', 'codex', ...digits, flag, join(f.dir, 'missing')], flag);
      await s.error(
        ['--agent', 'codex', ...digits, flag, await f.write('bad.json', 'not json')],
        flag === '--profile' ? 'profile' : 'runtime allowlist',
      );
      await s.error(
        [
          '--agent',
          'codex',
          ...digits,
          flag,
          await f.write(
            'multiple.json',
            `${JSON.stringify(flag === '--profile' ? profile : runtime)}\n${JSON.stringify(flag === '--profile' ? profile : runtime)}`,
          ),
        ],
        flag === '--profile' ? 'profile' : 'runtime allowlist',
      );
    }
    await s.error(['--agent', 'codex', ...digits], '--profile', { CAP_MODEL_PROFILE: '' });
    await s.error(['--agent', 'codex', ...digits], '--runtime-models', { CAP_RUNTIME_MODELS: '' });
  }),
);

test(
  'STOP precedes config, host, profile and database lookup',
  withFixture(async (f) => {
    const s = await scorer(f);
    await f.config('invalid: [\n');
    for (const agent of ['codex', 'claude', 'other']) {
      const attempt4 = await s.json(['--agent', agent, ...digits, '--attempt', '4'], {
        CAP_MODEL_PROFILE: '',
        CAP_RUNTIME_MODELS: '',
      });
      expect(attempt4.status).toBe('stop');
      expect(attempt4).toMatchObject({ host: null, rank: null, effort: null, dispatch: null });
      expect(attempt4.line).toBe(
        'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → STOP (attempt 4: escalate to user with failure trail)',
      );
    }
    expect(
      await s.json([
        '--agent',
        'codex',
        ...digits,
        '--attempt',
        '5',
        '--reviewer',
        '--profile',
        join(f.dir, 'missing'),
      ]),
    ).toMatchObject({ status: 'stop', attempt: 5, dispatch: null });
  }),
);

test(
  'invalid scorer arguments reject every original value and numeric edge',
  withFixture(async (f) => {
    const s = await scorer(f);
    for (const flag of ['--agent', '--profile', '--runtime-models', '--bias', '--attempt', '--current-model'])
      await s.error([...zero, flag], flag);
    for (const [args, detail] of [
      [[], 'need six'],
      [['1', '1', '1'], 'exactly six'],
      [['3', ...zero.slice(1)], 'digit out of range'],
      [['a', ...zero.slice(1)], 'digit out of range'],
      [['1.0', ...zero.slice(1)], 'digit out of range'],
      [['-1', ...zero.slice(1)], 'unknown flag'],
      [[...zero, '--bias', 'x'], '--bias'],
      [[...zero, '--bias', '1.5'], '--bias'],
      [[...zero, '--attempt', '0'], '--attempt'],
      [[...zero, '--attempt', '1.5'], '--attempt'],
      [['--host', 'codex', ...zero], 'unknown flag'],
      [['--agent', '', ...zero], '--agent'],
      [['--agent', 'other', ...zero], 'claude or codex'],
    ] as [string[], string][])
      await s.error(args, detail);
    await s.error(zero, 'CAP_EFFORT_BIAS', { CAP_EFFORT_BIAS: 'x' });
    expect((await s.run(['--help'])).stdout).toContain('usage: scripts/celetis capscore');
  }),
);

test(
  'opencode uses explicit model, environment, cwd database and fallback in order',
  withFixture(async (f) => {
    const s = await scorer(f);
    expect(
      (await s.json(['--agent', 'claude', ...digits, '--current-model', 'provider/current'], { OPENCODE: '1' }))
        .dispatch.model,
    ).toBe('provider/current');
    expect(
      await s.json(['--agent', 'claude', '2', '2', '2', '2', '2', '0', '--attempt', '3'], {
        OPENCODE: '1',
        CAP_CURRENT_MODEL: 'provider/env',
      }),
    ).toMatchObject({ host: 'opencode', rank: 3, effort: 'xhigh', dispatch: { model: 'provider/env' } });
    expect(
      (
        await s.json(['--agent', 'claude', ...digits, '--current-model', 'provider/flag'], {
          OPENCODE: '1',
          CAP_CURRENT_MODEL: 'provider/env',
        })
      ).dispatch.model,
    ).toBe('provider/flag');
    const db = await f.write('data/opencode.db', '');
    await f.stub(
      'sqlite3',
      `import { appendFileSync, readFileSync } from 'node:fs';\nconst [db,sql] = process.argv.slice(2); appendFileSync(process.env.SQL_LOG!, JSON.stringify([db,sql])+'\\n'); const mode=readFileSync(process.env.SQL_MODE!,'utf8'); if(mode==='fail') process.exit(1); if(mode==='cwd') console.log('provider/cwd'); else if(sql.includes('$.path.cwd')) console.log('/'); else console.log('provider/fallback');`,
    );
    const env = {
      OPENCODE: '1',
      OPENCODE_DATA_DIR: join(f.dir, 'data'),
      PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
      SQL_LOG: join(f.dir, 'sql-log'),
      SQL_MODE: await f.write('sql-mode', 'cwd'),
    };
    expect((await s.json(['--agent', 'claude', ...digits], env)).dispatch.model).toBe('provider/cwd');
    expect(JSON.parse((await f.read('sql-log')).split('\n')[0] ?? '')).toEqual([
      db,
      `SELECT json_extract(data,'$.providerID') || '/' || json_extract(data,'$.modelID') FROM message WHERE json_extract(data,'$.modelID') IS NOT NULL AND json_extract(data,'$.path.cwd') = '${f.repo.replaceAll("'", "''")}' ORDER BY time_created DESC LIMIT 1;`,
    ]);
    await f.write("repo dir/a'b/.keep", '');
    expect((await s.json(['--agent', 'claude', ...digits], env, join(f.repo, "a'b"))).dispatch.model).toBe(
      'provider/cwd',
    );
    const quoteCalls = (await f.read('sql-log'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(quoteCalls.some((call: string[]) => call[1]?.includes("a''b"))).toBe(true);
    expect(
      (await s.json(['--agent', 'claude', ...digits], { OPENCODE: '1', OPENCODE_DATA_DIR: join(f.dir, 'missing-db') }))
        .dispatch.model,
    ).toBe('sonnet');
    await f.write('sql-mode', 'fallback');
    expect((await s.json(['--agent', 'claude', ...digits], env)).dispatch.model).toBe('provider/fallback');
    await f.write('sql-mode', 'fail');
    expect((await s.json(['--agent', 'claude', ...digits], env)).dispatch.model).toBe('sonnet');
    expect((await s.json(['--agent', 'codex', ...digits], env)).host).toBe('codex');
  }),
);

test(
  'array-valued reviewer effort fails the published profile schema',
  withFixture(async (f) => {
    const s = await scorer(f);
    const file = await f.write(
      'array-effort.json',
      JSON.stringify({ ...profile, reviewer: { rank: 1, effort: ['medium'] } }),
    );
    const args = ['--agent', 'codex', ...digits, '--profile', file];
    const result = await f.bun(entry, args, { cwd: f.repo, env: s.env });
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('reviewer needs rank 0-3 and effort low, medium, high or xhigh');
    const old = await command('/bin/bash', [baseline, ...args], { cwd: f.repo, env: s.env });
    expect(old.code).toBe(0);
    expect(old.stdout).toBe('CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → standard/xhigh\n');
  }),
);

test(
  'numeric inputs keep the exact maximum safe integer and STOP lookup order',
  withFixture(async (f) => {
    const s = await scorer(f);
    const maximum = '9007199254740991';
    for (const [args, env] of [
      [[...digits, '--bias', maximum], {}],
      [digits, { CAP_EFFORT_BIAS: maximum }],
    ] as [string[], NodeJS.ProcessEnv][]) {
      const value = await s.json(args, env);
      expect(value.bias).toBe(9007199254740991);
      expect(Number.isSafeInteger(value.bias)).toBe(true);
      expect(value.line).toBe('CAP: J1 V0 B2 N1 S1 X0 = 5 +b9007199254740991 → sonnet/max');
    }
    expect((await s.json([...digits, '--bias', '1'], { CAP_EFFORT_BIAS: '9'.repeat(400) })).bias).toBe(1);
    await f.config('invalid: [\n');
    await f.stub('git', "await Bun.write(process.env.NUMERIC_LOOKUP!, 'called'); process.exit(97);");
    const env = {
      PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
      NUMERIC_LOOKUP: join(f.dir, 'lookup-called'),
      CAP_MODEL_PROFILE: '',
      CAP_RUNTIME_MODELS: join(f.dir, 'missing-runtime'),
    };
    const result = await s.run(['--agent', 'other', ...digits, '--attempt', maximum, '--json'], env);
    const value = JSON.parse(result.stdout);
    expect(value).toMatchObject({ status: 'stop', attempt: 9007199254740991, host: null, dispatch: null });
    expect(result.stdout).toContain('"attempt":9007199254740991');
    expect(value.line).toBe(
      'CAP: J1 V0 B2 N1 S1 X0 = 5 +b2 → STOP (attempt 9007199254740991: escalate to user with failure trail)',
    );
    expect(await Bun.file(join(f.dir, 'lookup-called')).exists()).toBe(false);
  }),
);

for (const [kind, value] of [
  ['first unsafe integer', '9007199254740992'],
  ['reported overflow', '9223372036854775808'],
  ['much larger decimal', '9'.repeat(400)],
] as const) {
  for (const source of ['--bias', '--attempt', 'CAP_EFFORT_BIAS']) {
    test(
      `${source} rejects ${kind} before lookup or numeric JSON output`,
      withFixture(async (f) => {
        const s = await scorer(f);
        await f.config('invalid: [\n');
        await f.stub('git', "await Bun.write(process.env.NUMERIC_LOOKUP!, 'called'); process.exit(97);");
        const env = {
          ...s.env,
          PATH: `${join(f.dir, 'bin')}:${process.env.PATH}`,
          NUMERIC_LOOKUP: join(f.dir, 'lookup-called'),
          CAP_MODEL_PROFILE: '',
          CAP_RUNTIME_MODELS: join(f.dir, 'missing-runtime'),
          ...(source === 'CAP_EFFORT_BIAS' ? { CAP_EFFORT_BIAS: value } : {}),
        };
        const args = [
          '--agent',
          'other',
          ...digits,
          ...(source === 'CAP_EFFORT_BIAS' ? [] : [source, value]),
          ...(source === '--attempt' ? [] : ['--attempt', '4']),
          '--json',
        ];
        const result = await f.bun(entry, args, { cwd: f.repo, env });
        const diagnostic =
          source === '--attempt'
            ? '--attempt needs a positive integer'
            : source === '--bias'
              ? '--bias needs a non-negative integer'
              : 'CAP_EFFORT_BIAS must be a non-negative integer';
        expect(result).toEqual({ code: 2, stdout: '', stderr: `capscore: ${diagnostic}\n` });
        expect(await Bun.file(join(f.dir, 'lookup-called')).exists()).toBe(false);
      }),
    );
  }
}
