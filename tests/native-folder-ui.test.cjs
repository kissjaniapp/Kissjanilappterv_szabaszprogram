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
  if(url.endsWith('/native/choose')){
   return {ok:true,json:async()=>cancelled?{cancelled:true}:{cancelled:false,path:selected}};
  }
  if(url.endsWith('/native/save')){
   if(saveError)return {ok:false,status:403,json:async()=>({error:saveError})};
   return {ok:true,json:async()=>({path:selected+'\\2026_10_30_Teszt',
      programs:2,cabinetFolder:'2026_10_30_Teszt'})};
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
test('a natív Windows mappaválasztó tényleges X: elérési útját beírja és elmenti',async()=>{
 const {out,calls,input,state}=harness();
 await out.saveXprgToSelectedFolder();
 assert.equal(state.xmixMachineRoot,String.raw`X:\Munka\Megosztas`);
 assert.equal(input.value,String.raw`X:\Munka\Megosztas`);
 assert.ok(calls.settings.some(s=>s.key==='gatterka-machine-root-v1'));
 assert.equal(calls.saved,1);
 assert.equal(calls.requests.length,2);
 assert.ok(calls.requests[0].url.endsWith('/native/choose'));
 assert.ok(calls.requests[1].url.endsWith('/native/save'));
 assert.ok(calls.notices.at(-1).includes('Sikeres gépi mentés'));
 const payload=calls.requests[1].payload;
 assert.equal(payload.cabinetFolder,'2026_10_30_Teszt');
 assert.ok(payload.files[0].content.includes(
    String.raw`X:\Munka\Megosztas\2026_10_30_Teszt\xPrg\a.xPrg`));
 assert.equal(payload.files.length,3);
});
test('a Gatterka a natív hibát is kiírja, nem jelzi tévesen sikeresnek a mentést',async()=>{
 const {out,calls}=harness({saveError:'A célmappa írásvédett'});
 await out.saveXprgToSelectedFolder();
 assert.ok(calls.notices.at(-1).includes('A célmappa írásvédett'));
 assert.ok(!calls.notices.at(-1).includes('Sikeres'));
});
test('a mappaválasztó megszakítása nem változtatja meg a korábban megadott útvonalat',async()=>{
 const {out,calls,state}=harness({cancelled:true});
 await out.saveXprgToSelectedFolder();
 assert.equal(state.xmixMachineRoot,root);
 assert.equal(calls.requests.length,1);
 assert.equal(calls.saved,0);
});
test('a gépi útvonal élő input kezelője gépelés közben is ment, újrarajzolás nélkül',()=>{
 const from=html.indexOf("document.addEventListener('input',e=>{");
 const to=html.indexOf("document.addEventListener('change',e=>{",from);
 assert.ok(from>=0&&to>from);
 let inputHandler;
 const entries=[];
 vm.runInNewContext(html.slice(from,to),{
   document:{addEventListener:(name,fn)=>{assert.equal(name,'input');inputHandler=fn}},
   rememberMachineRoot:v=>entries.push(v),
   state:{furnitures:[]}
 });
 inputHandler({target:{dataset:{scope:'settings',key:'xmixMachineRoot'},
    value:String.raw`X:\JANI\Frissitett`}});
 assert.deepEqual(entries,[String.raw`X:\JANI\Frissitett`]);
});
