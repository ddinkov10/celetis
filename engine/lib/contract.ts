declare const exitBrand: unique symbol;

export type ExitCode = number & { readonly [exitBrand]: true };

export const exitClasses = [
  { code: 0, name: 'done', meaning: 'The act completed, or it had no change to make.' },
  {
    code: 1,
    name: 'internal',
    meaning: 'An unexpected failure, for example an uncaught error; the message names it.',
  },
  { code: 2, name: 'usage', meaning: 'Bad arguments, or an input file or value that the command refuses.' },
  {
    code: 3,
    name: 'prerequisite',
    meaning:
      'The current state does not permit the act: an unmet prerequisite, a busy lock, stale input, no daemon, or missing wiring.',
  },
  {
    code: 4,
    name: 'repair',
    meaning:
      'The session repairs the lane, then runs the command again: a conflict with the trunk, or a branch or a checkout that moved.',
  },
  { code: 5, name: 'checks', meaning: 'A check of the change is not green.' },
  {
    code: 6,
    name: 'blocked',
    meaning:
      'A system outside the command failed or did not answer (GitHub, git, the host, the file system, access); a write can be partial.',
  },
  { code: 7, name: 'cleanup', meaning: 'The change landed, and its cleanup stopped.' },
  { code: 8, name: 'stop', meaning: 'The engine stops the task; the session escalates.' },
  { code: '128+n', name: 'signal', meaning: 'The signal n ended the command.' },
] as const satisfies readonly { code: number | '128+n'; name: string; meaning: string }[];

type ExitRow = (typeof exitClasses)[number];
export type DeclaredClass = ExitRow['name'];
export type ExitClass = Extract<ExitRow, { code: number }>['name'];

const brand = (code: number) => code as ExitCode;

export const exits = Object.fromEntries(
  exitClasses.flatMap(({ code, name }) => (typeof code === 'number' ? [[name, brand(code)]] : [])),
) as Readonly<Record<ExitClass, ExitCode>>;

const signalFloor = 128;
const signalCeiling = 192;

export const signalExit = (signal: number): ExitCode => brand(signalFloor + signal);

export const passThrough = (code: number): ExitCode => brand(code);

export function classOf(code: number): DeclaredClass | null {
  if (!Number.isInteger(code)) return null;
  if (code > signalFloor && code <= signalCeiling) return 'signal';
  return exitClasses.find((row) => row.code === code)?.name ?? null;
}

export const exitCodeOf = (value: unknown): ExitCode | null =>
  typeof value === 'number' && classOf(value) !== null ? brand(value) : null;

export const updateHint = 'celetis: when a skill or a document gave this command, run celetis update';

export const labels = [
  'needs-triage',
  'bug',
  'enhancement',
  'hotfix',
  'chore',
  'epic',
  'needs-info',
  'ready-for-agent',
  'ready-for-human',
  'wontfix',
] as const;

export type Label = (typeof labels)[number];

export const headings = {
  plan: '## Plan',
  built: '## Built',
  rootCause: '## Root cause',
  beforeLanding: '## Before landing',
  landingRefused: '## Landing refused',
  humanStepsDone: '## Human steps done',
  stopped: '## Stopped',
} as const;

export type Kind = 'general' | 'during-the-build';

export const marker = (kind: Kind) => `<!-- celetis-before-landing ${kind} -->`;

export type CommandName =
  | 'agents'
  | 'assist'
  | 'capscore'
  | 'config'
  | 'daemon'
  | 'dispatch'
  | 'events'
  | 'install'
  | 'intake'
  | 'issue'
  | 'land'
  | 'lesson-store'
  | 'next-step'
  | 'queue'
  | 'root'
  | 'run'
  | 'setup'
  | 'update'
  | 'visual'
  | 'worktree';

export type Flag = Readonly<{ name: `--${string}`; value?: string; optional: boolean }>;
export type Form = Readonly<{
  words: readonly string[];
  flags: readonly Flag[];
  help?: Readonly<{ order: number; summary: string }>;
  passThrough?: string;
}>;
export type Entry = Readonly<{
  command: CommandName;
  forms: readonly Form[];
  description: string;
  exits: readonly DeclaredClass[];
  agent: boolean;
  internal?: true;
}>;

const required = (name: `--${string}`, value?: string): Flag => ({
  name,
  ...(value ? { value } : {}),
  optional: false,
});
const optional = (name: `--${string}`, value?: string): Flag => ({ name, ...(value ? { value } : {}), optional: true });
const form = (
  words: string | readonly string[],
  flags: readonly Flag[] = [],
  extra: Pick<Form, 'help' | 'passThrough'> = {},
): Form => ({ words: typeof words === 'string' ? words.split(' ') : words, flags, ...extra });
const helped = (order: number, summary: string) => ({ help: { order, summary } });
const sessionCode = 'the exit code of the host session';

const profileFlags = [optional('--profile', 'FILE'), optional('--runtime-models', 'FILE')];
const setupOptions = [
  required('--hosts', 'claude|codex|claude,codex|codex,claude'),
  required('--landing', 'pr|merge'),
  optional('--suite', '<file>'),
  optional('--setup-file', '<file>'),
  optional('--ignore', '<line>'),
  optional('--baseline-file', '<file>'),
];

export const issueStateKeys = ['lane', 'line', 'build', 'plan', 'open', 'refusal'] as const;
export type IssueStateKey = (typeof issueStateKeys)[number];
export const dispatchStatuses = ['ready', 'reported', 'closed', 'refused', 'stop', 'setup'] as const;
export type DispatchStatus = (typeof dispatchStatuses)[number];
export const capPrefix = 'CAP:';
export const setupStatusClosing = (main: string) => `Run /celetis:setup in the main checkout: ${main}`;
export const worktreePathLine = (path: string) => path;

export type IssueArgument = 'none' | 'lane' | 'effort' | 'file' | 'optional-file';
type ActDeclaration = Readonly<{
  words: readonly string[];
  flags: readonly Flag[];
  argument: IssueArgument;
  prerequisite: string;
  writes: string;
}>;

export const issueActs = {
  route: {
    words: ['route', 'feature|bug|chore|hotfix'],
    flags: [],
    argument: 'lane',
    prerequisite: 'open; not an epic',
    writes: 'the label of the lane; it removes the other lane labels and `needs-triage`',
  },
  effort: {
    words: ['effort', '<step>', '<level>', '<file>'],
    flags: [],
    argument: 'effort',
    prerequisite: 'open',
    writes: 'an `Effort: <step> <level>` comment ("What lives on the issue", "Effort"); no label change',
  },
  epic: {
    words: ['epic', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open feature or epic; valid declaration and current child references',
    writes: 'the complete parent body, then adds `epic` and removes `enhancement` as needed; clears no hold',
  },
  'epic-state': {
    words: ['epic-state'],
    flags: [],
    argument: 'none',
    prerequisite: 'readable parent and complete children',
    writes: 'nothing; the JSON snapshot of "Epic acceptance submission"',
  },
  'complete-epic': {
    words: ['complete-epic', '[file]'],
    flags: [],
    argument: 'optional-file',
    prerequisite: '"Epic completion and repair"',
    writes: 'an accepted record, then closes as completed; an already closed parent has no write',
  },
  'needs-info': {
    words: ['needs-info', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open',
    writes: 'the file as a comment, then `needs-info`',
  },
  wontfix: {
    words: ['wontfix', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open',
    writes: 'the file as a comment, then `wontfix`, then the close as not planned',
  },
  spec: {
    words: ['spec', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open; lane `feature`',
    writes: 'the body: `Spec: YYYY-MM-DD` (the local date), a blank line, then the file',
  },
  'root-cause': {
    words: ['root-cause', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open; lane `bug` or `hotfix`',
    writes: 'a `## Root cause` comment',
  },
  plan: {
    words: ['plan', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open; a `feature` with a spec, or a `bug` with a `## Root cause` comment',
    writes:
      'a `## Plan` comment; then `ready-for-agent` with no human hold, else keeps `ready-for-human` and removes `ready-for-agent`',
  },
  built: {
    words: ['built'],
    flags: [],
    argument: 'none',
    prerequisite: 'the resolver line is `implement` of a planned change',
    writes: 'a `## Built` comment, then removes `ready-for-agent` when present',
  },
  'before-landing': {
    words: ['before-landing', '<file>'],
    flags: [optional('--during-the-build')],
    argument: 'file',
    prerequisite: 'the resolver line is the step that lands the lane (`implement`, `chore`, `hotfix`)',
    writes:
      'a `## Before landing` comment with the marker of its kind ("Completing a human precondition"), then it adds `ready-for-human`, and removes `ready-for-agent` when it is on',
  },
  'landing-refused': {
    words: ['landing-refused', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'as `before-landing`',
    writes: 'a `## Landing refused` comment',
  },
  stopped: {
    words: ['stopped', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open',
    writes: 'a `## Stopped` comment, then adds `ready-for-human` and removes `ready-for-agent` when present',
  },
  'ready-for-human': {
    words: ['ready-for-human'],
    flags: [],
    argument: 'none',
    prerequisite: 'open',
    writes: 'adds or retains `ready-for-human`, then removes `ready-for-agent` when present',
  },
  assisted: {
    words: ['assisted', '<file>'],
    flags: [],
    argument: 'file',
    prerequisite: 'open; has `needs-info`, `ready-for-human`, or a current open human precondition',
    writes:
      'a `## Human steps done` comment with assistance-agent attribution, then removes present `needs-info` and `ready-for-human`; adds no label',
  },
  state: {
    words: ['state'],
    flags: [],
    argument: 'none',
    prerequisite: 'none',
    writes: 'nothing',
  },
} as const satisfies Readonly<Record<string, ActDeclaration>>;

export type IssueAct = keyof typeof issueActs;

const flagText = ({ name, value, optional }: Flag) => {
  const text = value ? `${name} ${value}` : name;
  return optional ? `[${text}]` : text;
};
export const formText = ({ words, flags }: Form) => [...words, ...flags.map(flagText)].join(' ');
const issueActList = Object.values(issueActs)
  .filter(({ words }) => words[0] !== 'epic-state' && words[0] !== 'state')
  .map((act) => `\`${formText(act)}\``)
  .join(', ');

const dispatchForms = [
  form('dispatch next <n> <task> implementer|reviewer J V B N S X', [required('--bias', 'N'), ...profileFlags]),
  form('dispatch report <dispatch-id> <report-file>'),
  form('dispatch gate <n> <task> pass|fail <gate> <report>', profileFlags),
  form('dispatch review <n> <task> findings|blocked', profileFlags),
  form('dispatch close <n> <task>'),
  form('dispatch show'),
];

const base = ['done', 'internal', 'usage', 'prerequisite', 'blocked'] as const;
const hosted = ['internal', 'usage', 'prerequisite', 'blocked'] as const;
const worktreeExits = ['done', 'internal', 'usage', 'prerequisite', 'repair', 'blocked'] as const;

const entry = (
  command: CommandName,
  agent: boolean,
  forms: readonly Form[],
  description: string,
  exitList: readonly DeclaredClass[] = base,
  internal?: true,
): Entry => ({ command, forms, description, exits: exitList, agent, ...(internal ? { internal } : {}) });

export const commands: readonly Entry[] = [
  entry(
    'lesson-store',
    true,
    [form('lesson-store read main|active', [], helped(19, 'Reads validated lessons; requires explicit --agent.'))],
    'Returns validated lesson records, exact file contents, digests, and the resolved checkout as JSON. `main` returns the live files of the checkout that runs it with the pending and rejected data of the main checkout, and `root` names the main checkout. Rejected records appear in `history` with `status: pending-review`; they are not past guidance. `active` reads the live files of the task checkout and ignores its pending folder. A leftover `docs/lessons/INDEX.md` fails both reads',
  ),
  entry(
    'lesson-store',
    true,
    [form('lesson-store capture FILE', [], helped(20, 'Saves a pending proposal; requires explicit --agent.'))],
    'Reads typed `{schema:1,candidate,expected,name,description,tags,date,source,incidents,body}` JSON and builds the pending record; `expected` is the pending SHA-256 or null for creation. An extension keeps the stored incidents and reviews. Validates the store of `read main` and saves pending evidence in the main checkout only. Equal incident replays are unchanged; stale updates are refused',
  ),
  entry(
    'lesson-store',
    true,
    [form('lesson-store preview FILE', [], helped(21, 'Prepares an exact lesson review; requires explicit --agent.'))],
    'Reads a review request and returns its exact before/after contents of the store of `read main`, watched digests, and snapshot digest without lesson writes. Select pending UUIDs and complete resulting documents as defined in [the lesson format](docs/procedures/lesson-format.md)',
  ),
  entry(
    'lesson-store',
    true,
    [
      form(
        'lesson-store apply SNAPSHOT DIGEST',
        [],
        helped(22, 'Applies a reviewed snapshot and commits it in a linked checkout; requires explicit --agent.'),
      ),
    ],
    `Recomputes the review and applies exactly the approved snapshot under the lock. Changed input or snapshot bytes are stale. Replaying the same review is unchanged; conflicting reuse of its ID is invalid. The digest identifies a version, not its reviewer. In a linked checkout, a live change needs a clean checkout on a branch and becomes one local commit \`docs(lessons): <decision> <names>\` with a \`Lesson-Transaction\` trailer, made with the project's hooks; the proposals leave the queue only after that commit. When Git fails but the lesson commit exists, the apply completes. When the lane is still at its old HEAD, the apply restores the before bytes of the live paths, also a hook rewrite, and their index entries, and exits ${exits.blocked}. When HEAD moved without the commit, the journal stays (exit ${exits.blocked}), and the line names the repair: \`git -C <lane> reset --soft <recorded HEAD>\`, then \`recover\``,
  ),
  entry(
    'lesson-store',
    true,
    [
      form(
        'lesson-store recover',
        [],
        helped(23, 'Completes or rolls back an interrupted lesson write; requires explicit --agent.'),
      ),
    ],
    `Completes or rolls back the one journal under the lesson lock, from any checkout of the repository. A lane journal completes when its lesson commit exists and rolls back when the lane is still at the recorded HEAD; a lane HEAD that moved without the commit blocks it until \`git -C <lane> reset --soft <recorded HEAD>\`. These commands require Git and an explicit host, but no issue, run, or configuration file. Only a lane apply and its recovery change the Git index. It exits ${exits.usage} for invalid input or store, ${exits.prerequisite} when the input is stale or a lock is busy, and ${exits.blocked} for an access, I/O, or recovery block`,
  ),
  entry(
    'run',
    true,
    [
      form(
        'run <n>',
        [optional('--quiet')],
        helped(9, 'Asks the daemon to start the next step of one issue and follow its auto gates; returns at once.'),
      ),
      form('run resume <n>', [], helped(11, 'Asks the daemon to open the session of a step with no progress again.')),
      form(
        'run retry <n> <wait-id>',
        [],
        helped(12, 'Asks the daemon to wake the quota waiter of an issue for one attempt cycle.'),
      ),
    ],
    `Each form sends one request to the master daemon of the repository of the current folder and returns at its answer. \`run <n>\` starts the next step of the issue, \`run resume <n>\` opens the saved session of a step with no progress again, and \`run retry <n> <wait-id>\` wakes the quota waiter of the issue for one attempt cycle. \`--quiet\` opens each session tab of the start in the background; \`run resume\` ignores it. An accepted start prints \`run: #<n>: accepted as run <run id> of the daemon PID <pid>; read its progress: celetis daemon status\`, and an accepted Retry prints \`run: #<n>: Retry requested; the waiting run starts one bounded attempt cycle\`; both exit ${exits.done}. A refusal prints the line of the daemon, on stdout for code ${exits.done} and on stderr otherwise, and exits with its code: ${exits.prerequisite} for a busy issue lock, ${exits.blocked} for a failed GitHub read of the issue, ${exits.done} for each other end before the first session. With no daemon, it exits ${exits.prerequisite} and starts nothing. It exits ${exits.prerequisite} when the daemon runs another revision of the program or an update removed this program version, and ${exits.blocked} when the daemon does not answer or the outcome is unknown. On Windows it exits ${exits.prerequisite} with \`run: Windows is not a support target\`. Any other form exits ${exits.usage} with the usage line`,
  ),
  entry(
    'run',
    true,
    [
      form(
        'run <n>',
        [required('--effort', '<level>'), optional('--quiet')],
        helped(
          10,
          'Asks the daemon to start the next step of one issue at another effort level, for its first session only.',
        ),
      ),
    ],
    `Asks the daemon to start the next step of the issue at \`low\`, \`medium\`, \`high\`, \`xhigh\`, or \`max\` instead of its decided or default level; the request carries the level, for the first session of this start only. Each later step uses its own decision, and the flag writes no decision. It needs exactly one issue number; any other form exits ${exits.usage} with the usage line`,
  ),
  entry(
    'queue',
    true,
    [
      form(
        ['queue', 'action', "'<QueueAction JSON>'"],
        [optional('--quiet')],
        helped(13, 'Saves a queue action; asks the daemon to run its authorized wake.'),
      ),
      form('queue status', [], helped(14, 'Reads the current queue and its allowed actions.')),
    ],
    `\`status\` prints the view of the queue as JSON. \`action\` saves one validated action and prints the view; when the action gives a wake, it then sends that wake to the master daemon and prints the answer as \`run\` does, with the prefix \`queue:\`. An Add to an empty queue, a Continue, and a Retry exit ${exits.prerequisite} with no daemon and save nothing. \`--quiet\` opens each session tab of the wake in the background. It exits ${exits.usage} for another form, an agent that differs from the agent choice of the queue, or a queue record that is not valid, ${exits.prerequisite} for a refused action (for example a stale \`expected\`), and ${exits.blocked} when GitHub or the queue record cannot be read`,
  ),
  entry(
    'daemon',
    true,
    [
      form(
        'daemon start',
        [],
        helped(
          15,
          'Starts the master daemon of this repository, detached, waits until it answers, and prints the board URL.',
        ),
      ),
      form('daemon status', [], helped(16, 'Shows the daemon, the board URL, its auto mode, and its runs.')),
      form('daemon stop', [], helped(17, 'Stops the daemon and waits until its process ends.')),
      form('daemon auto on|off', [], helped(18, 'Turns auto mode of the daemon on or off, and prints its state.')),
    ],
    `Starts, reads, and stops the master daemon of the repository of the current folder (\`docs/workflow.md\`, "The master daemon"); \`auto on|off\` turns auto mode of the daemon on or off and prints \`daemon: auto mode <state>\`. For \`start\`, \`status\`, and \`stop\` the optional \`--agent\` selects nothing; for \`auto\` it selects the host of the auto steps. \`start\` spawns the daemon detached, which serves the board ("The agent board"), and exits ${exits.done} when it answers, or when a daemon already runs; it then prints \`daemon: board http://127.0.0.1:<port>\`, except for a daemon of another revision. It exits ${exits.prerequisite} when \`gh\`, \`hc\`, or the Herdr app is missing, and ${exits.blocked} when the hc server or the Herdr app does not answer, or when the daemon ends or stays silent for 30 seconds, for example when its board port cannot open. \`status\` prints the daemon, the board URL, its auto mode, and one line per run; it exits ${exits.prerequisite} when no daemon runs or the daemon runs another revision of the program. \`stop\` exits ${exits.done} when the process ended or no daemon runs. \`auto\` exits ${exits.done} with the state, ${exits.prerequisite} when no daemon runs or the daemon runs another revision of the program, the code of a refusal, or ${exits.blocked} when the outcome is unknown. Each form exits ${exits.blocked} when a daemon is known but its process or socket does not answer; \`stop\` exits ${exits.blocked} too when the process stays for 60 seconds. Windows exits ${exits.prerequisite}, and any other form exits ${exits.usage}`,
  ),
  entry(
    'intake',
    true,
    [
      form('intake', [], {
        ...helped(6, 'Starts a fresh session that asks for your request before intake.'),
        passThrough: sessionCode,
      }),
    ],
    `Starts a fresh interactive session in the main checkout. It asks “What would you like to work on?” and waits. After an answer, it enters \`celetis:intake\` with that request. It creates no issue before the answer and does not start a run. Before the start, it checks that the plugin of the selected host is at the revision of the program, and it exits ${exits.prerequisite} with the line of that check when it is not`,
    hosted,
  ),
  entry(
    'assist',
    true,
    [
      form('assist <n>', [], {
        ...helped(7, 'Starts fresh interactive assistance for an issue in the main checkout.'),
        passThrough: sessionCode,
      }),
    ],
    `Starts fresh interactive assistance for the issue in the main checkout. It completes permitted work for the current block and uses \`issue <n> assisted <file>\` for verified completion and hold removal. It asks for missing human contributions, then reports the actual next step. It does not start or resume a run or land. Before the start, it checks that the plugin of the selected host is at the revision of the program, and it exits ${exits.prerequisite} with the line of that check when it is not`,
    hosted,
  ),
  entry(
    'visual',
    true,
    [
      form('visual <n> <sha>', [], {
        ...helped(8, 'Starts a fresh session that makes the visual of a landed commit.'),
        passThrough: sessionCode,
      }),
    ],
    "Starts a fresh interactive session in the main checkout that makes the `visual-explainer` diff review of the landed commit `<sha>` of the issue `<n>`. It fetches the trunk from `origin` and refuses a commit that is not on it, and a commit whose page exists. The host writes `docs/superpowers/visuals/<sha>.html` and opens it, changes no other file, and makes no commit. A host with no `visual-explainer` skill says so in the tab and writes no file. The board's Make visual starts this command",
    hosted,
  ),
  entry(
    'worktree',
    true,
    [form('worktree <n>')],
    'Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path',
    worktreeExits,
  ),
  entry(
    'worktree',
    true,
    [form('worktree --remove <n>')],
    'Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first',
    worktreeExits,
  ),
  entry(
    'land',
    true,
    [form("land <n> '<subject>'")],
    `Lands the change of the issue by the \`landing\` field of \`.celetis.yaml\`. It is the one landing path of an agent. The master daemon of the repository runs the landing, and \`land\` prints its output and exits with its status; with no daemon, or a daemon of another revision, it exits ${exits.prerequisite}, when the daemon does not answer ${exits.blocked}, and for another refusal of the request by the daemon it exits with the code of that refusal. It refuses an issue that is not ready to land. It exits ${exits.cleanup} when the change landed and its cleanup stopped; run it again`,
    ['done', 'internal', 'usage', 'prerequisite', 'repair', 'checks', 'blocked', 'cleanup', 'signal'],
  ),
  entry(
    'issue',
    true,
    Object.values(issueActs).map((act) => form(['issue', '<n>', ...act.words], act.flags)),
    `Makes each workflow write that the engine reads: ${issueActList}. The assistance act records an attributed \`## Human steps done\` report before removing present blocking labels; it adds no label and preserves build state. Lifecycle acts write the comment heading before label changes. Each act refuses unmet prerequisites. \`state\` writes nothing and prints lifecycle facts. \`epic-state\` writes nothing and prints the current declaration, child snapshot, history, and holds. Epic definition writes preserve the complete parent body; guarded completion publishes its accepted record before closing and leaves readiness labels unchanged. \`docs/issue-tracker.md\`, "Conventions", gives each act`,
  ),
  entry(
    'next-step',
    true,
    [form('next-step <n>'), form('next-step', [required('--open')])],
    'The resolver: the next step of one issue, or of each open issue',
  ),
  entry(
    'events',
    true,
    [form('events', [optional('--after', '<id>')])],
    `Prints each kept entry of the event record of the user as one JSON line, oldest first; \`--after <id>\` prints only the entries after that entry. \`docs/workflow.md\`, "The event record", gives the record. It exits ${exits.usage} for a relative \`CELETIS_HOME\`, ${exits.prerequisite} when the record lock is busy, and ${exits.blocked} for an unsafe folder or lock file`,
  ),
  entry(
    'config',
    true,
    [form('config <checkout> <plugin>')],
    `The reader of \`.celetis.yaml\` for the agent. It first checks that \`<plugin>\` is a Celetis plugin: a folder whose \`.claude-plugin/plugin.json\` has \`"name": "celetis"\`. It then validates the whole file of \`<checkout>\`, and checks each \`custom\` key against \`<plugin>/skills/<key>/SKILL.md\`, a regular file with no symbolic link. It prints the configuration as one compact JSON line. \`--agent\` selects nothing. It exits ${exits.usage} for another form, a folder that is not a Celetis plugin, or a missing or invalid file; the line names the field or the plugin folder`,
  ),
  entry(
    'capscore',
    true,
    [
      form('capscore J V B N S X', [
        optional('--json'),
        optional('--bias', 'N'),
        optional('--attempt', 'N'),
        optional('--reviewer'),
        optional('--profile', 'FILE'),
        optional('--runtime-models', 'FILE'),
      ]),
    ],
    'Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null',
  ),
  entry(
    'dispatch',
    true,
    dispatchForms,
    `Acts: ${dispatchForms.map(({ words }) => `\`${words[1]}\``).join(', ')}. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: \`/tmp/celetis-<uid>/dispatch/<host>-<session>.json\` on macOS and Linux; \`<os.tmpdir()>/celetis/dispatch/<host>-<session>.json\` on Windows. It exits ${exits.done} for a ready, reported, or closed result (also \`show\`), ${exits.usage} for bad usage or an invalid \`.celetis.yaml\`, ${exits.prerequisite} for a refusal or a busy dispatch lock, ${exits.blocked} for a setup failure, and ${exits.stop} when the engine stops the task`,
    ['done', 'internal', 'usage', 'prerequisite', 'blocked', 'stop'],
  ),
  entry(
    'install',
    false,
    [form('install')],
    'Installs the revision of the clean checkout that it runs from as the program ("First install"); takes no arguments',
  ),
  entry(
    'setup',
    true,
    [
      form('setup check'),
      form('setup write', setupOptions),
      form('setup try', setupOptions, { passThrough: 'the exit code of the worktree setup script' }),
      form('setup try', [required('--remove')]),
      form('setup lane <path>'),
      form('setup push'),
    ],
    'The deterministic part of `/celetis:setup`: validated saved answers from `check`, bounded owned refresh and removal in `write`, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit of planned paths, including deletions, with the push. Every setup run calls the program; no product launcher is written',
  ),
  entry(
    'setup',
    true,
    [
      form(
        'setup status',
        [],
        helped(3, 'Reports each part of the required wiring that this checkout lacks; writes nothing.'),
      ),
    ],
    `Reports the required wiring of the active checkout for the selected host, also from a subfolder or a lane worktree: \`origin\`, \`.celetis.yaml\` and its configured files, the Celetis block, the Claude imports and settings or the Codex restriction, the ignore and attribute lines, the record of setup, and the workflow labels. It writes nothing, runs no product file, and fetches nothing. An incomplete report ends with \`Run /celetis:setup in the main checkout: <path>\`. It exits ${exits.done} when the wiring is complete, ${exits.prerequisite} when it is missing, invalid, or different, and ${exits.blocked} when an observation is blocked`,
  ),
  entry(
    'agents',
    false,
    [
      form('agents read', [], helped(4, 'Reads the local ordered agent preference and its version.')),
      form(
        ['agents', 'replace', "'<JSON>'"],
        [],
        helped(5, 'Replaces the local order using order and expectedVersion.'),
      ),
    ],
    `Reads the local ordered preference, or replaces it with exactly \`order\` and \`expectedVersion\`. It shares the Git common directory across worktrees and requires no YAML. It exits ${exits.usage} for a replacement that is not JSON or not a valid order, and for an \`agents.json\` that does not validate. It exits ${exits.prerequisite} for a stale-edit conflict, and returns the latest order; a busy write lock also exits ${exits.prerequisite}, with no JSON. It exits ${exits.blocked} for an unsafe or unreadable record. Repeating the current order succeeds`,
  ),
  entry(
    'update',
    false,
    [
      form('update', [], helped(1, 'Updates the program and the plugin of each host; asks once.')),
      form('update check', [], helped(2, 'Shows the installed and the available revision of each part.')),
    ],
    `Updates the program and the plugin of each host, and asks once in an interactive terminal. \`check\` is read-only: it prints one JSON array of the parts. \`plugins/celetis/README.md\`, "Updates", gives the steps. Any other form exits ${exits.usage} with the usage line`,
  ),
  entry(
    'root',
    false,
    [form('root', [], helped(24, 'Prints the folder of the program.'))],
    'Prints the folder of the program. It takes no argument and runs in each folder',
  ),
  entry(
    'daemon',
    false,
    [form(['daemon', '--daemon'])],
    'The detached master daemon process of `daemon start`.',
    [...base, 'signal'],
    true,
  ),
  entry(
    'daemon',
    false,
    [
      form(
        ['daemon', '--session-start', '<dir>', '<daemon-pid>', '<host>', '<attempt>', '<recovery>', '<host-args>'],
        [],
        {
          passThrough: sessionCode,
        },
      ),
    ],
    'The waiting session of a daemon run.',
    hosted,
    true,
  ),
  entry(
    'daemon',
    false,
    [form('daemon --prepare-state queue'), form('daemon --prepare-state session <n>')],
    'The state preparation of the daemon.',
    base,
    true,
  ),
];

export const launcherForms: readonly Form[] = [
  form([]),
  form('help', [], helped(26, 'Prints this list.')),
  form('--help'),
  form('-h'),
  form('--version', [], helped(25, 'Prints the revision of the program.')),
];

const helpRows = [...commands.filter(({ internal }) => !internal).flatMap(({ forms }) => forms), ...launcherForms]
  .flatMap((each) =>
    each.help
      ? [
          {
            order: each.help.order,
            summary: each.help.summary,
            text: `celetis ${formText({ ...each, flags: each.flags.filter(({ optional }) => !optional) })}`,
          },
        ]
      : [],
  )
  .sort((a, b) => a.order - b.order);
const helpWidth = Math.max(...helpRows.map(({ text }) => text.length));

export const helpText = [
  'usage: celetis [--agent <host>] <command> [<argument>...]',
  '',
  ...helpRows.map(({ text, summary }) => `  ${text.padEnd(helpWidth)}  ${summary}`),
  '',
  'In a terminal, --agent claude|codex is optional. CELETIS_AGENT is an explicit choice too.',
  'With neither, the local agent order applies; its initial order is claude, codex.',
  'The skills run the other commands. plugins/celetis/README.md, "The commands", in the folder that celetis root',
  'prints, lists all of them.',
].join('\n');

const hinted: ReadonlySet<CommandName> = new Set([
  'assist',
  'capscore',
  'events',
  'install',
  'intake',
  'issue',
  'land',
  'next-step',
  'run',
  'setup',
  'update',
  'visual',
  'worktree',
]);

export function usageLine(command: CommandName): string {
  const own = commands.filter((each) => each.command === command && !each.internal);
  return `celetis ${own[0]?.agent ? '--agent <host> ' : ''}${own.flatMap((each) => each.forms.map(formText)).join(' | ')}`;
}

export const usageText = (command: CommandName, ...detail: string[]): string =>
  [usageLine(command), ...detail, ...(hinted.has(command) ? [updateHint] : [])].join('\n');

export const usage = (command: CommandName, ...detail: string[]): string => `usage: ${usageText(command, ...detail)}`;
