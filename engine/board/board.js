// engine/lib/contract.ts
var exitClasses = [
  { code: 0, name: "done", meaning: "The act completed, or it had no change to make." },
  {
    code: 1,
    name: "internal",
    meaning: "An unexpected failure, for example an uncaught error; the message names it."
  },
  { code: 2, name: "usage", meaning: "Bad arguments, or an input file or value that the command refuses." },
  {
    code: 3,
    name: "prerequisite",
    meaning: "The current state does not permit the act: an unmet prerequisite, a busy lock, stale input, no daemon, or missing wiring."
  },
  {
    code: 4,
    name: "repair",
    meaning: "The session repairs the lane, then runs the command again: a conflict with the trunk, or a branch or a checkout that moved."
  },
  { code: 5, name: "checks", meaning: "A check of the change is not green." },
  {
    code: 6,
    name: "blocked",
    meaning: "A system outside the command failed or did not answer (GitHub, git, the host, the file system, access); a write can be partial."
  },
  { code: 7, name: "cleanup", meaning: "The change landed, and its cleanup stopped." },
  { code: 8, name: "stop", meaning: "The engine stops the task; the session escalates." },
  { code: "128+n", name: "signal", meaning: "The signal n ended the command." }
];
var brand = (code) => code;
var exits = Object.fromEntries(exitClasses.flatMap(({ code, name }) => typeof code === "number" ? [[name, brand(code)]] : []));
var required = (name, value) => ({
  name,
  ...value ? { value } : {},
  optional: false
});
var optional = (name, value) => ({ name, ...value ? { value } : {}, optional: true });
var form = (words, flags = [], extra = {}) => ({ words: typeof words === "string" ? words.split(" ") : words, flags, ...extra });
var helped = (order, summary) => ({ help: { order, summary } });
var sessionCode = "the exit code of the host session";
var profileFlags = [optional("--profile", "FILE"), optional("--runtime-models", "FILE")];
var setupOptions = [
  required("--hosts", "claude|codex|claude,codex|codex,claude"),
  required("--landing", "pr|merge"),
  optional("--suite", "<file>"),
  optional("--setup-file", "<file>"),
  optional("--ignore", "<line>"),
  optional("--baseline-file", "<file>")
];
var issueActs = {
  route: {
    words: ["route", "feature|bug|chore|hotfix"],
    flags: [],
    argument: "lane",
    prerequisite: "open; not an epic",
    writes: "the label of the lane; it removes the other lane labels and `needs-triage`"
  },
  effort: {
    words: ["effort", "<step>", "<level>", "<file>"],
    flags: [],
    argument: "effort",
    prerequisite: "open",
    writes: 'an `Effort: <step> <level>` comment ("What lives on the issue", "Effort"); no label change'
  },
  epic: {
    words: ["epic", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open feature or epic; valid declaration and current child references",
    writes: "the complete parent body, then adds `epic` and removes `enhancement` as needed; clears no hold"
  },
  "epic-state": {
    words: ["epic-state"],
    flags: [],
    argument: "none",
    prerequisite: "readable parent and complete children",
    writes: 'nothing; the JSON snapshot of "Epic acceptance submission"'
  },
  "complete-epic": {
    words: ["complete-epic", "[file]"],
    flags: [],
    argument: "optional-file",
    prerequisite: '"Epic completion and repair"',
    writes: "an accepted record, then closes as completed; an already closed parent has no write"
  },
  "needs-info": {
    words: ["needs-info", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open",
    writes: "the file as a comment, then `needs-info`"
  },
  wontfix: {
    words: ["wontfix", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open",
    writes: "the file as a comment, then `wontfix`, then the close as not planned"
  },
  spec: {
    words: ["spec", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open; lane `feature`",
    writes: "the body: `Spec: YYYY-MM-DD` (the local date), a blank line, then the file"
  },
  "root-cause": {
    words: ["root-cause", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open; lane `bug` or `hotfix`",
    writes: "a `## Root cause` comment"
  },
  plan: {
    words: ["plan", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open; a `feature` with a spec, or a `bug` with a `## Root cause` comment",
    writes: "a `## Plan` comment; then `ready-for-agent` with no human hold, else keeps `ready-for-human` and removes `ready-for-agent`"
  },
  built: {
    words: ["built"],
    flags: [],
    argument: "none",
    prerequisite: "the resolver line is `implement` of a planned change",
    writes: "a `## Built` comment, then removes `ready-for-agent` when present"
  },
  "before-landing": {
    words: ["before-landing", "<file>"],
    flags: [optional("--during-the-build")],
    argument: "file",
    prerequisite: "the resolver line is the step that lands the lane (`implement`, `chore`, `hotfix`)",
    writes: 'a `## Before landing` comment with the marker of its kind ("Completing a human precondition"), then it adds `ready-for-human`, and removes `ready-for-agent` when it is on'
  },
  "landing-refused": {
    words: ["landing-refused", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "as `before-landing`",
    writes: "a `## Landing refused` comment"
  },
  stopped: {
    words: ["stopped", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open",
    writes: "a `## Stopped` comment, then adds `ready-for-human` and removes `ready-for-agent` when present"
  },
  "ready-for-human": {
    words: ["ready-for-human"],
    flags: [],
    argument: "none",
    prerequisite: "open",
    writes: "adds or retains `ready-for-human`, then removes `ready-for-agent` when present"
  },
  assisted: {
    words: ["assisted", "<file>"],
    flags: [],
    argument: "file",
    prerequisite: "open; has `needs-info`, `ready-for-human`, or a current open human precondition",
    writes: "a `## Human steps done` comment with assistance-agent attribution, then removes present `needs-info` and `ready-for-human`; adds no label"
  },
  state: {
    words: ["state"],
    flags: [],
    argument: "none",
    prerequisite: "none",
    writes: "nothing"
  }
};
var flagText = ({ name, value, optional }) => {
  const text = value ? `${name} ${value}` : name;
  return optional ? `[${text}]` : text;
};
var formText = ({ words, flags }) => [...words, ...flags.map(flagText)].join(" ");
var issueActList = Object.values(issueActs).filter(({ words }) => words[0] !== "epic-state" && words[0] !== "state").map((act) => `\`${formText(act)}\``).join(", ");
var dispatchForms = [
  form("dispatch next <n> <task> implementer|reviewer J V B N S X", [required("--bias", "N"), ...profileFlags]),
  form("dispatch report <dispatch-id> <report-file>"),
  form("dispatch gate <n> <task> pass|fail <gate> <report>", profileFlags),
  form("dispatch review <n> <task> findings|blocked", profileFlags),
  form("dispatch close <n> <task>"),
  form("dispatch show")
];
var base = ["done", "internal", "usage", "prerequisite", "blocked"];
var hosted = ["internal", "usage", "prerequisite", "blocked"];
var worktreeExits = ["done", "internal", "usage", "prerequisite", "repair", "blocked"];
var entry = (command, agent, forms, description, exitList = base, internal) => ({ command, forms, description, exits: exitList, agent, ...internal ? { internal } : {} });
var commands = [
  entry("lesson-store", true, [form("lesson-store read main|active", [], helped(19, "Reads validated lessons; requires explicit --agent."))], "Returns validated lesson records, exact file contents, digests, and the resolved checkout as JSON. `main` returns the live files of the checkout that runs it with the pending and rejected data of the main checkout, and `root` names the main checkout. Rejected records appear in `history` with `status: pending-review`; they are not past guidance. `active` reads the live files of the task checkout and ignores its pending folder. A leftover `docs/lessons/INDEX.md` fails both reads"),
  entry("lesson-store", true, [form("lesson-store capture FILE", [], helped(20, "Saves a pending proposal; requires explicit --agent."))], "Reads typed `{schema:1,candidate,expected,name,description,tags,date,source,incidents,body}` JSON and builds the pending record; `expected` is the pending SHA-256 or null for creation. An extension keeps the stored incidents and reviews. Validates the store of `read main` and saves pending evidence in the main checkout only. Equal incident replays are unchanged; stale updates are refused"),
  entry("lesson-store", true, [form("lesson-store preview FILE", [], helped(21, "Prepares an exact lesson review; requires explicit --agent."))], "Reads a review request and returns its exact before/after contents of the store of `read main`, watched digests, and snapshot digest without lesson writes. Select pending UUIDs and complete resulting documents as defined in [the lesson format](docs/procedures/lesson-format.md)"),
  entry("lesson-store", true, [
    form("lesson-store apply SNAPSHOT DIGEST", [], helped(22, "Applies a reviewed snapshot and commits it in a linked checkout; requires explicit --agent."))
  ], `Recomputes the review and applies exactly the approved snapshot under the lock. Changed input or snapshot bytes are stale. Replaying the same review is unchanged; conflicting reuse of its ID is invalid. The digest identifies a version, not its reviewer. In a linked checkout, a live change needs a clean checkout on a branch and becomes one local commit \`docs(lessons): <decision> <names>\` with a \`Lesson-Transaction\` trailer, made with the project's hooks; the proposals leave the queue only after that commit. When Git fails but the lesson commit exists, the apply completes. When the lane is still at its old HEAD, the apply restores the before bytes of the live paths, also a hook rewrite, and their index entries, and exits ${exits.blocked}. When HEAD moved without the commit, the journal stays (exit ${exits.blocked}), and the line names the repair: \`git -C <lane> reset --soft <recorded HEAD>\`, then \`recover\``),
  entry("lesson-store", true, [
    form("lesson-store recover", [], helped(23, "Completes or rolls back an interrupted lesson write; requires explicit --agent."))
  ], `Completes or rolls back the one journal under the lesson lock, from any checkout of the repository. A lane journal completes when its lesson commit exists and rolls back when the lane is still at the recorded HEAD; a lane HEAD that moved without the commit blocks it until \`git -C <lane> reset --soft <recorded HEAD>\`. These commands require Git and an explicit host, but no issue, run, or configuration file. Only a lane apply and its recovery change the Git index. It exits ${exits.usage} for invalid input or store, ${exits.prerequisite} when the input is stale or a lock is busy, and ${exits.blocked} for an access, I/O, or recovery block`),
  entry("run", true, [
    form("run <n>", [optional("--quiet")], helped(9, "Asks the daemon to start the next step of one issue and follow its auto gates; returns at once.")),
    form("run resume <n>", [], helped(11, "Asks the daemon to open the session of a step with no progress again.")),
    form("run retry <n> <wait-id>", [], helped(12, "Asks the daemon to wake the quota waiter of an issue for one attempt cycle."))
  ], `Each form sends one request to the master daemon of the repository of the current folder and returns at its answer. \`run <n>\` starts the next step of the issue, \`run resume <n>\` opens the saved session of a step with no progress again, and \`run retry <n> <wait-id>\` wakes the quota waiter of the issue for one attempt cycle. \`--quiet\` opens each session tab of the start in the background; \`run resume\` ignores it. An accepted start prints \`run: #<n>: accepted as run <run id> of the daemon PID <pid>; read its progress: celetis daemon status\`, and an accepted Retry prints \`run: #<n>: Retry requested; the waiting run starts one bounded attempt cycle\`; both exit ${exits.done}. A refusal prints the line of the daemon, on stdout for code ${exits.done} and on stderr otherwise, and exits with its code: ${exits.prerequisite} for a busy issue lock, ${exits.blocked} for a failed GitHub read of the issue, ${exits.done} for each other end before the first session. With no daemon, it exits ${exits.prerequisite} and starts nothing. It exits ${exits.prerequisite} when the daemon runs another revision of the program or an update removed this program version, and ${exits.blocked} when the daemon does not answer or the outcome is unknown. On Windows it exits ${exits.prerequisite} with \`run: Windows is not a support target\`. Any other form exits ${exits.usage} with the usage line`),
  entry("run", true, [
    form("run <n>", [required("--effort", "<level>"), optional("--quiet")], helped(10, "Asks the daemon to start the next step of one issue at another effort level, for its first session only."))
  ], `Asks the daemon to start the next step of the issue at \`low\`, \`medium\`, \`high\`, \`xhigh\`, or \`max\` instead of its decided or default level; the request carries the level, for the first session of this start only. Each later step uses its own decision, and the flag writes no decision. It needs exactly one issue number; any other form exits ${exits.usage} with the usage line`),
  entry("queue", true, [
    form(["queue", "action", "'<QueueAction JSON>'"], [optional("--quiet")], helped(13, "Saves a queue action; asks the daemon to run its authorized wake.")),
    form("queue status", [], helped(14, "Reads the current queue and its allowed actions."))
  ], `\`status\` prints the view of the queue as JSON. \`action\` saves one validated action and prints the view; when the action gives a wake, it then sends that wake to the master daemon and prints the answer as \`run\` does, with the prefix \`queue:\`. An Add to an empty queue, a Continue, and a Retry exit ${exits.prerequisite} with no daemon and save nothing. \`--quiet\` opens each session tab of the wake in the background. It exits ${exits.usage} for another form, an agent that differs from the agent choice of the queue, or a queue record that is not valid, ${exits.prerequisite} for a refused action (for example a stale \`expected\`), and ${exits.blocked} when GitHub or the queue record cannot be read`),
  entry("daemon", true, [
    form("daemon start", [], helped(15, "Starts the master daemon of this repository, detached, waits until it answers, and prints the board URL.")),
    form("daemon status", [], helped(16, "Shows the daemon, the board URL, its auto mode, and its runs.")),
    form("daemon stop", [], helped(17, "Stops the daemon and waits until its process ends.")),
    form("daemon auto on|off", [], helped(18, "Turns auto mode of the daemon on or off, and prints its state."))
  ], `Starts, reads, and stops the master daemon of the repository of the current folder (\`docs/workflow.md\`, "The master daemon"); \`auto on|off\` turns auto mode of the daemon on or off and prints \`daemon: auto mode <state>\`. For \`start\`, \`status\`, and \`stop\` the optional \`--agent\` selects nothing; for \`auto\` it selects the host of the auto steps. \`start\` spawns the daemon detached, which serves the board ("The agent board"), and exits ${exits.done} when it answers, or when a daemon already runs; it then prints \`daemon: board http://127.0.0.1:<port>\`, except for a daemon of another revision. It exits ${exits.prerequisite} when \`gh\`, \`hc\`, or the Herdr app is missing, and ${exits.blocked} when the hc server or the Herdr app does not answer, or when the daemon ends or stays silent for 30 seconds, for example when its board port cannot open. \`status\` prints the daemon, the board URL, its auto mode, and one line per run; it exits ${exits.prerequisite} when no daemon runs or the daemon runs another revision of the program. \`stop\` exits ${exits.done} when the process ended or no daemon runs. \`auto\` exits ${exits.done} with the state, ${exits.prerequisite} when no daemon runs or the daemon runs another revision of the program, the code of a refusal, or ${exits.blocked} when the outcome is unknown. Each form exits ${exits.blocked} when a daemon is known but its process or socket does not answer; \`stop\` exits ${exits.blocked} too when the process stays for 60 seconds. Windows exits ${exits.prerequisite}, and any other form exits ${exits.usage}`),
  entry("intake", true, [
    form("intake", [], {
      ...helped(6, "Starts a fresh session that asks for your request before intake."),
      passThrough: sessionCode
    })
  ], "Starts a fresh interactive session in the main checkout. It asks “What would you like to work on?” and waits. After an answer, it enters `celetis:intake` with that request. It creates no issue before the answer and does not start a run", hosted),
  entry("assist", true, [
    form("assist <n>", [], {
      ...helped(7, "Starts fresh interactive assistance for an issue in the main checkout."),
      passThrough: sessionCode
    })
  ], "Starts fresh interactive assistance for the issue in the main checkout. It completes permitted work for the current block and uses `issue <n> assisted <file>` for verified completion and hold removal. It asks for missing human contributions, then reports the actual next step. It does not start or resume a run or land", hosted),
  entry("visual", true, [
    form("visual <n> <sha>", [], {
      ...helped(8, "Starts a fresh session that makes the visual of a landed commit."),
      passThrough: sessionCode
    })
  ], "Starts a fresh interactive session in the main checkout that makes the `visual-explainer` diff review of the landed commit `<sha>` of the issue `<n>`. It fetches the trunk from `origin` and refuses a commit that is not on it, and a commit whose page exists. The host writes `docs/superpowers/visuals/<sha>.html` and opens it, changes no other file, and makes no commit. A host with no `visual-explainer` skill says so in the tab and writes no file. The board's Make visual starts this command", hosted),
  entry("worktree", true, [form("worktree <n>")], "Makes the lane worktree and the branch of the issue, or enters the one that is there and brings it up to the trunk, and prints its path", worktreeExits),
  entry("worktree", true, [form("worktree --remove <n>")], "Removes the lane worktree and the branch of an issue that ended with no landing by the script. It refuses while the issue is open and its branch has no merged PR, so close the issue first", worktreeExits),
  entry("land", true, [form("land <n> '<subject>'")], `Lands the change of the issue by the \`landing\` field of \`.celetis.yaml\`. It is the one landing path of an agent. The master daemon of the repository runs the landing, and \`land\` prints its output and exits with its status; with no daemon, or a daemon of another revision, it exits ${exits.prerequisite}, when the daemon does not answer ${exits.blocked}, and for another refusal of the request by the daemon it exits with the code of that refusal. It refuses an issue that is not ready to land. It exits ${exits.cleanup} when the change landed and its cleanup stopped; run it again`, ["done", "internal", "usage", "prerequisite", "repair", "checks", "blocked", "cleanup", "signal"]),
  entry("issue", true, Object.values(issueActs).map((act) => form(["issue", "<n>", ...act.words], act.flags)), `Makes each workflow write that the engine reads: ${issueActList}. The assistance act records an attributed \`## Human steps done\` report before removing present blocking labels; it adds no label and preserves build state. Lifecycle acts write the comment heading before label changes. Each act refuses unmet prerequisites. \`state\` writes nothing and prints lifecycle facts. \`epic-state\` writes nothing and prints the current declaration, child snapshot, history, and holds. Epic definition writes preserve the complete parent body; guarded completion publishes its accepted record before closing and leaves readiness labels unchanged. \`docs/issue-tracker.md\`, "Conventions", gives each act`),
  entry("next-step", true, [form("next-step <n>"), form("next-step", [required("--open")])], "The resolver: the next step of one issue, or of each open issue"),
  entry("events", true, [form("events", [optional("--after", "<id>")])], `Prints each kept entry of the event record of the user as one JSON line, oldest first; \`--after <id>\` prints only the entries after that entry. \`docs/workflow.md\`, "The event record", gives the record. It exits ${exits.usage} for a relative \`CELETIS_HOME\`, ${exits.prerequisite} when the record lock is busy, and ${exits.blocked} for an unsafe folder or lock file`),
  entry("config", true, [form("config <checkout> <plugin>")], `The reader of \`.celetis.yaml\` for the agent. It first checks that \`<plugin>\` is a Celetis plugin: a folder whose \`.claude-plugin/plugin.json\` has \`"name": "celetis"\`. It then validates the whole file of \`<checkout>\`, and checks each \`custom\` key against \`<plugin>/skills/<key>/SKILL.md\`, a regular file with no symbolic link. It prints the configuration as one compact JSON line. \`--agent\` selects nothing. It exits ${exits.usage} for another form, a folder that is not a Celetis plugin, or a missing or invalid file; the line names the field or the plugin folder`),
  entry("capscore", true, [
    form("capscore J V B N S X", [
      optional("--json"),
      optional("--bias", "N"),
      optional("--attempt", "N"),
      optional("--reviewer"),
      optional("--profile", "FILE"),
      optional("--runtime-models", "FILE"),
      optional("--current-model", "ID")
    ])
  ], "Resolves the six digits. `--json` gives portable scores and the host pair. With a Codex profile, it selects the profile by live runtime identity and needs `--runtime-models`; with no Codex profile, `dispatch.model` is null"),
  entry("dispatch", true, dispatchForms, `Acts: ${dispatchForms.map(({ words }) => `\`${words[1]}\``).join(", ")}. The task loop applies each returned pair and reports exact native arguments/results. Evidence is agent-reported, not independently checked. Records: \`/tmp/celetis-<uid>/dispatch/<host>-<session>.json\` on macOS and Linux; \`<os.tmpdir()>/celetis/dispatch/<host>-<session>.json\` on Windows. It exits ${exits.done} for a ready, reported, or closed result (also \`show\`), ${exits.usage} for bad usage or an invalid \`.celetis.yaml\`, ${exits.prerequisite} for a refusal or a busy dispatch lock, ${exits.blocked} for a setup failure, and ${exits.stop} when the engine stops the task`, ["done", "internal", "usage", "prerequisite", "blocked", "stop"]),
  entry("install", false, [form("install")], 'Installs the revision of the clean checkout that it runs from as the program ("First install"); takes no arguments'),
  entry("setup", true, [
    form("setup check"),
    form("setup write", setupOptions),
    form("setup try", setupOptions, { passThrough: "the exit code of the worktree setup script" }),
    form("setup try", [required("--remove")]),
    form("setup lane <path>"),
    form("setup push")
  ], "The deterministic part of `/celetis:setup`: validated saved answers from `check`, bounded owned refresh and removal in `write`, the test lane (`try` makes it and runs the worktree setup there, and `try --remove` removes it), the run of the worktree setup in a lane that exists (`lane`), and the commit of planned paths, including deletions, with the push. Every setup run calls the program; no product launcher is written"),
  entry("setup", true, [
    form("setup status", [], helped(3, "Reports each part of the required wiring that this checkout lacks; writes nothing."))
  ], `Reports the required wiring of the active checkout for the selected host, also from a subfolder or a lane worktree: \`origin\`, \`.celetis.yaml\` and its configured files, the Celetis block, the Claude imports and settings or the Codex restriction, the ignore and attribute lines, the record of setup, and the workflow labels. It writes nothing, runs no product file, and fetches nothing. An incomplete report ends with \`Run /celetis:setup in the main checkout: <path>\`. It exits ${exits.done} when the wiring is complete, ${exits.prerequisite} when it is missing, invalid, or different, and ${exits.blocked} when an observation is blocked`),
  entry("agents", false, [
    form("agents read", [], helped(4, "Reads the local ordered agent preference and its version.")),
    form(["agents", "replace", "'<JSON>'"], [], helped(5, "Replaces the local order using order and expectedVersion."))
  ], `Reads the local ordered preference, or replaces it with exactly \`order\` and \`expectedVersion\`. It shares the Git common directory across worktrees and requires no YAML. It exits ${exits.usage} for a replacement that is not JSON or not a valid order, and for an \`agents.json\` that does not validate. It exits ${exits.prerequisite} for a stale-edit conflict, and returns the latest order; a busy write lock also exits ${exits.prerequisite}, with no JSON. It exits ${exits.blocked} for an unsafe or unreadable record. Repeating the current order succeeds`),
  entry("update", false, [
    form("update", [], helped(1, "Updates the program and the plugin of each host; asks once.")),
    form("update check", [], helped(2, "Shows the installed and the available revision of each part."))
  ], 'Updates the program and the plugin of each host, and asks once in an interactive terminal. `check` is read-only: it prints one JSON array of the parts. `README.md`, "Updates", gives the steps'),
  entry("root", false, [form("root", [], helped(24, "Prints the folder of the program."))], "Prints the folder of the program. It takes no argument and runs in each folder"),
  entry("daemon", false, [form(["daemon", "--daemon"])], "The detached master daemon process of `daemon start`.", [...base, "signal"], true),
  entry("daemon", false, [
    form(["daemon", "--session-start", "<dir>", "<daemon-pid>", "<host>", "<attempt>", "<recovery>", "<host-args>"], [], {
      passThrough: sessionCode
    })
  ], "The waiting session of a daemon run.", hosted, true),
  entry("daemon", false, [form("daemon --prepare-state queue"), form("daemon --prepare-state session <n>")], "The state preparation of the daemon.", base, true),
  entry("update", false, [form("update --inspect <host>"), form("update --policy <host>")], "The inspection of an installation by the update of the daemon.", base, true)
];
var launcherForms = [
  form([]),
  form("help", [], helped(26, "Prints this list.")),
  form("--help"),
  form("-h"),
  form("--version", [], helped(25, "Prints the revision of the program."))
];
var helpRows = [...commands.filter(({ internal }) => !internal).flatMap(({ forms }) => forms), ...launcherForms].flatMap((each) => each.help ? [
  {
    order: each.help.order,
    summary: each.help.summary,
    text: `celetis ${formText({ ...each, flags: each.flags.filter(({ optional }) => !optional) })}`
  }
] : []).sort((a, b) => a.order - b.order);
var helpWidth = Math.max(...helpRows.map(({ text }) => text.length));
var helpText = [
  "usage: celetis [--agent <host>] <command> [<argument>...]",
  "",
  ...helpRows.map(({ text, summary }) => `  ${text.padEnd(helpWidth)}  ${summary}`),
  "",
  "In a terminal, --agent claude|codex is optional. CELETIS_AGENT is an explicit choice too.",
  "With neither, the local agent order applies; its initial order is claude, codex.",
  'The skills run the other commands. README.md, "The commands", in the folder that celetis root',
  "prints, lists all of them."
].join(`
`);
var hinted = new Set([
  "assist",
  "capscore",
  "events",
  "install",
  "intake",
  "issue",
  "land",
  "next-step",
  "run",
  "setup",
  "update",
  "visual",
  "worktree"
]);

// engine/lib/workflow.ts
var lanes = {
  feature: { label: "enhancement", prefix: "feat", steps: ["triage", "specify", "plan", "implement"] },
  bug: { label: "bug", prefix: "fix", steps: ["triage", "bug", "plan", "implement"] },
  chore: { label: "chore", prefix: "chore", steps: ["triage", "chore"] },
  hotfix: { label: "hotfix", prefix: "hotfix", steps: ["triage", "hotfix"] }
};
var laneNames = Object.keys(lanes);
var stepsOf = (lane) => lanes[lane].steps;
var steps = [...new Set(laneNames.flatMap(stepsOf))];
var stageNames = ["Triage", "Define", "Plan", "Implement"];
var stages = stageNames.map((name, position) => ({
  name,
  steps: [...new Set(laneNames.flatMap((lane) => stepsOf(lane).slice(position, position + 1)))]
}));

// engine/lib/effort.ts
var levels = ["low", "medium", "high", "xhigh", "max"];
var decidable = steps.filter((step) => step !== "triage");

// engine/board/board.ts
import { createAgentPicker, OrderConflict } from "./agent-picker.mjs";
import { openMenu, openPalette, setupMenu, setupPalette } from "./palette.mjs";
import { drawPanel } from "./panel.mjs";
import { drawQueue, setQueueOpen, setupQueue } from "./queue.mjs";
import {
  $,
  actionButton,
  copy,
  el,
  icon,
  iconButton,
  link,
  mark,
  post,
  SERVER_DOWN,
  store,
  timed,
  toast
} from "./ui.mjs";
import { isReconnecting, setupUpdates } from "./update-dialog.mjs";
import {
  age,
  agentOf,
  COLUMNS,
  cleanCause,
  effortSource,
  favicon,
  groupEpics,
  groupNeeds,
  keyOf,
  laneTrack,
  needsYou,
  notice,
  pageTitle,
  parseOpenEpics,
  pipeline,
  prFacts,
  runTitle,
  shortPath,
  signature,
  startTitle,
  stateLabel,
  tail,
  tone
} from "./view.mjs";
var SUMMARY = [
  ["needs", "need you"],
  ["running", "running"],
  ["idle", "idle"],
  ["history", "landed"]
];
var COPY = { "no-progress": "command", "dirty-tree": "path" };
var ON_ISSUE = new Set(["blocked"]);
var LIVE = new Set(["works", "waits"]);
var GATES = {
  me: "This step starts only when you press Run",
  auto: "Auto mode of the daemon starts this step by itself"
};
var AUTO = {
  on: { tone: "ok", title: "Auto mode starts each auto step." },
  off: { tone: "off", title: "Auto mode is off: auto steps wait." },
  stopping: { tone: "off", title: "Auto mode stops after its current work." }
};
var STATUS_ICONS = {
  works: "works",
  starts: "works",
  waits: "target",
  "no-progress": "alert",
  "dirty-tree": "diff",
  blocked: "person",
  "quota-wait": "clock"
};
var FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
var QUEUE_LEVEL = "The queue starts this step at the decided level";
var data = null;
var selected = null;
var view = store.get("view") === "pipeline" ? "pipeline" : "now";
var isNotifyOn = store.get("notify") === "on";
var isKeysOn = store.get("keys") !== "off";
var openEpics = parseOpenEpics(store.get("open-epics") ?? "");
var isHistoryOpen = false;
var isQueueOpen = false;
var isServerDown = false;
var intakePending = false;
var seen = null;
var needsKeys = null;
var starting = null;
var startupWarnings = new Map;
var byKey = new Map;
var used = new Set;
var who = (card) => card.number === null ? card.title ? `human session "${card.title}"` : "a human session" : `#${card.number}`;
var canRunLater = (card) => card.sessionId === null && card.step && (card.state === null || card.state === "no-progress");
var copyWhat = (card) => card.act ? COPY[card.state] : null;
var onTracker = () => data.tracker ? ` on ${data.tracker}` : "";
var readAgain = () => data?.tracker ? `Read ${data.tracker} again` : "Read the issues again";
var act = async (path, value, failure, onDone) => {
  if (isReconnecting())
    return false;
  const isOk = await post(path, value, failure);
  if (isOk)
    onDone?.();
  await load();
  return isOk;
};
var intakeReason = () => {
  if (isReconnecting())
    return "The board is reconnecting";
  if (intakePending)
    return "An intake tab is opening";
  const readAt = Date.parse(data?.source.readAt ?? "");
  if (!data || isServerDown || data.source.error || !Number.isFinite(readAt) || Date.now() - readAt > 60000)
    return null;
  return defaultReason();
};
function drawIntake() {
  const button = $("intake");
  const reason = intakeReason();
  button.setAttribute("aria-disabled", String(reason !== null));
  button.setAttribute("aria-busy", String(intakePending));
  button.title = reason ?? "Open a fresh intake session";
  button.querySelector(".label").textContent = intakePending ? "Opening…" : "New intake";
  $("intake-reason").textContent = intakePending ? "" : reason ?? "";
  $("intake-reason").hidden = intakePending || reason === null;
}
async function openIntake() {
  if (intakeReason() !== null)
    return;
  intakePending = true;
  drawIntake();
  $("announce").textContent = "Opening an intake tab";
  try {
    const outcome = await post("/api/intake", {}, "New intake failed", { timeout: 1e4 });
    if (outcome.status === "accepted")
      $("announce").textContent = "Intake tab opened";
    else {
      const detail = outcome.status === "rejected" ? outcome.error : [
        outcome.error,
        "The launch outcome is unknown. Check Human sessions or herdr before pressing New intake again."
      ].filter(Boolean).join(" ");
      toast("New intake failed", { detail, isError: true });
      $("announce").textContent = `New intake failed. ${detail}`;
    }
  } finally {
    intakePending = false;
    drawIntake();
  }
}
var agentDisplay = (id) => agentOf({ agent: id })?.name ?? id;
var defaultReason = (work = "session") => {
  const next = data?.next;
  if (next?.kind === "wait")
    return work === "session" ? "Every included agent is limited. See the agent order." : null;
  const entry = next ? data?.agents?.[next.host] : undefined;
  return entry?.available === false ? cleanCause(entry.cause) : null;
};
var runReason = (agent, number) => {
  if (data?.noRun)
    return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === "me-gate" && record.numbers[0] === number && record.choice) {
    if (record.choice.kind === "default") {
      if (agent !== null)
        return "queue: recorded agent choice is the default order";
    } else {
      if (agent !== null && agent !== record.choice.host)
        return `queue: recorded agent choice is ${record.choice.host}`;
      agent = record.choice.host;
    }
  }
  const agents = data?.agents;
  if (agent) {
    const entry = agents?.[agent];
    if (entry && entry.available === false)
      return cleanCause(entry.cause);
    return null;
  }
  return defaultReason("run");
};
var runName = ({ step, effort, number }) => `Run ${step}${effort ? ` at ${effort.level} (${effortSource(effort)})` : ""}, #${number}`;
var runAction = (card, agent = null) => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent, card.number);
  const name = agent ? `Run ${card.step}, #${card.number} with ${display}` : runName(card);
  return {
    id: agent ? `run:${agent}` : "run",
    label: agent ? `Run with ${display}` : "Run",
    icon: "run",
    busy: "Starting",
    name,
    title: reason ?? runTitle(card.step, data.flow, card.effort),
    isDisabled: Boolean(reason),
    run: reason ? async () => toast(reason, { isError: true }) : async () => {
      if (await launch(card, "/api/run", agent ?? undefined))
        toast(`Started the ${card.step} step of #${card.number} in a new herdr tab`);
    }
  };
};
var overrideActionsOf = (card, isAgain) => {
  const agents = data?.agents;
  if (!card.run || !agents || data?.noRun)
    return [];
  return Object.keys(agents).map((id) => {
    const display = agentDisplay(id);
    const base = runAction(card, id);
    return isAgain ? {
      ...base,
      label: `Run again with ${display}`,
      name: `Run ${card.step} again, #${card.number} with ${display}`,
      isGhost: true,
      title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`
    } : base;
  });
};
var levelEntries = (card) => {
  const { effort } = card;
  if (!effort || !(card.run || data?.noRun))
    return [];
  const record = data?.queue?.record;
  const reason = data?.noRun || (record?.state === "me-gate" && record.numbers[0] === card.number ? QUEUE_LEVEL : runReason(null, card.number));
  return [
    "rule",
    ...levels.map((level) => ({
      icon: level === effort.level ? "check" : "run",
      label: `Run at ${level}${level === effort.level ? ` (${effortSource(effort)})` : ""}`,
      title: reason ?? startTitle(card.step, effort, level),
      isDisabled: Boolean(reason),
      run: reason ? async () => toast(reason, { isError: true }) : async () => {
        if (await launch(card, "/api/run", undefined, level))
          toast(`Started the ${card.step} step of #${card.number} at ${level} in a new herdr tab`);
      }
    }))
  ];
};
var agentOrderEntry = {
  icon: "person",
  label: "Change the agent order",
  key: "",
  title: "Open the agent order in the footer",
  run: () => {
    const trigger = $("agent-picker").querySelector(".ap-trigger");
    if (trigger?.getAttribute("aria-expanded") !== "true")
      trigger?.click();
  }
};
var toMenuEntry = (action) => ({
  icon: action.icon,
  label: action.name,
  key: action.isMain ? "Enter" : "",
  isDisabled: action.isDisabled,
  title: action.title,
  run: action.href ? () => window.open(action.href, "_blank", "noopener,noreferrer") : action.run
});
var actionsOf = (card) => {
  const list = [];
  if (card.go) {
    list.push({
      id: "go",
      label: "Go",
      icon: "go",
      busy: "Focusing",
      name: `Go to the pane of ${who(card)}`,
      title: "Focus its pane in herdr (Enter)",
      run: () => act("/api/go", { sessionId: card.sessionId }, "Go failed", () => toast(`Focused the pane of ${who(card)} in herdr`, { detail: "Switch to your terminal to see it." }))
    });
  }
  if (card.state === "quota-wait")
    list.push({
      id: "agent-order",
      label: "Agent order",
      icon: "person",
      name: `Show the agent order and Retry of #${card.number}`,
      title: "Show the usage limits and Retry in the agent order (Enter)",
      run: agentOrderEntry.run
    });
  if (card.state === "blocked") {
    const reason = data?.noRun || defaultReason();
    list.push({
      id: "assist",
      label: "Open agent",
      icon: "terminal",
      busy: "Starting",
      name: `Open agent for #${card.number}`,
      title: reason ?? "Open an assistance session in a new herdr tab (Enter)",
      isDisabled: Boolean(reason) || !card.assist,
      run: async () => {
        if (await launch(card, "/api/assist"))
          toast(`Opened an assistance session for #${card.number} in a new herdr tab`, {
            detail: "Switch to your terminal to see it."
          });
      }
    });
  }
  if (card.state === "no-progress") {
    if (card.resume) {
      list.push({
        id: "resume",
        label: "Resume",
        icon: "terminal",
        busy: "Opening",
        name: `Resume the ${card.step} session of #${card.number}`,
        title: "Open the session of this step again in a new herdr tab (Enter)",
        run: async () => {
          if (await launch(card, "/api/resume"))
            toast(`Opened the ${card.step} session of #${card.number} in a new herdr tab`, {
              detail: "Switch to your terminal to see it."
            });
        }
      });
    }
    if (card.run) {
      const base = runAction(card);
      list.push({
        ...base,
        label: "Run again",
        name: `Run ${card.step} again, #${card.number}`,
        isGhost: true,
        title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`
      });
      list.push(...overrideActionsOf(card, true));
    }
  } else if (card.run) {
    list.push(runAction(card));
    list.push(...overrideActionsOf(card, false));
  }
  if (card.state === "dirty-tree") {
    list.push({
      id: "shell",
      label: "Open shell",
      icon: "terminal",
      busy: "Opening",
      name: `Open a shell in the worktree of #${card.number}`,
      title: "Open a shell in the worktree in a new herdr tab (Enter)",
      run: () => act("/api/shell", { number: card.number }, "Open shell failed", () => toast(`Opened a shell in the worktree of #${card.number}`, {
        detail: "Commit or stash the changes there; then the card moves on."
      }))
    });
  }
  if (ON_ISSUE.has(card.state) && card.url) {
    list.push({
      id: "open",
      label: "Open issue",
      icon: "open",
      name: `Open issue #${card.number}${onTracker()}`,
      title: `Open the issue${onTracker()}${list.length === 0 ? " (Enter)" : ""}`,
      href: card.url
    });
  }
  const { noRun } = data;
  if (noRun && canRunLater(card)) {
    list.push({
      id: "blocked",
      label: "Run",
      icon: "run",
      name: runName(card),
      title: noRun,
      isDisabled: true,
      run: async () => toast(noRun, { isError: true })
    });
    if (data?.agents)
      for (const id of Object.keys(data.agents)) {
        const display = agentDisplay(id);
        list.push({
          id: `run:${id}`,
          label: `Run with ${display}`,
          icon: "run",
          name: `Run ${card.step}, #${card.number} with ${display}`,
          title: noRun,
          isDisabled: true,
          run: async () => toast(noRun, { isError: true })
        });
      }
  }
  list.forEach((action, index) => {
    action.isMain = index === 0;
  });
  return list;
};
var menuOf = (card, key) => [
  ...actionsOf(card).map(toMenuEntry),
  ...levelEntries(card),
  "rule",
  { icon: "panel", label: "Show the details", key: "Space", run: () => openPanel(key) },
  ...card.url && !ON_ISSUE.has(card.state) ? [
    {
      icon: "open",
      label: `Open the issue${onTracker()}`,
      key: "o",
      run: () => window.open(card.url, "_blank", "noopener,noreferrer")
    }
  ] : [],
  ...copyWhat(card) ? [
    {
      icon: "copy",
      label: `Copy the ${copyWhat(card)}`,
      key: "c",
      run: () => copy(card.act, copyWhat(card))
    }
  ] : []
];
var track = (card) => {
  const steps = laneTrack(card, data.flow);
  if (!steps)
    return null;
  const at = steps.findIndex((step) => step.state === "now");
  const node = el("span", "track");
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", `Step ${at + 1} of ${steps.length}: ${steps[at].name}`);
  node.title = steps.map((step) => step.state === "next" ? step.name : `${step.name} (${step.state === "now" ? "now" : "done"})`).join(" · ");
  node.append(...steps.map((step) => el("i", `seg ${step.state}`)));
  return node;
};
var gate = (value) => value === "auto" ? Object.assign(el("span", "gate gate-auto", "auto"), { title: GATES.auto }) : null;
var effortChip = (effort) => {
  const chip = el("span", `effort${effort.source === "default" ? " is-default" : ""}`, effort.level);
  chip.title = `effort ${effort.level}, ${effortSource(effort)}`;
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", chip.title);
  return chip;
};
var status = (card, hasGlyph = true, isShort = false) => {
  const node = el("span", "status");
  if (card.state) {
    if (hasGlyph)
      node.append(icon(STATUS_ICONS[card.state] ?? "pending"));
    node.append(el("span", "status-label", stateLabel(card)));
    if (isShort)
      return node;
    const agent = agentOf(card);
    if (agent)
      node.append(el("span", "detail agent-name", agent.name));
    if (card.step && card.step !== card.type)
      node.append(el("span", "detail mono", card.step));
  } else if (card.step) {
    node.classList.add("next");
    if (hasGlyph)
      node.append(icon("pending"));
    node.append(el("span", "lead", "next"), el("span", "mono step", card.step));
    if (card.effort)
      node.append(effortChip(card.effort));
    const auto = gate(card.gate);
    if (auto)
      node.append(auto);
  }
  return node;
};
var liveLine = (card) => {
  if (!card.diff)
    return null;
  const node = el("div", "live");
  const delta = el("span", "delta");
  delta.append(el("i", "", `+${card.diff.added}`), ` −${card.diff.removed}`);
  node.append(icon("diff"), el("span", "target", `${card.diff.files} ${card.diff.files === 1 ? "file" : "files"} changed`), delta);
  node.title = "Changed since the branch left its base";
  return node;
};
var chips = (card) => {
  const items = prFacts(card.pr);
  if (items.length === 0)
    return null;
  const node = el("div", "chips");
  for (const item of items) {
    const chip = link(`chip2 chip-${item.kind}`, "", item.url);
    chip.append(icon(item.kind === "pr" ? "pr" : item.kind === "checks-fail" ? "xcircle" : item.kind === "checks-pass" || item.kind === "review-approved" ? "check" : "clock"), item.text);
    if (item.url)
      chip.addEventListener("click", (event) => event.stopPropagation());
    node.append(chip);
  }
  return node;
};
var actLine = (card) => {
  const what = copyWhat(card);
  if (!what)
    return el("p", "act", card.act);
  const node = el("p", "act code");
  const code = el("code");
  shortPath(card.act).split("/").forEach((part, index) => {
    code.append(...index ? [el("wbr"), `/${part}`] : [part]);
  });
  code.title = card.act;
  node.append(code, iconButton("copy", `Copy the ${what}`, () => copy(card.act, what), "copy"));
  node.lastChild.title = `Copy the ${what} (c)`;
  return node;
};
var keyFor = (card) => {
  let key = keyOf(card);
  while (used.has(key))
    key += "-x";
  used.add(key);
  return key;
};
var shell = (card, column, isCompact, level = "h3") => {
  const key = keyFor(card);
  byKey.set(key, { card, column });
  const node = el("article", `card${isCompact ? " compact" : ""}${key === selected ? " is-selected" : ""}`);
  node.dataset.state = card.state ?? "next";
  node.dataset.key = key;
  node.tabIndex = -1;
  node.style.viewTransitionName = key;
  if (card.url)
    node.dataset.url = card.url;
  if (seen !== null && seen.get(key) !== signature(card, column))
    node.classList.add("is-unseen");
  const text = card.title || `Issue #${card.number}`;
  const title = el(level, "title");
  title.id = `t-${key}`;
  title.title = text;
  title.append(link("", text, card.url));
  title.querySelector("a")?.addEventListener("click", (event) => event.stopPropagation());
  node.setAttribute("aria-labelledby", title.id);
  const id = link("num", `#${card.number}`, card.url);
  id.addEventListener("click", (event) => event.stopPropagation());
  return { key, node, title, id };
};
var unseenDot = () => Object.assign(el("i", "unseen"), { title: "Changed since you last looked" });
var runWithButton = (card) => {
  const actions = actionsOf(card);
  if (!["run", "blocked"].includes(actions[0]?.id))
    return null;
  const entries = actions.filter((action) => action.id.startsWith("run:")).map(toMenuEntry);
  if (entries.length === 0)
    return null;
  const levelled = levelEntries(card);
  const button = iconButton("chevron", levelled.length ? "Run with another agent or at another level" : "Run with another agent", (event) => openMenu(event.currentTarget, [...entries, ...levelled]));
  button.setAttribute("aria-haspopup", "menu");
  return button;
};
var drawCard = (card, column, { isCompact = false, level } = {}) => {
  const { key, node, title, id } = shell(card, column, isCompact, level);
  const actions = actionsOf(card);
  const isQuiet = column !== "needs";
  if (isCompact) {
    const meta = el("div", "meta");
    meta.append(id);
    if (card.type && card.type !== card.step) {
      const type = el("span", "meta-type");
      type.append(el("span", "sep", "·"), card.type);
      meta.append(type);
    }
    meta.append(el("span", "sep", "·"), status(card, card.state === "starts", true));
    const main = el("div", "main");
    main.append(title, meta);
    if (card.warning)
      main.append(el("p", "warning", card.warning));
    node.append(mark(card), main);
    if (actions[0]) {
      const withButton = runWithButton(card);
      if (withButton) {
        const btns = el("div", "compact-btns");
        btns.append(actionButton(actions[0], isQuiet), withButton);
        node.append(btns);
      } else {
        node.append(actionButton(actions[0], isQuiet));
      }
    }
    if (node.classList.contains("is-unseen"))
      node.append(unseenDot());
    return node;
  }
  const head = el("div", "card-head");
  if (node.classList.contains("is-unseen"))
    head.append(unseenDot());
  head.append(mark(card, Boolean(card.state)), id);
  if (card.type)
    head.append(el("span", "sep", "·"), el("span", "type", card.type));
  const lane = track(card);
  if (lane)
    head.append(lane);
  const more = iconButton("dots", "More actions (m)", () => openMenu(more, menuOf(card, key)), "more");
  more.setAttribute("aria-haspopup", "menu");
  head.append(more);
  node.append(head, title);
  for (const part of [
    card.state === "works" ? liveLine(card) : null,
    chips(card),
    card.act ? actLine(card) : null,
    card.warning ? el("p", "warning", card.warning) : null
  ])
    if (part)
      node.append(part);
  const end = el("div", "foot-end");
  if (card.state !== "starts")
    end.append(timed(card.since, Boolean(card.sessionId) && LIVE.has(card.state)));
  if (actions[0])
    end.append(actionButton(actions[0], isQuiet));
  const withButton = runWithButton(card);
  if (withButton)
    end.append(withButton);
  const foot = el("div", "card-foot");
  foot.append(status(card), end);
  node.append(foot);
  return node;
};
var glyph = (key) => {
  const node = el("span", "glyph");
  node.append(icon(`col-${key}`));
  return node;
};
var empty = (key, [title, text]) => {
  const node = el("div", `empty empty-${key}`);
  node.append(icon(key === "needs" ? "clear" : `col-${key}`), el("p", "empty-title", title), el("p", "empty-text", text));
  return node;
};
var needsBody = (cards) => groupNeeds(cards).map((group) => {
  const node = el("div", `group group-${group.key}`);
  node.dataset.group = group.key;
  node.dataset.short = group.short;
  const label = el("h3", "group-label");
  label.id = `g-${group.key}`;
  label.append(el("span", "", group.label), el("span", "group-count", String(group.cards.length)));
  node.setAttribute("role", "group");
  node.setAttribute("aria-labelledby", label.id);
  node.append(label, ...group.cards.map((card) => drawCard(card, "needs", { isCompact: group.isCompact, level: "h4" })));
  return node;
});
var storeOpenEpics = (change) => {
  const stored = store.get("open-epics");
  const next = new Set(stored === null ? openEpics : parseOpenEpics(stored));
  change(next);
  store.set("open-epics", JSON.stringify([...next].sort((a, b) => a - b)));
  openEpics = next;
};
var showOpenEpics = () => {
  for (const row of document.querySelectorAll(".epic-row")) {
    const isOpen = openEpics.has(Number(row.dataset.epic));
    row.setAttribute("aria-expanded", String(isOpen));
    $(row.getAttribute("aria-controls")).hidden = !isOpen;
  }
};
var setEpicOpen = (epic, isOpen) => {
  storeOpenEpics((open) => isOpen ? open.add(epic) : open.delete(epic));
  showOpenEpics();
};
var epicGroup = (epic, cards, scope) => {
  const id = `eg-${scope}-${epic.number}`;
  const isOpen = openEpics.has(epic.number);
  const row = el("button", "epic-row");
  row.type = "button";
  row.id = `${id}-row`;
  row.dataset.epic = String(epic.number);
  row.dataset.group = `${scope}-${epic.number}`;
  row.setAttribute("aria-expanded", String(isOpen));
  row.setAttribute("aria-controls", id);
  const count = el("span", "epic-count", String(cards.length));
  count.append(el("span", "sr-only", cards.length === 1 ? " issue" : " issues"));
  row.append(icon("chevron"), el("span", "epic-num", `#${epic.number}`), el("span", "epic-title", epic.title), count, unseenDot());
  row.addEventListener("click", () => setEpicOpen(epic.number, row.getAttribute("aria-expanded") !== "true"));
  const children = el("div", "epic-children");
  children.id = id;
  children.hidden = !isOpen;
  children.setAttribute("role", "group");
  children.setAttribute("aria-labelledby", row.id);
  children.append(...cards.map((card) => drawCard(card, "idle", { isCompact: true })));
  const node = el("div", "epic-group");
  node.dataset.epic = String(epic.number);
  node.append(row, children);
  return node;
};
var column = ({ key, name, note, empty: copyOf }, cards) => {
  const section = el("section", `col col-${key}`);
  section.id = `col-${key}`;
  section.setAttribute("aria-labelledby", `h-${key}`);
  section.classList.toggle("has-waits", cards.some((card) => card.state === "waits"));
  const heading = el("h2", "col-name", name);
  heading.id = `h-${key}`;
  const head = el("header", "col-head");
  head.title = note;
  head.append(glyph(key), heading, el("span", "count", String(cards.length)));
  const body = el("div", "col-body");
  if (cards.length === 0)
    body.append(empty(key, copyOf));
  else if (key === "needs")
    body.append(...needsBody(cards), drawTail());
  else if (key === "idle")
    body.append(...groupEpics(cards, () => true).map((item) => item.kind === "group" ? epicGroup(item.epic, item.cards, "idle") : drawCard(item.card, "idle", { isCompact: true })));
  else
    body.append(...cards.map((card) => drawCard(card, key)));
  section.append(head, body);
  return section;
};
var drawTail = () => {
  const wrap = el("div", "tail-wrap");
  const button = el("button", "tail");
  button.type = "button";
  button.append(icon("chevron"), el("span", "tail-text"));
  button.addEventListener("click", () => {
    const first = [...document.querySelectorAll(".col-needs .card[data-key]")].find((node) => node.dataset.hidden === "true");
    first?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
    first?.focus({ preventScroll: true });
  });
  wrap.append(button);
  wrap.hidden = true;
  return wrap;
};
var tailFrame = 0;
var updateTail = () => {
  cancelAnimationFrame(tailFrame);
  tailFrame = requestAnimationFrame(() => {
    const body = document.querySelector(".col-needs .col-body");
    const wrap = body?.querySelector(".tail-wrap");
    if (!body || !wrap)
      return;
    const bottom = body.getBoundingClientRect().bottom - (wrap.hidden ? 0 : wrap.offsetHeight);
    const counts = new Map;
    for (const node of body.querySelectorAll(".card[data-key]")) {
      const isHidden = node.getBoundingClientRect().top > bottom - 24;
      node.dataset.hidden = String(isHidden);
      if (!isHidden)
        continue;
      const group = node.closest(".group");
      counts.set(group.dataset.group, {
        short: group.dataset.short,
        count: (counts.get(group.dataset.group)?.count ?? 0) + 1
      });
    }
    const text = body.scrollHeight > body.clientHeight + 4 ? tail([...counts.values()]) : "";
    wrap.hidden = text === "";
    wrap.querySelector(".tail-text").textContent = text;
  });
};
var pipelineView = (columns, flow) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const where = new Map([
    ...columns.needs.map((c) => [c, "needs"]),
    ...columns.running.map((c) => [c, "running"]),
    ...columns.idle.map((c) => [c, "idle"])
  ]);
  const { stages, hold } = pipeline(cards, flow);
  const sections = [];
  if (hold.length) {
    const strip = el("section", "col hold");
    strip.setAttribute("aria-label", "Not in a lane step");
    const label = el("h2", "hold-label", "Not in a step");
    const list = el("div", "hold-list");
    list.append(...hold.map((card) => drawCard(card, where.get(card), { isCompact: true })));
    strip.append(label, list);
    sections.push(strip);
  }
  for (const stage of stages) {
    const section = el("section", "col stage");
    section.setAttribute("aria-labelledby", `s-${stage.key}`);
    const head = el("header", "col-head");
    head.title = stage.steps.join(", ");
    const heading = el("h2", "col-name", stage.name);
    heading.id = `s-${stage.key}`;
    head.append(heading, el("span", "count", String(stage.cards.length)));
    const body = el("div", "col-body");
    body.append(...stage.cards.length ? groupEpics(stage.cards, (card) => where.get(card) === "idle").map((item) => item.kind === "group" ? epicGroup(item.epic, item.cards, `s${stage.key}`) : drawCard(item.card, where.get(item.card), { isCompact: true })) : [el("p", "stage-empty", "No issue at this step")]);
    section.append(head, body);
    sections.push(section);
  }
  return sections;
};
var isStop = (node) => !node.closest(".epic-children[hidden]");
var focusFirst = (selector) => {
  if (isQueueOpen)
    showQueue(false);
  const target = [...document.querySelectorAll(selector)].find(isStop);
  target?.focus();
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
};
var summary = (columns) => SUMMARY.map(([key, label]) => {
  const count = key === "history" ? data?.history?.entries.length ?? 0 : key === "needs" ? needsYou(columns).length : columns[key].length;
  const chip = el("button", `chip chip-${key}`);
  chip.type = "button";
  chip.classList.toggle("hot", key === "needs" && count > 0);
  chip.append(el("i", "dot"), el("b", "", String(count)), el("span", "", label));
  chip.addEventListener("click", () => {
    if (key === "history")
      return setHistory(true);
    if (view !== "now")
      setView("now");
    focusFirst(`${key === "needs" ? '.human-pill[data-wait="dialog"] .human-open, ' : ""}#col-${key} .card, #col-${key} .epic-row, #col-${key} .empty`);
  });
  return chip;
});
var humanPill = (card) => {
  const key = keyFor(card);
  byKey.set(key, { card, column: "human" });
  const pill = el("div", "human-pill");
  pill.dataset.state = card.state ?? "";
  pill.dataset.wait = card.waitFor ?? "";
  const open = el("button", `human-open${key === selected ? " is-selected" : ""}`);
  open.type = "button";
  open.dataset.key = key;
  open.title = "Show the details and the screen of this session";
  open.append(mark(card), el("span", "human-name", card.title || "A session"), el("i", "human-dot"), el("span", "human-state", stateLabel(card)), timed(card.since, true));
  open.addEventListener("click", () => selected === key ? closePanel() : openPanel(key));
  const [go] = actionsOf(card);
  pill.append(open, iconButton("go", go.name, () => go.run?.(), "human-go"));
  return pill;
};
var drawHuman = (cards) => {
  const strip = $("human");
  strip.hidden = cards.length === 0;
  strip.replaceChildren(...cards.length ? [Object.assign(el("h2", "hold-label", "Human sessions"), { id: "human-title" })] : [], ...cards.map(humanPill));
};
var visualPresses = new Set;
var makeVisual = async (number) => {
  if (visualPresses.has(number))
    return;
  visualPresses.add(number);
  if (isHistoryOpen)
    drawHistory();
  await act("/api/visual", { number }, "Make visual failed");
  visualPresses.delete(number);
  if (isHistoryOpen)
    drawHistory();
};
var visualControl = (entry) => {
  const { number } = entry;
  const state = visualPresses.has(number) && entry.visual === "none" ? "starting" : entry.visual;
  let node;
  if (state === "ready") {
    node = Object.assign(el("a", "btn ghost history-action"), {
      href: `/visual/${entry.sha}`,
      target: "_blank",
      rel: "noreferrer"
    });
    node.append(icon("open"), el("span", "label", "Open visual"));
    node.setAttribute("aria-label", `Open the visual of #${number}`);
  } else if (state === "making") {
    node = el("span", "history-action history-making");
    node.setAttribute("role", "status");
    node.tabIndex = -1;
    node.title = `The tab #${number} visual makes the page`;
    node.append(icon("pending"), el("span", "", "Making…"));
  } else {
    node = el("button", "btn ghost history-action");
    node.type = "button";
    node.append(icon("diff"), el("span", "label", state === "starting" ? "Starting…" : "Make visual"));
    node.setAttribute("aria-label", `Make the visual of #${number}`);
    if (state === "starting")
      node.setAttribute("aria-busy", "true");
    else
      node.addEventListener("click", () => void makeVisual(number));
  }
  node.dataset.visual = String(number);
  return node;
};
var drawHistory = () => {
  const panel = $("panel");
  const active = panel.contains(document.activeElement) ? document.activeElement : null;
  const href = active?.getAttribute("href");
  const label = active?.getAttribute("aria-label");
  const visual = active?.dataset.visual;
  const scroll = panel.querySelector(".history-body")?.scrollTop ?? 0;
  const history = data?.history;
  const error = isServerDown ? SERVER_DOWN : data?.source.error;
  panel.dataset.state = "history";
  panel.setAttribute("aria-label", "Landed history");
  const head = el("div", "panel-head history-head");
  head.append(el("h2", "", history ? `Landed on ${history.trunk}` : "Landed history"), iconButton("close", "Close history (Esc)", () => setHistory(false)));
  const body = el("div", "history-body");
  if (!history)
    body.append(el("p", "history-note", error ? `Cannot read history: ${error}` : "Loading landed history…"));
  else {
    if (error) {
      const warning = el("p", "warning", `${error}. History shows the last good read.`);
      warning.setAttribute("role", "status");
      body.append(warning);
    }
    body.append(el("p", "history-note", "Latest 20 issues. A landing can later be reverted."));
    const list = el("ol", "history-list");
    for (const entry of history.entries) {
      const row = el("li", "history-row");
      const issue = link("history-number", `#${entry.number}`, entry.url);
      const title = link("history-title", entry.title, entry.url);
      const commit = link("history-sha", entry.sha.slice(0, 7), entry.commitUrl);
      commit.setAttribute("aria-label", `Commit ${entry.sha}`);
      commit.title = entry.sha;
      const time = el("time", "", new Date(entry.committedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }));
      time.dateTime = entry.committedAt;
      time.title = `Commit time: ${entry.committedAt}`;
      time.setAttribute("aria-label", time.title);
      const meta = el("span", "history-meta");
      const dot = el("span", "", "·");
      dot.setAttribute("aria-hidden", "true");
      meta.append(commit, dot, time);
      row.append(issue, title, meta, visualControl(entry));
      list.append(row);
    }
    body.append(history.entries.length ? list : el("p", "history-note", `No landed issues found on ${history.trunk}.`));
    body.append(link("history-more", `View ${history.trunk}`, history.url));
  }
  panel.replaceChildren(head, body);
  body.scrollTop = scroll;
  if (active) {
    const match = [...panel.querySelectorAll("a, button, [data-visual]")].find((node) => visual ? node.dataset.visual === visual : href ? node.getAttribute("href") === href && node.className === active.className && node.getAttribute("aria-label") === label : node.getAttribute("aria-label") === label);
    (match ?? panel.querySelector("button"))?.focus({ preventScroll: true });
  }
};
var setHistory = (isOpen) => {
  if (isOpen && isQueueOpen)
    showQueue(false);
  if (!isOpen)
    return closePanel();
  selected = null;
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  isHistoryOpen = true;
  $("history").setAttribute("aria-expanded", "true");
  document.body.classList.add("has-panel");
  $("panel").hidden = false;
  drawHistory();
  $("panel").querySelector("button")?.focus({ preventScroll: true });
  updateTail();
};
var markSeen = (key) => {
  const entry = byKey.get(key);
  if (!entry || seen === null)
    return;
  seen.set(key, signature(entry.card, entry.column));
  const node = document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
  node?.classList.remove("is-unseen");
  node?.querySelector(".unseen")?.remove();
};
var markAllSeen = () => {
  if (seen === null)
    return;
  for (const [key, { card, column }] of byKey)
    seen.set(key, signature(card, column));
};
var notify = (cards) => {
  const keys = new Set(cards.map((card) => keyOf(card)));
  const fresh = needsKeys === null ? [] : cards.filter((card) => !needsKeys.has(keyOf(card)) && !(card.sessionId === null && starting?.has(card.number)));
  const isAway = document.hidden || !document.hasFocus();
  if (isNotifyOn && isAway && "Notification" in window && Notification.permission === "granted") {
    for (const card of fresh) {
      const { title, body } = notice(card);
      const shown = new Notification(title, { body, tag: keyOf(card), icon: favicon("needs") });
      shown.addEventListener("click", () => {
        window.focus();
        if (view !== "now")
          setView("now");
        openPanel(keyOf(card));
      });
    }
  }
  needsKeys = keys;
  return fresh.map((card) => notice(card).title);
};
var startNotices = (columns) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const now = new Map;
  for (const card of cards)
    if (card.state === "starts" && card.number !== null)
      now.set(card.number, card.step);
  const lines = [];
  const before = starting;
  const previousWarnings = startupWarnings;
  starting = now;
  startupWarnings = new Map(cards.flatMap((card) => card.number !== null && card.warning ? [[card.number, card.warning]] : []));
  if (before === null)
    return lines;
  for (const [number, warning] of startupWarnings)
    if (previousWarnings.get(number) !== warning)
      lines.push(`#${number}: ${warning}`);
  for (const [number, step] of now)
    if (!before.has(number))
      lines.push(step ? `#${number} is starting the ${step} step` : `#${number} is starting a session`);
  for (const [number, step] of before) {
    if (now.has(number))
      continue;
    const card = cards.find((other) => other.number === number);
    if (card?.sessionId)
      lines.push(step ? `#${number} started the ${step} step` : `#${number} opened a session`);
  }
  return lines;
};
var drawHints = (card) => {
  const hints = $("hints");
  const entry = card ? byKey.get(card.dataset.key) : null;
  const pairs = entry ? [
    ["Enter", actionsOf(entry.card)[0]?.label],
    ["Space", "Details"],
    ["o", entry.card.url ? "Open" : null],
    ["c", copyWhat(entry.card) ? "Copy" : null],
    ["m", "Menu"]
  ] : [
    ["j", "k", "Move"],
    [FIND_KEY, "Search"]
  ];
  hints.replaceChildren(...pairs.filter((pair) => pair.at(-1)).map((pair) => {
    const node = el("span", "hint");
    node.append(...pair.slice(0, -1).map((key) => el("kbd", "", key)), pair.at(-1));
    return node;
  }));
};
var daemonItem = (daemon) => {
  const { tone, title } = AUTO[daemon.auto];
  return { text: `auto ${daemon.auto}`, tone, title: `The daemon PID ${daemon.pid} runs. ${title}` };
};
var drawStatus = (source, isDown) => {
  const changed = isServerDown !== isDown;
  isServerDown = isDown;
  if (changed && isHistoryOpen)
    drawHistory();
  const fresh = $("fresh");
  const state = isDown || source.error ? "fail" : source.readAt ? "ok" : "wait";
  const name = data?.tracker ?? "Issues";
  const text = el("span", "sb-text");
  if (isDown)
    text.append(SERVER_DOWN);
  else if (source.error)
    text.append(`cannot read: ${source.error}`);
  else if (!source.readAt)
    text.append("no data yet");
  else
    text.append("read ", timed(source.readAt, false, " ago"));
  fresh.dataset.tone = state;
  fresh.title = source.readAt ? `${name} was read at ${new Date(source.readAt).toLocaleTimeString()}` : "";
  fresh.replaceChildren(el("i", "dot"), el("span", "sb-name", name), text);
  const terminal = data?.terminal;
  const terminalNode = $("terminal");
  terminalNode.dataset.tone = terminal?.ok === true ? "ok" : terminal?.ok === false ? "fail" : "wait";
  terminalNode.title = terminal?.error ? `herdr: ${terminal.error}` : "Run and Go use herdr";
  terminalNode.querySelector(".sb-text").textContent = terminal?.ok === true ? "up" : terminal?.ok === false ? "down" : "checking";
  const daemon = $("daemon");
  daemon.hidden = !data;
  if (data) {
    const item = daemonItem(data.daemon);
    daemon.dataset.tone = item.tone;
    daemon.title = item.title;
    daemon.replaceChildren(el("i", "dot"), el("span", "sb-name", "Daemon"), el("span", "sb-text", item.text));
  }
  if (data?.picker)
    picker.update(data.picker);
  document.body.toggleAttribute("data-stale", isDown);
  $("stale").hidden = !isDown && !source.error;
};
var drawNotify = () => {
  const button = $("notify");
  const isBlocked = "Notification" in window && Notification.permission === "denied";
  const isOn = isNotifyOn && !isBlocked;
  button.replaceChildren(icon(isOn ? "bell" : "bell-off"), el("span", "sb-name", "Notify"), el("b", "", isBlocked ? "blocked" : isOn ? "on" : "off"));
  button.setAttribute("aria-pressed", String(isOn));
  button.title = isBlocked ? "The browser blocks notifications for this page" : isOn ? "A system notification shows when a card needs you" : "Show a system notification when a card needs you";
};
var panelContext = (card) => ({
  actions: actionsOf(card),
  flow: data.flow,
  on: onTracker(),
  close: closePanel
});
var drawPanelFor = () => {
  const entry = byKey.get(selected);
  if (!entry)
    return closePanel();
  $("panel").setAttribute("aria-label", "Card details");
  const focused = $("panel").contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  $("panel").replaceChildren(...drawPanel(entry.card, panelContext(entry.card)));
  if (focused)
    ($("panel").querySelector(`[aria-label="${CSS.escape(focused)}"]`) ?? $("panel").querySelector(".panel-head > .icon-btn:last-child"))?.focus({ preventScroll: true });
};
var revealCard = (key) => {
  const group = document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.closest(".epic-children[hidden]");
  if (group)
    setEpicOpen(Number(group.closest(".epic-group")?.dataset.epic), true);
};
var openPanel = (key) => {
  if (isQueueOpen)
    showQueue(false);
  if (!byKey.has(key))
    return;
  revealCard(key);
  isHistoryOpen = false;
  $("history").setAttribute("aria-expanded", "false");
  selected = key;
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.classList.add("is-selected");
  document.body.classList.add("has-panel");
  $("panel").hidden = false;
  drawPanelFor();
  markSeen(key);
  $("panel").querySelector(".panel-actions .btn, .ask .btn, .icon-btn")?.focus({ preventScroll: true });
  updateTail();
};
function closePanel() {
  const key = selected;
  const wasHistory = isHistoryOpen;
  isHistoryOpen = false;
  $("history").setAttribute("aria-expanded", "false");
  selected = null;
  document.body.classList.remove("has-panel");
  $("panel").hidden = true;
  $("panel").replaceChildren();
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  if (wasHistory)
    $("history").focus({ preventScroll: true });
  if (key) {
    revealCard(key);
    document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  updateTail();
}
var reachable = (node) => node?.closest(".epic-children[hidden]")?.closest(".epic-group")?.querySelector(".epic-row") ?? node;
var drawBoard = (next) => {
  drawQueue(next);
  const active = document.activeElement;
  const holder = active?.closest?.(".human-pill, [data-key]");
  const target = (holder?.querySelector("[data-key]") ?? holder)?.dataset.key;
  const isGo = Boolean(active?.matches?.(".human-go"));
  const epicRow = active?.closest?.(".epic-row");
  const rowGroup = epicRow?.dataset.group;
  const rowKeys = [...epicRow?.closest(".epic-group")?.querySelectorAll("[data-key]") ?? []].map((node) => node.dataset.key);
  used = new Set;
  byKey = new Map;
  const needs = next.columns.needs.length;
  document.title = pageTitle(next.repo, needsYou(next.columns).length);
  $("favicon").href = favicon(tone(next.columns));
  $("repo").textContent = next.repo;
  $("refresh").title = `${readAgain()} (r)`;
  $("dirty").hidden = !next.noRun;
  const banner = next.noRun ?? "";
  if ($("dirty").textContent !== banner)
    $("dirty").textContent = banner;
  $("summary").replaceChildren(...summary(next.columns));
  $("history-total").textContent = String(next.history?.entries.length ?? 0);
  if (isHistoryOpen)
    drawHistory();
  const board = $("columns");
  board.dataset.view = view;
  board.style.setProperty("--stages", String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle("is-calm", needs === 0);
  const idleScroll = board.querySelector(".col-idle .col-body")?.scrollTop;
  board.replaceChildren(...view === "pipeline" ? pipelineView(next.columns, next.flow) : COLUMNS.map((spec) => column(spec, next.columns[spec.key])));
  const idleBody = board.querySelector(".col-idle .col-body");
  if (idleBody && idleScroll !== undefined)
    idleBody.scrollTop = idleScroll;
  drawHuman(next.columns.human);
  board.setAttribute("aria-busy", "false");
  if (seen === null) {
    seen = new Map;
    markAllSeen();
  }
  const lines = [...notify(needsYou(next.columns)), ...startNotices(next.columns)];
  if (lines.length)
    $("announce").textContent = lines.join(". ");
  if (selected) {
    if (byKey.has(selected))
      drawPanelFor();
    else
      closePanel();
  }
  if (target) {
    const node = document.querySelector(`[data-key="${CSS.escape(target)}"]`);
    const go = isGo ? node?.closest(".human-pill")?.querySelector(".human-go") : null;
    (go ?? reachable(node))?.focus({ preventScroll: true });
  }
  if (rowGroup) {
    const row = document.querySelector(`.epic-row[data-group="${CSS.escape(rowGroup)}"]`);
    const key = rowKeys.find((name) => document.querySelector(`[data-key="${CSS.escape(name)}"]`));
    const card = key ? document.querySelector(`[data-key="${CSS.escape(key)}"]`) : null;
    (row ?? reachable(card))?.focus({ preventScroll: true });
  }
  drawHints(document.activeElement?.closest?.(".card[data-key]") ?? null);
  updateTail();
};
var drawSkeleton = () => $("columns").replaceChildren(...COLUMNS.map(({ key, name }) => {
  const section = el("section", `col col-${key}`);
  const head = el("header", "col-head");
  head.append(glyph(key), el("h2", "col-name", name));
  const body = el("div", "col-body");
  body.append(...[0, 1, 2].map(() => el("div", "card ghost-card")));
  section.append(head, body);
  return section;
}));
var showQueue = (open) => {
  isQueueOpen = open;
  if (open) {
    closePanel();
    setHistory(false);
  }
  setQueueOpen(open);
  if (!open)
    $("queue-open").focus();
};
var setView = (next) => {
  if (isQueueOpen)
    showQueue(false);
  view = next;
  store.set("view", next);
  for (const button of document.querySelectorAll(".views button"))
    button.setAttribute("aria-pressed", String(button.dataset.view === next));
  if (data)
    drawBoard(project(data));
};
var tick = () => {
  drawIntake();
  const now = Date.now();
  for (const node of document.querySelectorAll("[data-since]"))
    node.textContent = `${age(node.dataset.since, now, "fine" in node.dataset)}${node.dataset.suffix ?? ""}`;
};
var isCalm = matchMedia("(prefers-reduced-motion: reduce)");
var layoutOf = (next) => JSON.stringify([
  view,
  Object.entries(next.columns).map(([key, cards]) => [key, cards.map((card) => keyOf(card))])
]);
var last = "";
var lastLayout = "";
var source = { readAt: null, error: null };
var hasRead = false;
var timer = 0;
var reads = 0;
var accepted = 0;
var settled = 0;
var launches = new Map;
var project = (board) => {
  if (launches.size === 0)
    return board;
  const columns = { needs: [], running: [], idle: [], human: [] };
  for (const [key, cards] of Object.entries(board.columns))
    for (const card of cards) {
      const launch = card.sessionId === null ? launches.get(card.number) : undefined;
      if (!launch)
        columns[key].push(card);
      else if (launch.phase !== "failed" && card.step === launch.step && (card.state === null || card.state === "no-progress" || card.state === "blocked" && launch.step === null))
        columns.running.unshift({
          ...card,
          state: "starts",
          act: null,
          assist: false,
          run: false,
          resume: false,
          go: false,
          warning: null,
          effort: null
        });
      else
        columns[key].push({ ...card, assist: false, run: false, resume: false });
    }
  return { ...board, columns };
};
var render = (canMove = true) => {
  drawIntake();
  const next = project(data);
  const cards = JSON.stringify([
    next.repo,
    next.noRun,
    next.agents,
    next.next,
    next.flow,
    next.tracker,
    next.columns,
    next.history,
    next.source.error,
    next.queue
  ]);
  if (cards === last) {
    drawQueue(next);
    return;
  }
  const layout = layoutOf(next);
  const isMove = lastLayout !== "" && layout !== lastLayout && !document.hidden;
  if (canMove && isMove && document.startViewTransition && !isCalm.matches)
    document.startViewTransition(() => drawBoard(project(data)));
  else
    drawBoard(next);
  last = cards;
  lastLayout = layout;
};
var launch = async (card, path, agent, effort) => {
  if (isReconnecting())
    return false;
  const number = card.number;
  const current = data && Object.values(project(data).columns).flat().find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === "/api/run" ? "run" : path === "/api/assist" ? "assist" : "resume"])
    return false;
  const reason = path === "/api/resume" ? data?.noRun : path === "/api/assist" ? data?.noRun || defaultReason() : runReason(agent ?? null, number);
  if (reason) {
    toast(reason, { isError: true });
    return false;
  }
  const entry = { step: current.step, phase: "pending" };
  launches.set(number, entry);
  render(false);
  if (document.activeElement === document.body)
    document.querySelector(`[data-key="${CSS.escape(keyOf(card))}"]`)?.focus({ preventScroll: true });
  const isOk = await post(path, {
    number,
    ...path === "/api/run" && agent ? { agent } : {},
    ...path === "/api/run" && effort ? { effort } : {}
  }, path === "/api/run" ? "Run failed" : path === "/api/assist" ? "Open agent failed" : "Resume failed");
  entry.phase = isOk ? "done" : "failed";
  settled = reads;
  render();
  load();
  return isOk;
};
var loadRequest;
document.addEventListener("board-reconnect", () => {
  drawIntake();
  loadRequest?.abort();
  if (data) {
    data = { ...data, queue: null };
    drawQueue(project(data));
  }
});
document.addEventListener("board-connected", () => {
  drawIntake();
  load();
});
async function load() {
  clearTimeout(timer);
  if (isReconnecting())
    return;
  loadRequest = new AbortController;
  const isLocal = hasRead && document.hidden;
  const read = ++reads;
  try {
    const response = await fetch(`/api/board${isLocal ? "?local=1" : ""}`, { signal: loadRequest.signal });
    if (!response.ok)
      throw new Error(response.statusText);
    const next = await response.json();
    if (read > accepted && read > settled) {
      accepted = read;
      data = next;
      hasRead = true;
      for (const [number, launch] of launches)
        if (launch.phase !== "pending")
          launches.delete(number);
      render();
      source = data.source;
      drawStatus(source, false);
    }
  } catch {
    if (!isReconnecting() && read > accepted && read > settled) {
      accepted = read;
      if (data)
        data = { ...data, queue: null };
      drawStatus(source, true);
      if (data)
        drawQueue(project(data));
    }
  }
  tick();
  timer = setTimeout(load, document.hidden ? 15000 : 5000);
}
var move = (across, down) => {
  const lists = [...document.querySelectorAll("#columns .col")].map((col) => [...col.querySelectorAll(".card[data-key], .epic-row")].filter(isStop));
  const current = document.activeElement?.closest?.(".card[data-key], .epic-row");
  const at = lists.findIndex((list) => list.includes(current));
  if (at < 0)
    return lists.flat()[0]?.focus();
  const row = lists[at].indexOf(current);
  if (down)
    return lists[at][Math.min(Math.max(row + down, 0), lists[at].length - 1)].focus();
  for (let next = at + across;next >= 0 && next < lists.length; next += across) {
    if (lists[next].length)
      return lists[next][Math.min(row, lists[next].length - 1)].focus();
  }
};
var boardActions = () => [
  { label: "Show the issue queue", icon: "stages", key: "", run: () => showQueue(true) },
  { label: readAgain(), icon: "refresh", key: "r", run: () => $("refresh").click() },
  {
    label: isHistoryOpen ? "Hide history" : "Show history",
    icon: "clock",
    key: "d",
    run: () => setHistory(!isHistoryOpen)
  },
  {
    label: isNotifyOn ? "Turn notifications off" : "Turn notifications on",
    icon: isNotifyOn ? "bell-off" : "bell",
    key: "",
    run: toggleNotify
  },
  { label: "Show the keyboard shortcuts", icon: "keyboard", key: "?", run: () => $("keys").showModal() }
];
var paletteItems = () => {
  if (!data)
    return [];
  const items = [];
  const add = (group, card, _key, action) => items.push({
    group,
    number: card.number,
    label: action.name.replace(/, #\d+$/, "").replace(/ of #\d+$/, "").replace(/^(Open issue) #\d+/, "$1"),
    context: card.title,
    icon: action.icon,
    tone: group === "Needs you" ? "needs" : null,
    key: "",
    run: action.href ? () => window.open(action.href, "_blank", "noopener,noreferrer") : action.run
  });
  const shown = project(data);
  for (const [column, group] of [
    ["needs", "Needs you"],
    ["running", "Running"],
    ["idle", "Run the next step"],
    ["human", "Human sessions"]
  ]) {
    for (const card of shown.columns[column]) {
      const key = [...byKey].find(([, entry]) => entry.card === card)?.[0] ?? keyOf(card);
      const [main] = actionsOf(card);
      if (main && !main.isDisabled)
        add(group, card, key, main);
      else if (card.number !== null || card.sessionId)
        items.push({
          group,
          number: card.number,
          label: "Show the details",
          context: card.title,
          icon: "panel",
          tone: null,
          key: "",
          run: () => openPanel(key)
        });
      if (card.run && card.number !== null && data?.agents && !data?.noRun) {
        for (const [id, entry] of Object.entries(data.agents)) {
          if (!entry.available)
            continue;
          const display = agentDisplay(id);
          items.push({
            group,
            number: card.number,
            label: `Run #${card.number} with ${id}`,
            context: card.title,
            icon: "run",
            tone: group === "Needs you" ? "needs" : null,
            key: "",
            title: runTitle(card.step, data.flow, card.effort),
            run: async () => {
              if (await launch(card, "/api/run", id))
                toast(`Started the ${card.step} step of #${card.number} with ${display} in a new herdr tab`);
            }
          });
        }
      }
    }
  }
  for (const card of shown.history?.entries ?? [])
    if (card.url)
      items.push({
        group: "History",
        number: card.number,
        label: `Open the issue${onTracker()}`,
        context: card.title,
        icon: "open",
        tone: null,
        key: "",
        run: () => window.open(card.url, "_blank", "noopener,noreferrer")
      });
  items.push({ group: "Board", number: null, context: "", ...agentOrderEntry }, {
    group: "Board",
    number: null,
    label: view === "now" ? "Show the pipeline" : "Show what needs you now",
    context: "",
    icon: view === "now" ? "stages" : "board",
    key: "v",
    run: () => setView(view === "now" ? "pipeline" : "now")
  }, ...boardActions().map((action) => ({ group: "Board", number: null, context: "", ...action })), {
    group: "Board",
    number: null,
    label: "Expand all epic groups",
    context: "",
    icon: "chevron",
    key: "",
    run: () => {
      storeOpenEpics((open) => {
        for (const card of shown.columns.idle)
          if (card.epic)
            open.add(card.epic.number);
      });
      drawBoard(project(data));
    }
  }, {
    group: "Board",
    number: null,
    label: "Collapse all epic groups",
    context: "",
    icon: "chevron",
    key: "",
    run: () => {
      storeOpenEpics((open) => open.clear());
      drawBoard(project(data));
    }
  });
  return items;
};
async function toggleNotify() {
  if (!("Notification" in window))
    return toast("This browser has no notifications", { isError: true });
  if (!isNotifyOn && Notification.permission === "default")
    await Notification.requestPermission();
  if (Notification.permission === "denied") {
    isNotifyOn = false;
    toast("The browser blocks notifications for this page", {
      detail: "Allow them in the site settings of the browser, then press Notify again.",
      isError: true
    });
  } else if (Notification.permission === "default") {
    isNotifyOn = false;
    toast("Notifications stay off", {
      detail: "The browser did not get your permission. Press Notify again to answer it."
    });
  } else {
    isNotifyOn = !isNotifyOn;
    toast(isNotifyOn ? "Notifications are on" : "Notifications are off", {
      detail: isNotifyOn ? "A system notification shows when a card needs you and the board is not in front." : ""
    });
  }
  store.set("notify", isNotifyOn ? "on" : "off");
  drawNotify();
}
var KEYS = {
  j: () => move(0, 1),
  k: () => move(0, -1),
  h: () => move(-1, 0),
  l: () => move(1, 0),
  r: () => $("refresh").click(),
  d: () => setHistory(!isHistoryOpen),
  v: () => setView(view === "now" ? "pipeline" : "now"),
  "?": () => $("keys").showModal(),
  "/": () => openPalette(paletteItems())
};
var CARD_KEYS = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
  Enter: (card) => card.querySelector(".main-action")?.click(),
  " ": (card) => openPanel(card.dataset.key),
  o: (card) => card.dataset.url && window.open(card.dataset.url, "_blank", "noopener,noreferrer"),
  c: (card) => {
    const entry = byKey.get(card.dataset.key);
    if (entry && copyWhat(entry.card))
      copy(entry.card.act, copyWhat(entry.card));
  },
  m: (card) => {
    const entry = byKey.get(card.dataset.key);
    if (entry)
      openMenu(card.querySelector(".more") ?? card, menuOf(entry.card, card.dataset.key));
  }
};
var ROW_KEYS = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0)
};
var updates = setupUpdates();
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || updates.contains(event.target) || $("agent-picker").contains(event.target))
    return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!$("palette").open)
      openPalette(paletteItems());
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || $("keys").open || $("palette").open)
    return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]"))
    return;
  if (event.key === "Escape" && !$("menu").matches(":popover-open") && updates.dismiss()) {
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && isHistoryOpen) {
    event.preventDefault();
    return setHistory(false);
  }
  if (event.key === "Escape" && selected) {
    event.preventDefault();
    return closePanel();
  }
  if (isQueueOpen && !["r", "d", "v", "?", "/"].includes(event.key))
    return;
  const card = document.activeElement?.matches?.(".card[data-key]") ? document.activeElement : null;
  const isRow = document.activeElement?.matches?.(".epic-row");
  const press = card && CARD_KEYS[event.key] || isRow && ROW_KEYS[event.key] || isKeysOn && KEYS[event.key];
  if (!press)
    return;
  event.preventDefault();
  press(card);
});
var columns = $("columns");
columns.addEventListener("click", (event) => {
  const node = event.target.closest(".card[data-key]");
  if (!node || event.target.closest("a, button"))
    return;
  if (selected === node.dataset.key)
    return closePanel();
  openPanel(node.dataset.key);
});
columns.addEventListener("contextmenu", (event) => {
  const node = event.target.closest(".card[data-key]");
  const entry = node && byKey.get(node.dataset.key);
  if (!entry)
    return;
  event.preventDefault();
  openMenu(node.querySelector(".more") ?? node, menuOf(entry.card, node.dataset.key));
});
columns.addEventListener("focusin", (event) => {
  const node = event.target.closest(".card[data-key]");
  if (node)
    markSeen(node.dataset.key);
  drawHints(node);
});
columns.addEventListener("focusout", (event) => {
  if (!columns.contains(event.relatedTarget))
    drawHints(null);
});
columns.addEventListener("pointerover", (event) => {
  const node = event.target.closest(".card[data-key].is-unseen");
  if (node)
    markSeen(node.dataset.key);
});
columns.addEventListener("scroll", updateTail, true);
addEventListener("resize", updateTail);
addEventListener("storage", (event) => {
  if (event.key !== null && event.key !== store.key("open-epics"))
    return;
  const active = document.activeElement;
  openEpics = parseOpenEpics(event.newValue ?? "");
  showOpenEpics();
  if (active?.closest(".epic-children[hidden]"))
    reachable(active)?.focus({ preventScroll: true });
});
addEventListener("blur", markAllSeen);
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    markAllSeen();
  else
    load();
});
$("logo").append(icon("logo"));
$("refresh").prepend(icon("refresh"));
$("refresh").addEventListener("click", async () => {
  if ($("refresh").getAttribute("aria-busy") === "true")
    return;
  $("refresh").setAttribute("aria-busy", "true");
  await act("/api/refresh", {}, "Refresh failed");
  $("refresh").removeAttribute("aria-busy");
});
$("find").prepend(icon("search"));
$("find").querySelector("kbd").textContent = FIND_KEY;
$("find").addEventListener("click", () => openPalette(paletteItems()));
for (const button of document.querySelectorAll(".views button")) {
  button.prepend(icon(button.dataset.view === "now" ? "board" : "stages"));
  button.setAttribute("aria-label", `${button.querySelector(".label").textContent} view`);
  button.setAttribute("aria-pressed", String(button.dataset.view === view));
  button.addEventListener("click", () => setView(button.dataset.view));
}
$("intake").prepend(icon("spark"));
$("intake").addEventListener("click", () => void openIntake());
drawIntake();
$("history").prepend(icon("clock"));
$("history").addEventListener("click", () => setHistory(!isHistoryOpen));
$("history-count").prepend(icon("clock"));
$("history-count").addEventListener("click", () => setHistory(true));
$("notify").addEventListener("click", toggleNotify);
$("board-more").append(icon("dots"));
$("board-more").addEventListener("click", () => openMenu($("board-more"), boardActions()));
$("keys-open").prepend(icon("keyboard"));
$("keys-open").addEventListener("click", () => $("keys").showModal());
$("keys-close").append(icon("close"));
$("keys-close").addEventListener("click", () => $("keys").close());
$("keys").addEventListener("click", (event) => {
  if (event.target === $("keys"))
    $("keys").close();
});
$("keys-on").checked = isKeysOn;
$("keys-on").addEventListener("change", () => {
  isKeysOn = $("keys-on").checked;
  store.set("keys", isKeysOn ? "on" : "off");
});
$("toast-close").append(icon("close"));
$("toast-close").addEventListener("click", () => {
  $("toast").hidden = true;
});
setupQueue({
  back: () => showQueue(false),
  refresh: async () => {
    settled = reads;
    await load();
  }
});
$("queue-open").addEventListener("click", () => showQueue(!isQueueOpen));
var replaceOrder = async (order, expectedVersion) => {
  if (isReconnecting())
    throw new Error("the board is reconnecting");
  settled = reads;
  try {
    let response;
    try {
      response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, expectedVersion }),
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw new Error(`${SERVER_DOWN}. Refresh before another change.`);
    }
    const body = await response.json().catch(() => null);
    if (response.ok && body && "order" in body)
      return body.order;
    if (response.status === 409 && body && "latest" in body)
      throw new OrderConflict(body.latest, body.error);
    throw new Error(body && "error" in body ? body.error : `the server answered ${response.status}`);
  } finally {
    settled = reads;
    load();
  }
};
var retryWait = async (number, waitId) => {
  const outcome = await post("/api/run", { number, waitId }, "Retry failed", { timeout: 150000 });
  settled = reads;
  load();
  if (outcome.status !== "accepted")
    throw new Error(outcome.error ?? SERVER_DOWN);
};
var picker = createAgentPicker($("agent-picker"), { replace: replaceOrder, retry: retryWait });
setupPalette();
setupMenu();
drawNotify();
drawHints(null);
setInterval(tick, 1000);
drawSkeleton();
drawStatus(source, false);
load();
