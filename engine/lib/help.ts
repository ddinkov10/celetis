export const helpCommands: readonly (readonly [form: string, summary: string])[] = [
  ['celetis update', 'Updates the program and the plugin of each host; asks once.'],
  ['celetis update check', 'Shows the installed and the available revision of each part.'],
  ['celetis board', 'Starts the board of the project in this checkout.'],
  ['celetis assist <n>', 'Starts fresh interactive assistance for an issue in the main checkout.'],
  ['celetis celetis-flow', 'Starts the automatic runner.'],
  ['celetis celetis-flow <n>', 'Starts the next step of one issue, then follows its auto gates.'],
  ['celetis celetis-flow --resume <n>', 'Opens the session of a step with no progress again.'],
  [
    'celetis celetis-flow --queue start <step> <n>...',
    'Submits a fixed order; explicitly starts only the first displayed step.',
  ],
  [
    'celetis celetis-flow --queue continue <id> <revision> <step>',
    'Starts the displayed waiting step, then follows fresh gates.',
  ],
  [
    'celetis celetis-flow --queue retry <id> <revision> <step|none>',
    'Recovers the displayed stopped queue; none acknowledges closure.',
  ],
  [
    'celetis celetis-flow --queue reset <id> <revision>',
    'Removes an unowned schedule; keeps issues, worktrees, and sessions.',
  ],
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
