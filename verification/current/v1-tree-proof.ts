import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classify, fileRoles, generatedFiles } from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/scripts/verify.ts';
import { discoverTests, processEntries } from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/suite.ts';
const root = '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain';
const state = '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1';
const git = (...args: string[]) => {
  const result = Bun.spawnSync(['git', ...args], { cwd: root });
  if (result.exitCode) throw Error(result.stderr.toString());
  return result.stdout.toString();
};
const paths = git('ls-files', '-z').split('\0').filter(Boolean);
const sources = new Map(await Promise.all(paths.map(async path => [path, await readFile(join(root, path))] as const)));
const roles: Record<string, string> = {};
const prohibited: string[] = [];
const embeddedCandidates: string[] = [];
for (const [path, bytes] of sources) {
  try { roles[path] = classify(path, bytes); } catch (error) { prohibited.push(String(error)); }
  if (path.endsWith('.ts') && !path.startsWith('tests/')) {
    const source = bytes.toString();
    if (/Bun\.\$|\$`|shell\s*:\s*true|\b(?:exec|spawn)(?:Sync)?\(\s*['"](?:bash|sh|perl|jq)['"]/.test(source)) embeddedCandidates.push(path);
  }
}
const cases = JSON.parse(await readFile(join(root, 'tests/fixtures/toolchain-cases.json'), 'utf8')) as {source:string;line:number;replacement:string;test:string}[];
const missingAssertions = cases.filter(row => !sources.has(row.replacement) || !sources.get(row.replacement)!.toString().includes(row.test));
const callers = JSON.parse(await readFile(join(root, 'tests/fixtures/toolchain-callers.json'), 'utf8')) as {removedPaths:string[]};
const liveCallers: string[] = [];
const historicalExceptions: string[] = [];
for (const [path, bytes] of sources) {
  if (/^docs\/adr\/00(?:0[1-9]|1[0-9]|2[0-4])-/.test(path) || ['tests/fixtures/toolchain-cases.json','tests/fixtures/toolchain-callers.json','tests/fixtures/capscore-reference.json','tests/fixtures/next-step-reference.json'].includes(path)) {
    historicalExceptions.push(path);
    continue;
  }
  for (const old of callers.removedPaths) {
    const pattern = new RegExp(`${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_./-])`);
    if (pattern.test(bytes.toString())) liveCallers.push(`${path}: ${old}`);
  }
}
const discovered = await discoverTests(root);
const automatic = paths.filter(path => /(?:[._](?:test|spec))\.ts$/.test(path)).sort();
const mapPath = join(root, 'docs/superpowers/plans/96-port-map.md');
const map = await readFile(mapPath, 'utf8');
const sections: {heading:string;line:number;tableRows:number}[] = [];
for (const [i, line] of map.split('\n').entries()) {
  if (/^#{1,4} /.test(line)) sections.push({heading:line,line:i+1,tableRows:0});
  else if (/^\|/.test(line) && !/^\|[ -]+\|/.test(line) && sections.length) sections[sections.length-1]!.tableRows++;
}
const current = map.split('### Task 9 current focused case-to-file map\n')[1];
if (!current) throw Error('missing final map section');
const focusedText = current.split('### Approved host file allocation after the actual standalone cutoff')[0]!;
const currentRows = focusedText.split('\n').flatMap(line => {
  const matched = /^\| `([^`]+\.ts)` \| (.*?) \|/.exec(line);
  return matched ? [{file:matched[1]!, case:matched[2]!}] : [];
});
const hostText = map.split('### Approved host file allocation after the actual standalone cutoff')[1] ?? '';
const hostRows = hostText.split('\n').flatMap(line => {const m=/^\| `(tests\/host-[^`]+\.test\.ts)` \| (.*?) \|/.exec(line);return m ? [{file:m[1]!,name:m[2]!}] : [];});
const hostInventory=JSON.parse(await readFile(join(root,'.superpowers/sdd/96/ci-fix-logs/host-session-case-inventory.json'),'utf8')) as {cases:{file:string;name:string}[]};
const sortHost=(rows:{file:string;name:string}[])=>rows.map(row=>JSON.stringify([row.file,row.name])).sort();
const hostMapMatchesInventory=JSON.stringify(sortHost(hostRows))===JSON.stringify(sortHost(hostInventory.cases));
const missingCurrentFiles = currentRows.filter(row => !sources.has(row.file));
const mappedEntries = [...new Set(currentRows.map(row=>row.file))].sort();
const missingAutomaticEntries = automatic.filter(path => !map.includes(path));
const baselinePaths = git('ls-tree','-r','--name-only','4fe5554c4c09ec522aae410afde6a298787a04a9').trim().split('\n');
const baselineTests = baselinePaths.filter(path => /(?:\.test\.(?:sh|mjs|js)|\.spec\.(?:mjs|js))$/.test(path));
const unmappedBaselineFiles = baselineTests.filter(path => !map.includes(path) && !map.includes(path.split('/').at(-1)!));
const summary = {
  reviewedCandidates: { 'board/config.test.ts': 'negative-data shell:true config refusal case, not an executor', 'scripts/setup.ts': 'RegExp template ends in an end-anchor; no Bun Shell call' },
  status: 'PASS', head:git('rev-parse','HEAD').trim(), trackedPaths:paths.length,
  typescriptFiles:paths.filter(path=>path.endsWith('.ts')).length,
  roleCounts:Object.fromEntries([...new Set(Object.values(roles))].sort().map(role=>[role,Object.values(roles).filter(value=>value===role).length])),
  generatedFiles, explicitRoles:fileRoles, prohibited, embeddedCandidates,
  automaticEntries:automatic.length, discoveredEntries:discovered.length,
  discoveryEqualsTracked:JSON.stringify(discovered)===JSON.stringify(automatic), processEntries,
  trackedAssertionRows:cases.length, missingAssertions, removedPaths:callers.removedPaths.length, liveCallers, historicalExceptions,
  mapSha256:new Bun.CryptoHasher('sha256').update(map).digest('hex'), mapBytes:Buffer.byteLength(map), mapLines:map.split('\n').length,
  sections, currentFocusedRows:currentRows.length,hostCaseLocations:hostRows.length,hostMapMatchesInventory, mappedAutomaticEntries:mappedEntries.length,
  missingCurrentFiles, missingAutomaticEntries, baselineTestFiles:baselineTests.length, baselineLiteralSpellingsAbsent:unmappedBaselineFiles,
};
const failures = [prohibited,missingAssertions,liveCallers,missingCurrentFiles,missingAutomaticEntries].some(items=>items.length) || !hostMapMatchesInventory || hostRows.length!==82 || !summary.discoveryEqualsTracked || paths.length!==224 || automatic.length!==52 || currentRows.length!==696;
if (failures) summary.status='FAIL';
await writeFile(join(state,'proof/tree-roles.json'),JSON.stringify(roles,null,2)+'\n');
await writeFile(join(state,'proof/host-case-map.json'),JSON.stringify(hostRows,null,2)+'\n');
await writeFile(join(state,'proof/current-focused-rows.json'),JSON.stringify(currentRows,null,2)+'\n');
await writeFile(join(state,'proof/v1-tree-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,sections:summary.sections.length,historicalExceptions:summary.historicalExceptions.length,explicitRoles:Object.keys(fileRoles).length},null,2));
process.exitCode=Number(failures);
