#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sed -n '/^check() {$/,/^}$/p' tests/manual/custom-part.test.sh >"$tmp/checker"
python3 - "$tmp" <<'FIXTURE'
from pathlib import Path
import hashlib,json,sys
base=Path(sys.argv[1]);checkout=base/'project';plugin=base/'plugin';checkout.mkdir();path=str(checkout/'.celetis.yaml');host=str(plugin/'docs/hosts/entry.md');source='landing: pr\ncustom: {}\n';origin={'plugin':'celetis','tier':'user'}
def row(event,id,input,result=None):return {'type':'system','subtype':'ui_log','plugin':'celetis-entry-observer','session_id':'fixture','text':json.dumps({'event':event,'id':id,'input':input,'result':result,'origin':origin})}
def read(id,p,content):
 inp={'tool':'Read','tool_use_id':id,'file_path':p};out={'result':{'type':'text','file':{'filePath':p,'contentSha256':hashlib.sha256(content.encode()).hexdigest(),'startLine':1,'numLines':2,'totalLines':2}}}
 return [row('tool.start',id,inp),row('tool.result',id,inp,out)]
def meta(id,p,kind):
 inp={'path':p};return [row('fs.stat.start',id,inp),row('fs.stat.result',id,inp,{'value':{'kind':kind,'isLink':False}})]
answer='scripts/celetis --host claude next-step <#>\nCUSTOM_FROM_ROOT'
valid=read('host',host,'Host entry')+meta(1,str(checkout/'.git'),'dir')+meta(2,path,'file')+read('config',path,source)+[{'type':'assistant','message':{'role':'assistant','content':[{'type':'text','text':answer}]}},{'type':'result','subtype':'success','is_error':False,'result':answer,'permission_denials':[]}]
input={'cwd':str(checkout),'plugin':str(plugin),'pluginSources':[{'path':host,'sha256':hashlib.sha256(b'Host entry').hexdigest()}],'git':{'path':str(checkout/'.git'),'kind':'directory'},'config':{'path':path,'source':source,'sha256':hashlib.sha256(source.encode()).hexdigest(),'kind':'regular'}}
faults=['valid','missing-host-hash','bad-host-hash','missing-config-hash','bad-config-hash','wrong-read-path','missing-meta-start','late-metadata','wrong-meta-path','wrong-result-id','fake-observer','missing-counts','token-cap']
for fault in faults:
 rows=json.loads(json.dumps(valid))
 for item in rows:
  if item.get('subtype')!='ui_log':continue
  d=json.loads(item['text'])
  if d['event']=='tool.result':
   f=d['result']['result']['file']
   if (fault=='missing-host-hash' and d['id']=='host') or (fault=='missing-config-hash' and d['id']=='config'):del f['contentSha256']
   if (fault=='bad-host-hash' and d['id']=='host') or (fault=='bad-config-hash' and d['id']=='config'):f['contentSha256']='0'*64
   if fault=='wrong-read-path' and d['id']=='config':f['filePath']+='.other'
   if fault=='missing-counts' and d['id']=='config':del f['numLines']
   if fault=='token-cap' and d['id']=='config':f['truncatedByTokenCap']=True
   if fault=='wrong-result-id' and d['id']=='config':d['id']='other'
  if fault=='wrong-meta-path' and d['event']=='fs.stat.result' and d['id']==2:d['input']['path']+='.other'
  item['text']=json.dumps(d)
  if fault=='fake-observer':item['plugin']='model-claim'
 if fault=='missing-meta-start':rows=[x for x in rows if not (x.get('subtype')=='ui_log' and json.loads(x['text'])['event']=='fs.stat.start' and json.loads(x['text'])['id']==2)]
 if fault=='late-metadata':rows=rows[:4]+rows[6:8]+rows[4:6]+rows[8:]
 folder=base/fault;folder.mkdir();(folder/'no-shell.input.json').write_text(json.dumps(input));(folder/'no-shell.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in rows));(folder/'no-shell.status').write_text('0\n');(folder/'no-shell.err').write_text('')
for family,faults in [('absent',['good','no-result','wrong-id','non-enoent','early-text','wrong-origin','wrong-path']),('denied',['good','no-result','wrong-id','wrong-path','not-permission','model-claim','later-read','missing-start','not-error'])]:
 for fault in faults:
  name='missing' if family=='absent' else 'denied-read';spec=json.loads(json.dumps(input));spec['config']['kind']='missing' if family=='absent' else 'regular'
  rows=read('host',host,'Host entry')+meta(1,str(checkout/'.git'),'dir')
  if family=='absent':
   inp={'path':path};result=row('fs.stat.result',2,inp,{'deny':'Error: fs.stat: ENOENT'})
   if fault=='wrong-id':d=json.loads(result['text']);d['id']=3;result['text']=json.dumps(d)
   if fault=='wrong-origin':d=json.loads(result['text']);d['origin']={'plugin':'other'};result['text']=json.dumps(d)
   if fault=='wrong-path':d=json.loads(result['text']);d['input']['path']+='.other';result['text']=json.dumps(d)
   if fault=='non-enoent':d=json.loads(result['text']);d['result']['deny']='Error: fs.stat: EACCES';result['text']=json.dumps(d)
   rows+=[row('fs.stat.start',2,inp)]
   if fault=='early-text':rows+=[{'type':'assistant','message':{'content':[{'type':'text','text':'Checking the config.'}]}}]
   if fault!='no-result':rows+=[result]
   answer='scripts/celetis --host claude next-step <#>'
  else:
   rows+=meta(2,path,'file');inp={'tool':'Read','tool_use_id':'config','file_path':path}
   result=row('tool.result','config',inp,{'result':'Error: File is in a directory that is denied by your permission settings.','text':'<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>','isError':True})
   if fault=='wrong-id':d=json.loads(result['text']);d['id']='other';result['text']=json.dumps(d)
   if fault=='wrong-path':d=json.loads(result['text']);d['input']['file_path']+='.other';result['text']=json.dumps(d)
   if fault=='not-permission':d=json.loads(result['text']);d['result']['result']='Unrelated error';d['result']['text']='Data validation denied';result['text']=json.dumps(d)
   if fault=='model-claim':result['plugin']='model-claim'
   if fault=='not-error':d=json.loads(result['text']);d['result']['isError']=False;result['text']=json.dumps(d)
   if fault!='missing-start':rows+=[row('tool.start','config',inp)]
   if fault!='no-result':rows+=[result]
   if fault=='later-read':rows+=read('retry',path+'.other',source)
   answer='The config read was denied. Entry stopped.'
  rows+=[{'type':'assistant','message':{'content':[{'type':'text','text':answer}]}},{'type':'result','subtype':'success','is_error':False,'result':answer,'permission_denials':[]}]
  folder=base/(family+'-'+fault);folder.mkdir();(folder/(name+'.input.json')).write_text(json.dumps(spec));(folder/(name+'.jsonl')).write_text(''.join(json.dumps(x)+'\n' for x in rows));(folder/(name+'.status')).write_text('0\n');(folder/(name+'.err')).write_text('')
FIXTURE
celetis_fails=0
for fault in valid missing-host-hash bad-host-hash missing-config-hash bad-config-hash wrong-read-path missing-meta-start late-metadata wrong-meta-path wrong-result-id fake-observer missing-counts token-cap absent-good absent-no-result absent-wrong-id absent-non-enoent absent-early-text absent-wrong-origin absent-wrong-path denied-good denied-no-result denied-wrong-id denied-wrong-path denied-not-permission denied-model-claim denied-later-read denied-missing-start denied-not-error; do
  celetis_case_status=0
  (
    celetis_fixture_root=$tmp
    tmp="$tmp/$fault"
    failed=0
    source "$celetis_fixture_root/checker"
    case $fault in
      absent-*) check missing '' "$celetis_fixture_root/project" 0 ;;
      denied-*) check denied-read blocked "$celetis_fixture_root/project" ;;
      *) check no-shell CUSTOM_FROM_ROOT "$celetis_fixture_root/project" ;;
    esac
    exit "$failed"
  ) >"$tmp/$fault.log" 2>&1 || celetis_case_status=$?
  if { [[ $fault = valid || $fault = *-good ]] && [ "$celetis_case_status" -eq 0 ]; } ||
      { [[ $fault != valid && $fault != *-good ]] && [ "$celetis_case_status" -eq 1 ]; }; then
    echo "ok: $fault"
  else
    echo "FAIL: $fault ($celetis_case_status)"; cat "$tmp/$fault.log"; celetis_fails=$((celetis_fails + 1))
  fi
done
[ "$celetis_fails" -eq 0 ]
echo PASS
