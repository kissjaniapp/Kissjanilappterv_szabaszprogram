'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');

const start=html.indexOf('function rememberMachineRoot(');
const end=html.indexOf('\n  function downloadCutList(',start);
assert.ok(start>=0&&end>start,'Hiányzik a natív Windowsos Mix mentés');
const body=html.slice(start,end);
const root=String.raw`C:\Gatterka`;
class FixedDate extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({selected=String.raw`D:\Gyartas\Munka`,cancelled=false,saveError='',missingBridge=false}={}){
 const calls={requests:[],notices:[],saved:0};
 const state={active:'save',layoutMode:'machine',projectName:'Teszt',
   kerf:5,furnitures:[],xmixMachineRoot:root};
 const bridge=missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)};
 const fetch=async(url,args)=>{
  const payload=JSON.parse(args.body);
  calls.requests.push({url,payload});
  assert.equal(args.headers['X-Gatterka-Token'],'A'.repeat(43));
  if(url.endsWith('/native/choose'))
   return {ok:true,json:async()=>cancelled?{cancelled:true}:{cancelled:false,path:selected}};
  if(url.endsWith('/native/save')){
   if(saveError)return {ok:false,status:403,json:async()=>({error:saveError})};
   return {ok:true,json:async()=>({path:selected+'\\2026-10-30\\2026_10_30_Teszt',programs:2})};
  }
  throw Error('Unexpected url '+url);
 };
 const sandbox={
  state,nativeBridge:bridge,defaultXmixMachineRoot:root,savedMachineRoot:root,
  save:()=>{calls.saved++},fetch,
  result:{machineReady:true,error:null,bins:[{machine:{strips:[{}]}}],failed:[]},
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,location,_mode,dest)=>{
   const cabinet='2026_10_30_'+dest;
   return {cabinetFolder:cabinet,names:['a.xPrg','b.xPrg'],files:[
     [cabinet+'/test.xMix','<xMix><RigheMix><RigaMix File="'+location+'a.xPrg" /></RigheMix></xMix>'],
     [cabinet+'/xPrg/a.xPrg','<SchemaDoc></SchemaDoc>'],
     [cabinet+'/xPrg/b.xPrg','<SchemaDoc></SchemaDoc>']
   ]};
  },
  showNotice:msg=>calls.notices.push(msg),
  Date:FixedDate
 };
 const out=vm.runInNewContext('(function(){'+body+
  ';return {machineRootPath,machineExportBundle,saveXprgToSelectedFolder};})()',sandbox);
 return {out,calls,state};
}
test('minden Windows mentéskor C:\\Gatterka az induló választási hely',async()=>{
 const {out,calls,state}=harness();
 await out.saveXprgToSelectedFolder();
 assert.equal(calls.requests[0].payload.initial,root);
 assert.equal(state.xmixMachineRoot,String.raw`D:\Gyartas\Munka`);
 assert.equal(calls.requests.length,2);
 assert.ok(calls.requests[1].url.endsWith('/native/save'));
 assert.ok(calls.notices.at(-1).includes('Sikeres gépi mentés'));
 assert.equal(calls.saved,1);
 const mix=calls.requests[1].payload.files[0].content;
 assert.ok(mix.includes(String.raw`D:\Gyartas\Munka\2026-10-30\2026_10_30_Teszt\xPrg\a.xPrg`));
});
test('a Windows választás megszakítása nem indít mentést',async()=>{
 const {out,calls,state}=harness({cancelled:true});
 await out.saveXprgToSelectedFolder();
 assert.equal(state.xmixMachineRoot,root);
 assert.equal(calls.requests.length,1);
});
test('írásvédett mappa esetén nincs hamis sikerjelzés',async()=>{
 const {out,calls}=harness({saveError:'Nincs írási jogosultság'});
 await out.saveXprgToSelectedFolder();
 assert.ok(calls.notices.at(-1).includes('Nincs írási jogosultság'));
 assert.ok(!calls.notices.at(-1).includes('Sikeres'));
});
test('a célmappa nem szerepel a program felületén',()=>{
 const a=html.indexOf('function saveView()'),b=html.indexOf('function render(){',a);
 const panel=html.slice(a,b);
 assert.match(panel,/data-action="save-xprg-folder"/);
 assert.doesNotMatch(panel,/data-action="download-xprg-project"/);
 assert.match(panel,/id="machine-save-status"/);
 assert.doesNotMatch(panel,/xmix-machine-root|Kiválasztott célmappa/);
});
