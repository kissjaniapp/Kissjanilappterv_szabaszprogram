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
const root=String.raw`X:\JANI\szabas_programmal\Legujabb_mentessel`;
class FixedDate extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({selected=String.raw`X:\Munka\Megosztas`,cancelled=false,saveError='',missingBridge=false}={}){
 const calls={requests:[],notices:[],settings:[],saved:0};
 const input={value:''};
 const state={active:'nesting',layoutMode:'machine',projectName:'Teszt',
  kerf:5,furnitures:[],xmixMachineRoot:root};
 const bridge=missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)};
 const fetch=async (url,args)=>{
  const payload=JSON.parse(args.body);
  calls.requests.push({url,args,payload});
  assert.equal(args.headers['X-Gatterka-Token'],'A'.repeat(43));
  if(url.endsWith('/native/save-as')){
   if(saveError)return {ok:false,status:403,json:async()=>({error:saveError})};
   return {ok:true,json:async()=>cancelled?{cancelled:true}:{
      cancelled:false,zipPath:selected+'\\\\program.zip',
      projectPath:selected+'\\\\2026_10_30_Teszt',
      programs:2,cabinetFolder:'2026_10_30_Teszt'}};
  }
  throw Error('Unexpected url '+url);
 };
 const sandbox={
  state,nativeBridge:bridge,defaultXmixMachineRoot:root,savedMachineRoot:root,
  localStorage:{setItem:(key,value)=>calls.settings.push({key,value})},
  save:()=>{calls.saved++},fetch,
  result:{machineReady:true,error:null,bins:[{machine:{strips:[{}]}}],failed:[]},
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  document:{getElementById:id=>id==='xmix-machine-root'?input:null},
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,location,_mode,dest)=>{
   const cabinet='2026_10_30_'+dest;
   return {cabinetFolder:cabinet,names:['a.xPrg','b.xPrg'],files:[
     [cabinet+'/test.xMix','<xMix><RigheMix><RigaMix File="'+location+
       'a.xPrg" /></RigheMix></xMix>'],
     [cabinet+'/xPrg/a.xPrg','<SchemaDoc></SchemaDoc>'],
     [cabinet+'/xPrg/b.xPrg','<SchemaDoc></SchemaDoc>']
   ]};
  },
  showNotice:msg=>calls.notices.push(msg),
  window:{showDirectoryPicker:async()=>{throw Error('A natív mentés nem használhat böngészős mappaválasztót');}},
  Date:FixedDate
 };
 const out=vm.runInNewContext('(function(){'+body+
    ';return {rememberMachineRoot,requestNativeMachine,machineRootPath,'+
    'machineExportBundle,saveXprgToSelectedFolder};})()',sandbox);
 return {out,calls,input,state};
}
test('a Windows Mentés másként egyetlen natív kérést küld, relatív forrás xMix-szel',async()=>{
 const {out,calls,state}=harness();
 await out.saveXprgToSelectedFolder();
 assert.equal(state.xmixMachineRoot,root);
 assert.equal(calls.requests.length,1);
 assert.ok(calls.requests[0].url.endsWith('/native/save-as'));
 assert.ok(calls.notices.at(-1).includes('Sikeres mentés'));
 const payload=calls.requests[0].payload;
 assert.equal(payload.cabinetFolder,'2026_10_30_Teszt');
 assert.ok(payload.files[0].content.includes(String.raw`.\xPrg\a.xPrg`));
 assert.equal(payload.files.length,3);
});
test('mentési hiba esetén nincs hamis sikeres visszajelzés',async()=>{
 const {out,calls}=harness({saveError:'A célmappa írásvédett'});
 await out.saveXprgToSelectedFolder();
 assert.ok(calls.notices.at(-1).includes('A célmappa írásvédett'));
 assert.ok(!calls.notices.at(-1).includes('Sikeres'));
});
test('a Windows Mentés másként megszakítása nem módosítja az adatokat',async()=>{
 const {out,calls,state}=harness({cancelled:true});
 await out.saveXprgToSelectedFolder();
 assert.equal(state.xmixMachineRoot,root);
 assert.equal(calls.requests.length,1);
 assert.equal(calls.saved,0);
 assert.equal(calls.notices.length,0);
});
test('Windows nélkül nincs félrevezető, elérési utat kitaláló mentés',async()=>{
 const {out,calls}=harness({missingBridge:true});
 await out.saveXprgToSelectedFolder();
 assert.equal(calls.requests.length,0);
 assert.ok(calls.notices.at(-1).includes('Gatterka.exe'));
});
