from pathlib import Path
import hashlib, json, os, platform, shutil, subprocess, sys, time
state = Path(__file__).resolve().parent
binding = json.loads((state/'binding.json').read_text())
source = Path(binding['checkout'])
bun = binding['bun']
flags = ['--no-env-file','--no-install','--config=/dev/null','--no-macros']
env = dict(os.environ, BUN_RUNTIME_TRANSPILER_CACHE_PATH='0', DO_NOT_TRACK='1')
env['PATH'] = binding['tools']+'/bin:'+env['PATH']
commands = []
def run(label, argv, cwd=source, wanted=0, timeout=50):
    start=time.monotonic()
    result=subprocess.run(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
    elapsed=time.monotonic()-start
    (state/'logs'/f'{label}.log').write_bytes(result.stdout)
    commands.append({'label':label,'cwd':str(cwd),'argv':argv,'code':result.returncode,'elapsedSeconds':round(elapsed,6),'log':str(state/'logs'/f'{label}.log')})
    (state/'commands-v1.json').write_text(json.dumps(commands,indent=2)+'\n')
    if result.returncode != wanted:
        raise RuntimeError(f'{label}: expected {wanted}, got {result.returncode}: {result.stdout.decode(errors="replace")}')
    return result.stdout.decode(errors='replace')
def snapshot(root):
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
    return {p:{'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest(),'mode':format((root/p).stat().st_mode&0o777,'04o'),'bytes':(root/p).stat().st_size} for p in paths if p}
def save(name,value): (state/'proof'/name).write_text(json.dumps(value,indent=2)+'\n')
def binding_check(root, clean=True):
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()==binding['head']
    if clean: assert not subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=no'],cwd=root)
def copy(name, leaf):
    dest=state/leaf
    dest.parent.mkdir(parents=True,exist_ok=True)
    run(name+'-clone',['git','clone','--no-hardlinks','--no-checkout',str(source),str(dest)])
    run(name+'-checkout',['git','checkout','--detach',binding['head']],dest)
    binding_check(dest)
    save(name+'-initial.json',snapshot(dest))
    return dest
try:
    binding_check(source)
    before=snapshot(source)
    save('source-before.json',before)
    versions={'os':platform.platform(),'uname':run('uname',['uname','-a']).strip(),'swVers':run('sw-vers',['sw_vers']).strip(),'bunPath':bun,'bun':run('bun-version',[bun,'--version']).strip(),'bunRevision':run('bun-revision',[bun,'--revision']).strip()}
    assert versions['bun']=='1.4.2'
    for tool in ['codex','claude','gh','herdr']:
        executable=shutil.which(tool,path=env['PATH'])
        versions[tool]={'path':executable,'version':run(tool+'-version',[executable,'--version']).strip()} if executable else {'path':None,'version':'not available'}
    save('versions.json',versions)
    generated=['scripts/celetis','board/board.js','board/view.mjs','board/ui.mjs','board/panel.mjs','board/palette.mjs','hooks/entry.js','tests/manual/native-observer/hooks/register.js']
    copies=[copy('copy-a','copy-a'),copy('copy-b','different absolute path/copy-b')]
    manifests=[]
    for i,root in enumerate(copies):
        name=f'copy-{chr(97+i)}'
        initial=snapshot(root)
        run(name+'-build',[bun,*flags,str(root/'scripts/build.ts')],root)
        after=snapshot(root)
        save(name+'-after-build.json',after)
        assert initial==after, f'{name} build changed tracked bytes or modes'
        binding_check(root)
        manifests.append({p:after[p] for p in generated})
    original={p:before[p] for p in generated}
    assert manifests[0]==manifests[1]==original
    direct=[{'path':p,'byteEquality':(source/p).read_bytes()==(copies[0]/p).read_bytes()==(copies[1]/p).read_bytes(),'modes':[format((r/p).stat().st_mode&0o777,'04o') for r in [source,*copies]]} for p in generated]
    assert all(row['byteEquality'] and len(set(row['modes']))==1 for row in direct)
    save('direct-generated-byte-comparison.json',direct)
    save('generated-manifest.json',original)
    run('source-build-check',[bun,*flags,str(source/'scripts/build.ts'),'--check'])
    after_check=snapshot(source)
    save('source-after-check.json',after_check)
    assert before==after_check, '--check mutated source'
    gate_output=run('source-gate',[bun,*flags,str(source/'scripts/verify.ts')])
    assert gate_output.rstrip().splitlines()[-1]=='verify: PASS'
    after_gate=snapshot(source)
    save('source-after-gate.json',after_gate)
    assert before==after_gate, 'gate mutated source'
    binding_check(source)
    corrupt=copy('corrupt','separate-corrupt-copy')
    target=corrupt/'scripts/celetis'
    target.write_bytes(target.read_bytes()+b'\n// final verify byte corruption\n')
    target.chmod(0o644)
    corrupt_before=snapshot(corrupt)
    save('corrupt-before-check.json',corrupt_before)
    refusal=run('corrupt-build-check',[bun,*flags,str(corrupt/'scripts/build.ts'),'--check'],corrupt,wanted=1)
    assert 'build: stale or missing scripts/celetis (bytes or executable mode)' in refusal
    corrupt_after=snapshot(corrupt)
    save('corrupt-after-check.json',corrupt_after)
    assert corrupt_before==corrupt_after, 'refusal repaired or mutated corrupt copy'
    assert corrupt_after['scripts/celetis']!=before['scripts/celetis']
    binding_check(source)
    summary={'status':'PASS','head':binding['head'],'trackedPaths':len(before),'copies':[str(p) for p in copies],'corruptCopy':str(corrupt),'generated':original,'sourceCheckUnchanged':before==after_check,'sourceGateUnchanged':before==after_gate,'corruptionNotRepaired':corrupt_before==corrupt_after,'gateSeconds':next(c['elapsedSeconds'] for c in commands if c['label']=='source-gate')}
    save('v1-build-summary.json',summary)
    print(json.dumps(summary,indent=2))
except Exception as error:
    save('v1-build-failure.json',{'status':'FAIL','head':binding['head'],'error':str(error)})
    print(str(error),file=sys.stderr)
    sys.exit(1)
