import type { Host } from '../lib/config-core.ts';
import { type Program, readProgram } from '../lib/program.ts';
import { selectSavedSession } from '../lib/session.ts';

export type Adapter = Readonly<{
  run(number: number, agent: Host): Promise<string>;
  resume(number: number): Promise<string>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;
// PowerShell also reads U+2018 to U+201B as single quotes.
const quote = (text: string) =>
  process.platform === 'win32'
    ? `'${text.replace(/['\u2018-\u201b]/g, (mark) => mark + mark)}'`
    : `'${text.replaceAll("'", "'\\''")}'`;

export async function celetisAdapter(
  main: string,
  read: () => Promise<Program | null> = readProgram,
): Promise<Adapter> {
  const line = async (args: string[], number: number) => {
    const program = await read();
    if (!program)
      throw new Error('the celetis program is not installed; run the first install of README.md, "First install"');
    if (CONTROL.test(program.command)) throw new Error('the celetis program path has a control character');
    const words = [program.command, ...args].map(quote).join(' ');
    return process.platform === 'win32' ? `& ${words} ${number}; if ($?) { exit }` : `${words} ${number} && exit`;
  };
  return {
    run: (number, agent) => line(['--agent', agent, 'celetis-flow'], number),
    resume: async (number) => {
      await selectSavedSession(main, number);
      return line(['celetis-flow', '--resume'], number);
    },
  };
}
