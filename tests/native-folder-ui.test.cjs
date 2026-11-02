'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('function rememberMachineRoot(');
const end=html.indexOf('\n  function downloadCutList(',start);
assert.ok(start>=0&&end>start);
const code=html.slice(start,end);
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[2026,9,30]));}}
function harness({cancelled=false,writeError='',missingBridge=false}={}){
 const calls={requests:[],notices:[],events:[]};
 let chosen=false;
 const sandbox={
  nativeBridge:missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)},
  state:{layoutMode:'machine',projectName:'Teszt',kerf:5,furnitures:[],xmixMachineRoot:'X:\\old'},
  defaultXmixMachineRoot:'X:\\old',
  savedMachineRoot:'X:\\old',
  result:{machineReady:true,error:null,bins:[{}],failed:[]},
  localStorage:{setItem(){}},save(){},
  fetch:async(url,args)=>{
    calls.requests.push({url,payload:JSON.parse(args.body)});
    assert.equal(args.headers['X-Gatterka-Token'],'A'.repeat(43));
    if(url.endsWith('/native/choose-save-as')){
      calls.events.push('choose');
      chosen=!cancelled;
      return {ok:true,json:async()=>({cancelled})};
    }
    if(url.endsWith('/native/write-zip')){
      assert.ok(chosen,'ZIP started before selecting save location');
      calls.events.push('write');
      if(writeError)return {ok:false,status:500,json:async()=>({error:writeError})};
      return {ok:true,json:async()=>({zipPath:'X:\\saved\\job.zip',programs:2})};
    }
    throw Error('Unexpected API: '+url);
  },
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,directory)=>{
    assert.ok(chosen,'Programs generated before choosing save folder');
    calls.events.push('generate');
    const folder='2026_10_30_Teszt';
    return {cabinetFolder:folder,names:['01.xPrg','02.xPrg'],files:[
      [folder+'/proba.xMix','<xMix><RigheMix><RigaMix File="'+directory+'01.xPrg" /></RigheMix></xMix>'],
      [folder+'/xPrg/01.xPrg','<SchemaDoc>01</SchemaDoc>'],
      [folder+'/xPrg/02.xPrg','<SchemaDoc>02</SchemaDoc>']
    ]};
  },
  showNotice:text=>calls.notices.push(text),
  Date:FixedDate
 };
 const f=vm.runInNewContext('(function(){'+code+';return {saveXprgToSelectedFolder};})()',sandbox);
 return {f,calls};
}
test('Windows Mentés másként -> programok -> ZIP, külön projektmappa nélkül',async()=>{
 const {f,calls}=harness();
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,['choose','generate','write']);
 assert.equal(calls.requests.length,2);
 assert.ok(calls.requests[0].url.endsWith('/native/choose-save-as'));
 assert.ok(calls.requests[1].url.endsWith('/native/write-zip'));
 assert.equal(calls.requests[1].payload.files.length,3);
 assert.ok(calls.requests[1].payload.files[0].content.includes('xPrg'));
 assert.ok(calls.notices.at(-1).includes('ZIP sikeresen'));
});
test('a Mentés másként megszakítása nem generál programot',async()=>{
 const {f,calls}=harness({cancelled:true});
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,['choose']);
 assert.equal(calls.notices.length,0);
});
test('a ZIP írási hibája nem hoz hamis sikerjelzést',async()=>{
 const {f,calls}=harness({writeError:'A célmappa írásvédett'});
 await f.saveXprgToSelectedFolder();
 assert.ok(calls.notices.at(-1).includes('A célmappa írásvédett'));
 assert.ok(!calls.notices.at(-1).includes('sikeresen'));
});
test('Windows EXE nélkül nincs félrevezető böngészős mentés',async()=>{
 const {f,calls}=harness({missingBridge:true});
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,[]);
 assert.ok(calls.notices.at(-1).includes('Gatterka.exe'));
});