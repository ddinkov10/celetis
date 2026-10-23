import { appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processEntries, suite } from '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain/tests/suite.ts';
const root = '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/96-intent-the-whole-toolchain';
const state = '/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci2-head._4e898d1';
const expectedHead = 'b6053743e492dde0624207c90fc3a23cdeeca57a';
const selected = [...processEntries, 'tests/celetis-flow.test.ts'];
const exact = ['board/realpath.test.ts','tests/process.test.ts','tests/runner-lock.test.ts','tests/runner-lifecycle.test.ts','tests/runner-startup.test.ts','tests/host-session.test.ts','tests/host-observation.test.ts','tests/host-identity.test.ts','tests/host-resume.test.ts','tests/celetis-flow.test.ts'];
if (JSON.stringify(selected)!==JSON.stringify(exact)) throw Error('process selection drift');
const git = (...args: string[]) => {
  const command = Bun.spawnSync(['git', ...args], {cwd: root});
  if (command.exitCode) throw Error(command.stderr.toString());
  return command.stdout.toString();
};
if (git('rev-parse','HEAD').trim()!==expectedHead || git('status','--porcelain=v1','--untracked-files=no')) throw Error('source binding drift');
const tmp = join(state,'v3-temp');
mkdirSync(tmp, { recursive: true });
process.env.TMPDIR=tmp;
process.chdir(root);
const observed = new Set<number>([process.pid]);
type Row = { pid:number; ppid:number; pgid:number; stat:string; command:string; line:string };
const table = (): Row[] => {
  const ps = Bun.spawnSync(['/bin/ps','-axo','pid=,ppid=,pgid=,stat=,command=']);
  if (ps.exitCode) throw Error(`ps failed ${ps.exitCode}: ${ps.stderr.toString()}`);
  return ps.stdout.toString().split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m || m[5]!.startsWith('/bin/ps -axo ')) return [];
    return [{pid:Number(m[1]),ppid:Number(m[2]),pgid:Number(m[3]),stat:m[4]!,command:m[5]!,line}];
  });
};
const capture = (label: string) => {
  const rows=table();
  let changed=true;
  while (changed) {
    changed=false;
    for (const row of rows) if (!observed.has(row.pid) && (observed.has(row.ppid) || row.command.includes(tmp))) {observed.add(row.pid);changed=true;}
  }
  const related=rows.filter(row=>row.pid!==process.pid && observed.has(row.pid));
  appendFileSync(join(state,'logs/v3-process-tables.log'),`== ${new Date().toISOString()} ${label}\n${related.map(row=>row.line).join('\n') || '(no observed test descendants)'}\n`);
  return related;
};
const results: {file:string;code:number;elapsedMs:number;log:string;descendantsAfter:Row[]; scratchEntries:{path:string;kind:string;bytes:number|null}[]}[]=[];
let monitorError:unknown;
let monitor: ReturnType<typeof setInterval> | undefined;
try {
  capture('before macOS group');
  monitor=setInterval(()=>{try{capture('running');}catch(error){monitorError=error;}},200);
  for (const file of selected) {
    const entryTmp=join(tmp,file.replaceAll('/','_'));
    mkdirSync(entryTmp,{recursive:true});
    process.env.TMPDIR=entryTmp;
    const log=join(state,'logs',`v3-${file.replaceAll('/','_')}.log`);
    writeFileSync(log,'');
    const result=await suite({root,files:[file],timeoutMs:30_000,output:text=>appendFileSync(log,text)});
    let remaining=capture(`after ${file}`);
    const deadline=performance.now()+3000;
    while (remaining.length && performance.now()<deadline) {await Bun.sleep(50);remaining=capture(`cleanup ${file}`);}
    const scratchEntries:{path:string;kind:string;bytes:number|null}[]=[];
    const visitScratch=(folder:string)=>{for(const entry of readdirSync(folder,{withFileTypes:true})){const path=join(folder,entry.name);scratchEntries.push({path:path.slice(entryTmp.length+1),kind:entry.isDirectory()?'directory':'file',bytes:entry.isDirectory()?null:statSync(path).size});if(entry.isDirectory())visitScratch(path);}};
    visitScratch(entryTmp);
    const item=result.results[0];
    results.push({file,code:result.code,elapsedMs:item?.elapsedMs??0,log,descendantsAfter:remaining,scratchEntries});
    console.log(JSON.stringify(results.at(-1)));
    writeFileSync(join(state,'proof/v3-results.json'),JSON.stringify(results,null,2)+'\n');
    if (monitorError) throw monitorError;
    if (result.code!==0 || !item || item.elapsedMs>30_000 || remaining.length) throw Error(`V3 file failure: ${file}; code ${result.code}; remaining ${remaining.length}`);
  }
  clearInterval(monitor);
  monitor=undefined;
  const survivors=capture('final macOS group');
  const status={status:'PASS',head:expectedHead,bun:Bun.version,os:process.platform,arch:process.arch,selected,effectiveDefaultWorkers:1,timeoutMs:30_000,observedDescendantPids:observed.size-1,survivors,trackedClean:git('status','--porcelain=v1','--untracked-files=no')==='',results};
  if (survivors.length || !status.trackedClean || git('rev-parse','HEAD').trim()!==expectedHead) throw Error('final source or process drift');
  writeFileSync(join(state,'proof/v3-summary.json'),JSON.stringify(status,null,2)+'\n');
  console.log('V3 macOS: PASS');
} catch(error) {
  writeFileSync(join(state,'proof/v3-failure.json'),JSON.stringify({status:'FAIL',head:expectedHead,error:String(error),results},null,2)+'\n');
  console.error(String(error));
  process.exitCode=1;
} finally {if(monitor)clearInterval(monitor);}
