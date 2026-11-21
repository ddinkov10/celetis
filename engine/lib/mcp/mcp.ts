import { stat } from 'node:fs/promises';
import { isAbsolute, parse } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { commands, contractVersions, exits, usage } from '../contract/contract.ts';
import { versionFolderGone } from '../install/version-folder.ts';
import { type Outcome, outcomeOf, runForm } from './call.ts';
import { argumentsOf, type Input, type Parameter, type Tool, toolSet } from './tools.ts';

const outputSchema = z.object({
  code: z.number().int(),
  class: z.string().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  json: z.unknown(),
});

function valueSchema({ kind, values }: Parameter) {
  switch (kind) {
    case 'string':
      return z.string();
    case 'enum':
      return z.enum(values ?? []);
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(z.string());
  }
}

const inputSchema = ({ parameters }: Tool) =>
  z
    .object({
      checkout: z.string(),
      ...Object.fromEntries(
        parameters.map((parameter) => {
          const schema = valueSchema(parameter);
          return [parameter.name, parameter.required ? schema : schema.optional()];
        }),
      ),
    })
    .strict();

const refusal = (code: number, text: string) => outcomeOf(code, '', `${text}\n`);

const driveRelative = (path: string) => process.platform === 'win32' && parse(path).root.length === 1;

async function isFolder(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function call(root: string, host: string, tool: Tool, checkout: string, input: Input): Promise<Outcome> {
  if (!isAbsolute(checkout) || driveRelative(checkout))
    return refusal(exits.usage, `celetis: the checkout ${checkout} is not an absolute path`);
  if (!(await isFolder(checkout))) return refusal(exits.usage, `celetis: the checkout ${checkout} is not a folder`);
  const built = argumentsOf(tool, input, commands);
  if (built.kind === 'refused')
    return refusal(exits.usage, usage(tool.command, built.line.slice(0, built.line.lastIndexOf('\n'))));
  if (await versionFolderGone(root))
    return refusal(
      exits.prerequisite,
      'celetis: an update removed the engine version of this session; start a fresh session',
    );
  return runForm(root, host, built.argv, checkout);
}

export async function serve(root: string, host: string): Promise<void> {
  const server = new McpServer({
    name: 'celetis',
    version: String(Math.max(...contractVersions.serves.map(({ contract }) => contract))),
  });
  for (const tool of toolSet(commands))
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputSchema(tool),
        outputSchema,
        annotations: { readOnlyHint: tool.readOnly },
      },
      async ({ checkout, ...input }) => {
        const outcome = await call(root, host, tool, checkout, input);
        return {
          content: [{ type: 'text', text: JSON.stringify(outcome) }],
          structuredContent: outcome,
          isError: outcome.code !== 0,
        };
      },
    );
  const closed = new Promise<void>((resolve) => {
    server.server.onclose = resolve;
  });
  await server.connect(new StdioServerTransport());
  await closed;
}
