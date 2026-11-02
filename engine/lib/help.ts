export const helpCommands: readonly (readonly [form: string, summary: string])[] = [
  ['celetis update', 'Updates the program and the plugin of each host; asks once.'],
  ['celetis update check', 'Shows the installed and the available revision of each part.'],
  ['celetis board', 'Starts the board of the project in this checkout.'],
  ['celetis intake', 'Starts a fresh session that asks for your request before intake.'],
  ['celetis assist <n>', 'Starts fresh interactive assistance for an issue in the main checkout.'],
  ['celetis celetis-flow', 'Starts the automatic runner.'],
  ['celetis celetis-flow <n>', 'Starts the next step of one issue, then follows its auto gates.'],
  [
    'celetis celetis-flow <n> --effort <level>',
    'Starts the next step of one issue at another effort level, this start only.',
  ],
  ['celetis celetis-flow --resume <n>', 'Opens the session of a step with no progress again.'],
  [
    "celetis celetis-flow --queue action '<QueueAction JSON>'",
    'Saves a queue action; starts its authorized wake in this foreground.',
  ],
  ['celetis celetis-flow --queue status', 'Reads the current queue and its allowed actions.'],

  ['celetis lesson-store read main|active', 'Reads validated lessons; requires explicit --agent.'],
  ['celetis lesson-store capture FILE', 'Saves a pending proposal; requires explicit --agent.'],
  ['celetis lesson-store preview FILE', 'Prepares an exact lesson review; requires explicit --agent.'],
  ['celetis lesson-store apply SNAPSHOT DIGEST', 'Applies the reviewed snapshot; requires explicit --agent.'],
  ['celetis lesson-store recover', 'Completes an interrupted lesson write; requires explicit --agent.'],

  ['celetis root', 'Prints the folder of the program.'],
  ['celetis --version', 'Prints the revision of the program.'],
  ['celetis help', 'Prints this list.'],
];

const width = Math.max(...helpCommands.map(([form]) => form.length));

export const helpText = [
  'usage: celetis [--agent <host>] <command> [<argument>...]',
  '',
  ...helpCommands.map(([form, summary]) => `  ${form.padEnd(width)}  ${summary}`),
  '',
  'In a terminal, --agent claude|codex is optional. With no --agent, the program uses host in',
  '.celetis.yaml, else claude.',
  'The skills run the other commands. README.md, "The commands", in the folder that celetis root',
  'prints, lists all of them.',
].join('\n');
