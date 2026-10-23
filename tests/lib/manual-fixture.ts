import { join } from 'node:path';
import { fixture, root } from './fixture.ts';

export async function manualFixture() {
  const f = await fixture();
  await f.repository();
  await f.write('repo dir/AGENTS.md', 'Keep PRODUCT_ROOT_21 open when Verify cannot run.\n');
  await f.write('repo dir/area/AGENTS.md', 'Check PRODUCT_AREA_21 before a landing.\n');
  await f.write('repo dir/area/sub/AGENTS.md', 'Wait for PRODUCT_SUBFOLDER_21 when approval is missing.\n');
  await f.write('repo dir/other/AGENTS.md', 'Apply UNRELATED_SUBFOLDER_21 only in this folder.\n');
  await f.write('AGENTS.md', 'Never apply OUTSIDE_PRODUCT_21 to this product.\n');
  const stub = `import {readFile,writeFile,appendFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const args=process.argv.slice(2);
const flag=(name)=>args[args.indexOf(name)+1];
if(args[0]==='--version'){console.log('manual fixture');process.exit(0);}
if(process.env.MANUAL_CALLS)await appendFile(process.env.MANUAL_CALLS,'called\\n');
let prompt='';for await(const chunk of process.stdin)prompt+=chunk.toString();
const {stepAnswer,stepFaults}=await import(${JSON.stringify(join(root, 'tests/lib/step-fixture.ts'))});
const k=Number(/^Case ([0-9]+)/m.exec(prompt)?.[1]);const mode=prompt.includes('A person started the session by hand')?'hand':k===15?'specify':'step';
if(process.env.MANUAL_INPUTS)await writeFile(join(process.env.MANUAL_INPUTS,'received-'+k+'-'+mode),prompt);
const requested=process.env.MANUAL_FAULT??'';
const active=stepFaults.some(([c,m,f])=>c===k&&m===mode&&f===requested)||requested==='reconnect'&&k===4||requested==='bound-stop'&&k===13;
const r=stepAnswer(k,mode,args.includes('--output-last-message')?'codex':'claude',active?requested:'',process.env.MANUAL_STYLE??'',process.env.MANUAL_BINDING_DIR??process.cwd());
if(args.includes('--output-last-message')){await writeFile(flag('--output-last-message'),r.answer);for(const event of r.events)console.log(JSON.stringify(event));}else process.stdout.write(r.answer);
process.exitCode=r.status;`;
  for (const host of ['claude', 'codex']) await f.stub(host, stub);
  return {
    ...f,
    env: { ...f.env, PATH: `${join(f.dir, 'bin')}:${process.env.PATH}` },
    step: join(root, 'tests/manual/step-prompt.ts'),
    custom: join(root, 'tests/manual/custom-part.ts'),
  };
}

export async function customManualFixture() {
  const f = await manualFixture();
  await f.stub(
    'claude',
    `import {readFile,writeFile,appendFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
const a=process.argv.slice(2);const get=n=>a[a.indexOf(n)+1];
if(a[0]==='--version'){console.log('custom fixture');process.exit(0);}
if(process.env.CUSTOM_CALLS)await appendFile(process.env.CUSTOM_CALLS,'called\\n');
const dir=get('--add-dir');
const {customTranscript,customNames}=await import(${JSON.stringify(join(root, 'tests/lib/custom-fixture.ts'))});
const stream=a.includes('--input-format');
let prompt=a.at(-1),lines;
if(stream){lines=createInterface({input:process.stdin})[Symbol.asyncIterator]();prompt=JSON.parse((await lines.next()).value).message.content;}
let name,spec;
for(const file of await readdir(dir)){if(!file.endsWith('.input.json')||!customNames.includes(file.slice(0,-11)))continue;const value=JSON.parse(await readFile(join(dir,file),'utf8'));if(value.cwd===process.cwd()&&value.prompt===prompt&&JSON.stringify(value.settings)===get('--settings')){name=file.slice(0,-11);spec=value;break;}}
if(!spec)throw new Error('No matching invocation specification: '+process.cwd()+' '+prompt);
for(const suffix of ['','input.json','jsonl','err','status'])await writeFile(join(dir,'not-evidence'+(suffix?'.'+suffix:'')),'unrelated fixture file\\n');
const f=customTranscript(name,{spec,style:process.env.CUSTOM_METADATA_STYLE??'',fault:process.env.CUSTOM_FAULT??'',bound:process.env.CUSTOM_BOUND_ROOT==='only-config',syntax:process.env.CUSTOM_INVALID_STYLE==='syntax'});
const output=rows=>{for(const row of rows)console.log(JSON.stringify(row));};
if(stream){let at=f.rows.findIndex(row=>row.type==='result');let first=f.rows.slice(0,at+1);if(process.env.CUSTOM_FAULT==='worktree-no-native-transition')first=first.filter(row=>row.type==='result');output(first);const next=await lines.next();if(next.done)process.exit(2);if(JSON.parse(next.value).message.content!=='/celetis:guide see the next step of an issue\\n\\n'+spec.metadataRecording)process.exit(2);output(f.rows.slice(at+1));}else output(f.rows);
process.exitCode=process.env.CUSTOM_FAULT==='client-exit'?7:0;`,
  );
  return f;
}
