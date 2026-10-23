from pathlib import Path
import datetime,hashlib,json,re,subprocess
state=Path(__file__).resolve().parent;b=json.loads((state/'binding.json').read_text());root=Path(b['checkout'])
paths=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
snapshot={p:{'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest(),'mode':format((root/p).stat().st_mode&0o777,'04o'),'bytes':(root/p).stat().st_size} for p in paths if p}
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip();status=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=no'],cwd=root).decode()
assert head==b['head'] and not status and snapshot==json.loads((state/'proof/source-before.json').read_text())
final={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':head,'branch':subprocess.check_output(['git','branch','--show-current'],cwd=root).decode().strip(),'trackedStatus':status,'trackedPaths':len(snapshot),'sameTrackedBytesAndModes':True,'lastOwnedProcessCapture':(state/'logs/v3-process-tables.log').read_text().splitlines()[-2:]}
(state/'proof/source-final.json').write_text(json.dumps(snapshot,indent=2)+'\n');(state/'proof/final-source-summary.json').write_text(json.dumps(final,indent=2)+'\n')
results=json.loads((state/'proof/v3-results.json').read_text());actualHost=[];summary=[];namesByFile={}
for row in results:
 text=Path(row['log']).read_text()
 def number(kind):
  matched=re.search(r'^\s*(\d+) '+kind+'$',text,re.M)
  return int(matched.group(1)) if matched else None
 passes=number('pass');failures=number('fail');assertions=number(r'expect\(\) calls')
 names=[re.sub(r' \[[^\n]*ms\]$','',line[len('(pass) '):]) for line in text.splitlines() if line.startswith('(pass) ')]
 namesByFile[row['file']]=names
 if row['file'].startswith('tests/host-'): actualHost.extend({'file':row['file'],'name':name} for name in names)
 summary.append({'file':row['file'],'code':row['code'],'seconds':row['elapsedMs']/1000,'passes':passes,'failures':failures,'assertions':assertions,'remainingProcesses':len(row['descendantsAfter']),'scratchEntries':row.get('scratchEntries',[])})
expectedHost=json.loads((state/'proof/expected-host-case-inventory.json').read_text())['cases'];key=lambda row:(row['file'],row['name'])
assert sorted(actualHost,key=key)==sorted(expectedHost,key=key)
(state/'proof/current-host-case-preservation.json').write_text(json.dumps({'match':True,'cases':len(actualHost),'namesAndLocations':sorted(actualHost,key=key)},indent=2)+'\n')
previous=Path('/private/var/folders/p2/l82rb73d03l36xjlvp5982_40000gn/T/celetis.nWpXiy/final-verify-ci-head.3jyqlkwu')
preservation={}
for file in ['tests/celetis-flow.test.ts','tests/runner-lifecycle.test.ts']:
 text=(previous/'logs'/('v3-'+file.replace('/','_')+'.log')).read_text()
 old=set(re.sub(r' \[[^\n]*ms\]$','',line[len('(pass) '):]) for line in text.splitlines() if line.startswith('(pass) ') or line.startswith('(fail) '))
 current=namesByFile[file]
 preservation[file]={'previousCount':len(old),'currentCount':len(current),'sameExpandedNames':old==set(current),'duplicates':len(current)-len(set(current))}
 assert preservation[file]['sameExpandedNames'] and not preservation[file]['duplicates']
(state/'proof/current-flow-lifecycle-name-preservation.json').write_text(json.dumps(preservation,indent=2)+'\n')
(state/'proof/v3-case-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(final,indent=2))
print('Cases:',sum(r['passes'] or 0 for r in summary),'pass;',sum(r['failures'] or 0 for r in summary),'fail; assertions:',sum(r['assertions'] or 0 for r in summary))
for row in summary: print(row['file'],row['code'],f"{row['seconds']:.3f}s",row['passes'],row['assertions'],'scratch',len(row['scratchEntries']))
print('Current82 host names/locations and70 flow/26 lifecycle names match retained inventories.')
