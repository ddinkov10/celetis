export function entryParts(text: string): { readonly line: string; readonly contract: string } {
  function heading(title: string, after: number) {
    const index = text.indexOf(`\n${title}\n`, after);
    if (index < 0)
      throw new Error(
        `plugins/celetis/references/procedures/entry.md needs the heading ${title} after the one before it`,
      );
    return index;
  }

  const lineAt = heading('## The entry line', 0);
  const withoutAt = heading('## Entry without the hook', lineAt + 1);
  const contractAt = heading('## The contract', withoutAt + 1);
  const codexAt = heading('### Codex', heading('### Claude Code', contractAt + 1) + 1);
  const line = text.slice(lineAt + '\n## The entry line\n'.length, withoutAt).trim();
  if (!line.startsWith('**Celetis entry.** ') || line.includes('\n'))
    throw new Error(
      'plugins/celetis/references/procedures/entry.md: the entry line is one line that starts with **Celetis entry.**',
    );
  return { line, contract: text.slice(contractAt + 1, codexAt).trim() };
}
