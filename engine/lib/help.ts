export const helpCommands: readonly (readonly [form: string, summary: string])[] = [
  ['celetis update', 'Updates the program and the plugin of each host; asks once.'],
  ['celetis update check', 'Shows the installed and the available revision of each part.'],
  ['celetis board', 'Starts the board of the project in this checkout.'],
  ['celetis assist <n>', 'Starts fresh interactive assistance for an issue in the main checkout.'],
  ['celetis celetis-flow', 'Starts the automatic runner.'],
  ['celetis celetis-flow <n>...', 'Runs the next step of each issue, in this order.'],
  ['celetis celetis-flow --resume <n>', 'Opens the session of a step with no progress again.'],
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
