import {
  type CommandName,
  type Entry,
  type Flag,
  type Form,
  formText,
  sessionCode,
  usageLine,
} from '../contract/contract.ts';

export type Parameter = Readonly<{
  name: string;
  kind: 'string' | 'enum' | 'boolean' | 'array';
  values?: readonly string[];
  required: boolean;
}>;
export type Tool = Readonly<{
  name: string;
  command: CommandName;
  description: string;
  readOnly: boolean;
  parameters: readonly Parameter[];
  forms: readonly Form[];
}>;
export type Input = Readonly<Record<string, string | boolean | readonly string[] | undefined>>;
type Arguments = { kind: 'argv'; argv: readonly string[] } | { kind: 'refused'; line: string };

export const notCovered: readonly string[] = ['intake', 'assist <n>', 'visual <n> <sha>'];
const excluded: ReadonlySet<string> = new Set(['update', 'install', 'agents', 'root', 'mcp']);

const slot = (word: string) => /^[<'[]/.test(word) || /^[A-Z][A-Z0-9_]*$/.test(word);
const choice = (word: string) => !slot(word) && word.includes('|');
const switched = (word: string) => word.startsWith('--');
const literal = (word: string) => !slot(word) && !choice(word) && !switched(word);
const derived = (word: string) => {
  const found = /^(?:<([a-z][a-z0-9-]*)>|'<([a-z][a-z0-9-]*)>'|\[([a-z][a-z0-9-]*)\])$/.exec(word);
  return found?.[1] ?? found?.[2] ?? found?.[3];
};
const nameOf = (form: Form, word: string) => form.names?.[word] ?? derived(word);
const covered = (entry: Entry, form: Form) => entry.agent && !entry.internal && form.passThrough !== sessionCode;

function flagParameter(flag: Flag): Parameter {
  const name = flag.name.slice(2);
  const required = !flag.optional;
  if (flag.repeats) return { name, kind: 'array', required };
  if (flag.value === undefined) return { name, kind: 'boolean', required };
  if (flag.value.includes('|')) return { name, kind: 'enum', values: flag.value.split('|'), required };
  return { name, kind: 'string', required };
}

function parametersOf(form: Form): Parameter[] {
  const words = form.words.flatMap((word): Parameter[] => {
    if (literal(word)) return [];
    if (switched(word)) return [{ name: word.slice(2), kind: 'boolean', required: true }];
    const name = nameOf(form, word);
    if (name === undefined) return [];
    if (choice(word)) return [{ name, kind: 'enum', values: word.split('|'), required: true }];
    return [{ name, kind: 'string', required: !word.startsWith('[') }];
  });
  return [...words, ...form.flags.map(flagParameter)];
}

const absent = (value: Input[string]) =>
  value === undefined || value === false || (typeof value === 'object' && value.length === 0);
const present = (input: Input) => Object.keys(input).filter((key) => !absent(input[key]));

function selects(form: Form, input: Input): boolean {
  const own = parametersOf(form);
  const given = present(input);
  return (
    own.every(({ name, required }) => !required || given.includes(name)) &&
    given.every((key) => own.some(({ name }) => name === key))
  );
}

function build(tool: Tool, form: Form, input: Input): string[] {
  const words = form.words.flatMap((word) => {
    if (literal(word) || switched(word)) return [word];
    const name = nameOf(form, word);
    const value = name === undefined ? undefined : input[name];
    return typeof value === 'string' ? [value] : [];
  });
  const order = [...new Set(tool.forms.flatMap(({ flags }) => flags.map(({ name }) => name)))];
  const flags = order.flatMap((name) => {
    if (!form.flags.some((flag) => flag.name === name)) return [];
    const value = input[name.slice(2)];
    if (value === true) return [name];
    if (typeof value === 'string') return [name, value];
    if (typeof value === 'object') return value.flatMap((each) => [name, each]);
    return [];
  });
  return [...words, ...flags];
}

const leadOf = ({ words }: Form) => {
  const end = words.findIndex((word) => !literal(word));
  return end < 0 ? words : words.slice(0, end);
};

const fits = (element: string, word: string) =>
  slot(word) || (choice(word) ? word.split('|').includes(element) : element === word);

function matches(argv: readonly string[], { words, flags }: Form): boolean {
  let at = 0;
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const element = argv[index] as string;
    if (element.startsWith('--') && words[at] !== element) {
      const flag = flags.find(({ name }) => name === element);
      if (!flag) return false;
      seen.add(flag.name);
      if (flag.value !== undefined && ++index >= argv.length) return false;
      continue;
    }
    const word = words[at];
    if (word === undefined || !fits(element, word)) return false;
    at++;
  }
  return (
    words.slice(at).every((word) => word.startsWith('[')) && flags.every((flag) => flag.optional || seen.has(flag.name))
  );
}

export function toolSet(entries: readonly Entry[]): readonly Tool[] {
  const groups = new Map<string, { name: string; command: CommandName; entries: Entry[]; forms: Form[] }>();
  for (const entry of entries)
    for (const form of entry.forms) {
      if (!covered(entry, form)) continue;
      const name = form.words.filter(literal).join('_');
      const key = `${entry.command}\0${name}`;
      const group = groups.get(key) ?? { name, command: entry.command, entries: [], forms: [] };
      groups.set(key, group);
      group.forms.push(form);
      if (!group.entries.includes(entry)) group.entries.push(entry);
    }
  return [...groups.values()].map(({ name, command, entries: owners, forms }) => {
    const lists = forms.map(parametersOf);
    const parameters = new Map<string, Parameter>();
    for (const parameter of lists.flat())
      if (!parameters.has(parameter.name))
        parameters.set(parameter.name, {
          ...parameter,
          required: lists.every((list) => list.some((each) => each.name === parameter.name && each.required)),
        });
    const summaries = forms.flatMap(({ help }) => (help ? [help.summary] : []));
    return {
      name,
      command,
      description: (summaries.length ? summaries : owners.map(({ description }) => description)).join(' '),
      readOnly: forms.every(({ read }) => read === true),
      parameters: [...parameters.values()],
      forms,
    };
  });
}

function invalid(parameter: Parameter, value: string | true | readonly string[]): boolean {
  switch (parameter.kind) {
    case 'boolean':
      return value !== true;
    case 'array':
      return typeof value !== 'object' || !value.every((each) => typeof each === 'string');
    case 'string':
      return typeof value !== 'string';
    case 'enum':
      return typeof value !== 'string' || !parameter.values?.includes(value);
  }
}

export function argumentsOf(tool: Tool, input: Input, entries: readonly Entry[]): Arguments {
  const refuse = (reason: string): Arguments => ({ kind: 'refused', line: `${reason}\n${usageLine(tool.command)}` });
  for (const key of present(input)) {
    const value = input[key] as string | true | readonly string[];
    const parameter = tool.parameters.find(({ name }) => name === key);
    if (!parameter) return refuse(`${tool.name}: ${key} is no parameter of this tool`);
    if (invalid(parameter, value))
      return refuse(`${tool.name}: ${key} has a value of another kind than ${parameter.kind}`);
    if ((typeof value === 'object' ? value : [value]).some((each) => typeof each === 'string' && each.startsWith('-')))
      return refuse(`${tool.name}: the value of ${key} starts with -`);
  }
  const selected = tool.forms.filter((form) => selects(form, input));
  if (!selected.length) return refuse(`${tool.name}: the input matches no form`);
  const lists = selected.map((form) => build(tool, form, input));
  const [argv] = lists as [string[], ...string[][]];
  if (lists.some((each) => each.join('\0') !== argv.join('\0')))
    return refuse(`${tool.name}: the input matches ${selected.map((form) => `\`${formText(form)}\``).join(' and ')}`);
  if (!selected.every((form) => matches(argv, form)))
    return refuse(`${tool.name}: the arguments ${argv.join(' ')} do not match the form of the input`);
  const forms = entries.filter(({ command }) => command === tool.command).flatMap(({ forms }) => forms);
  const other = forms.find((form) => !selected.includes(form) && matches(argv, form));
  if (other) return refuse(`${tool.name}: the arguments ${argv.join(' ')} also match \`${formText(other)}\``);
  // The command files route by these leading words before they check the arity of the act.
  const routed = forms.find((form) => {
    const lead = leadOf(form);
    return !tool.forms.includes(form) && lead.length > 1 && lead.every((word, at) => argv[at] === word);
  });
  if (routed)
    return refuse(`${tool.name}: the arguments ${argv.join(' ')} start with the words of \`${formText(routed)}\``);
  return { kind: 'argv', argv };
}

function sample(parameters: readonly Parameter[]): Input {
  let count = 0;
  const next = () => `v${++count}`;
  const value = ({ kind, values }: Parameter) =>
    kind === 'boolean' ? true : kind === 'array' ? [next(), next()] : kind === 'enum' ? values?.[0] : next();
  return Object.fromEntries(parameters.map((parameter) => [parameter.name, value(parameter)]));
}

export function checkTools(entries: readonly Entry[]): string[] {
  const errors: string[] = [];
  const fail = (line: string) => errors.push(`verify: mcp tools: ${line}`);
  for (const entry of entries)
    for (const form of entry.forms) {
      const text = formText(form);
      for (const key of Object.keys(form.names ?? {}))
        if (!form.words.includes(key) || literal(key) || switched(key))
          fail(`\`${text}\` declares a name for ${key}, which is no slot or enum word of the form`);
      if (!covered(entry, form)) {
        if (entry.agent && !entry.internal && !notCovered.includes(text))
          fail(`\`${text}\` is an agent form with no tool and is not covered; give it a tool or add it to notCovered`);
        continue;
      }
      if (form.read === undefined) fail(`\`${text}\` is a covered form with no read value`);
      for (const word of form.words)
        if ((slot(word) || choice(word)) && nameOf(form, word) === undefined)
          fail(`\`${text}\`: the word ${word} has no parameter name; declare one in names`);
      const names = parametersOf(form).map(({ name }) => name);
      for (const name of new Set(names.filter((name, at) => names.indexOf(name) !== at)))
        fail(`\`${text}\` gives the parameter ${name} twice`);
      if (names.includes('checkout'))
        fail(`\`${text}\` has a parameter checkout, which names the folder of each call; declare another name`);
    }
  const claimed = new Map<string, Tool>();
  for (const tool of toolSet(entries)) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) fail(`the tool name ${tool.name} breaks the MCP name rule`);
    const mapped = tool.name.replace(/[^A-Za-z0-9_-]/g, '_');
    const holder = claimed.get(mapped);
    if (holder)
      fail(
        `the tools ${holder.name} of ${holder.command} and ${tool.name} of ${tool.command} share the Claude Code name ${mapped}`,
      );
    else claimed.set(mapped, tool);
    if (excluded.has(tool.command))
      fail(`the tool ${tool.name} holds a form of ${tool.command}, which an agent never runs`);
    const kinds = new Map<string, Parameter>();
    for (const parameter of tool.forms.flatMap(parametersOf)) {
      const prior = kinds.get(parameter.name);
      if (!prior) kinds.set(parameter.name, parameter);
      else if (prior.kind !== parameter.kind || prior.values?.join('|') !== parameter.values?.join('|'))
        fail(`the tool ${tool.name} has the parameter ${parameter.name} with two kinds or two value lists`);
    }
    tool.forms.forEach((first, at) => {
      for (const second of tool.forms.slice(at + 1)) {
        const one = parametersOf(first);
        const two = parametersOf(second);
        const union = [...one, ...two].filter(({ required }) => required).map(({ name }) => name);
        const shared = one.filter(({ name }) => two.some((each) => each.name === name)).map(({ name }) => name);
        for (const names of [union, shared]) {
          const input = sample(tool.parameters.filter(({ name }) => names.includes(name)));
          if (
            selects(first, input) &&
            selects(second, input) &&
            build(tool, first, input).join('\0') !== build(tool, second, input).join('\0')
          )
            fail(
              `one input of ${tool.name} matches two forms, \`${formText(first)}\` and \`${formText(second)}\`, with different argument lists`,
            );
        }
      }
      const result = argumentsOf(tool, sample(parametersOf(first)), entries);
      if (result.kind === 'refused')
        fail(`\`${formText(first)}\`: the sample input is refused: ${result.line.split('\n')[0]}`);
      else if (!matches(result.argv, first))
        fail(`\`${formText(first)}\`: the sample arguments ${result.argv.join(' ')} do not match the form`);
    });
  }
  return errors;
}
