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
const SAVED_FOLDER='D:\\Szabas\\Konyha';
function harness({cancelled=false,writeError='',missingBridge=false,buildError=''}={}){
 const calls={requests:[],notices:[],events:[]};
 const status={textContent:'',style:{}};
 const button={disabled:false,textContent:'💾 Mentés másként'};
 let chosen=false;
 const sandbox={
  document:{getElementById:id=>id==='machine-save-status'?status:null,querySelector:selector=>selector==='[data-action="save-xprg-folder"]'?button:null},
  nativeBridge:missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)},
  state:{layoutMode:'machine',projectName:'Teszt',kerf:5,furnitures:[],xmixMachineRoot:'X:\\old'},
  defaultXmixMachineRoot:'X:\\old',
  savedMachineRoot:'X:\\old',
  result:{machineReady:true,error:null,bins:[{}],failed:[]},
  localStorage:{setItem(){}},save(){},
  fetch:async(url,args)=>{
    const payload=JSON.parse(args.body);
    calls.requests.push({url,payload});
    assert.equal(args.headers['X-Gatterka-Token'],'A'.repeat(43));
    if(url.endsWith('/native/choose-save-as')){
      calls.events.push('choose');
      chosen=!cancelled;
      return {ok:true,json:async()=>({cancelled,mixPath:SAVED_FOLDER+'\\Konyha.xMix'})};
    }
    if(url.endsWith('/native/write-files')){
      assert.ok(chosen,'A fájlok írása a Mentés másként ablak előtt indult');
      calls.events.push('write');
      if(writeError)return {ok:false,status:500,json:async()=>({error:writeError})};
      return {ok:true,json:async()=>({
        mixPath:SAVED_FOLDER+'\\Konyha.xMix',folder:SAVED_FOLDER,
        programs:[SAVED_FOLDER+'\\01.xPrg',SAVED_FOLDER+'\\02.xPrg']
      })};
    }
    throw Error('Unexpected API: '+url);
  },
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,directory)=>{
    calls.events.push('generate');
    if(buildError)throw Error(buildError);
    const folder='2026_10_30_Teszt';
    return {cabinetFolder:folder,mixName:'2026_10_30_Teszt_OFFLINE.xMix',names:['01.xPrg','02.xPrg'],files:[
      [folder+'/2026_10_30_Teszt_OFFLINE.xMix','<xMix><RigheMix><RigaMix File="'+directory+'01.xPrg" /></RigheMix></xMix>'],
      [folder+'/xPrg/01.xPrg','<SchemaDoc>01</SchemaDoc>'],
      [folder+'/xPrg/02.xPrg','<SchemaDoc>02</SchemaDoc>']
    ]};
  },
  showNotice:text=>calls.notices.push(text),
  Date:FixedDate
 };
 const f=vm.runInNewContext('(function(){'+code+';return {saveXprgToSelectedFolder};})()',sandbox);
 return {f,calls,status,button};
}
test('Windows Mentés másként -> külön xMix és xPrg fájlok a kiválasztott mappába (nem ZIP)',async()=>{
 const {f,calls,status,button}=harness();
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,['generate','choose','write']);
 assert.equal(calls.requests.length,2);
 assert.ok(calls.requests[0].url.endsWith('/native/choose-save-as'));
 assert.equal(calls.requests[0].payload.defaultName,'2026_10_30_Teszt_OFFLINE.xMix');
 assert.ok(calls.requests[1].url.endsWith('/native/write-files'));
 const sent=calls.requests[1].payload;
 assert.ok(sent.mix.startsWith('<xMix>'));
 assert.deepEqual(sent.programs.map(p=>p.name),['01.xPrg','02.xPrg']);
 assert.ok(sent.programs.every(p=>p.content.startsWith('<SchemaDoc>')));
 assert.ok(!calls.requests.some(r=>/zip/i.test(r.url)));
 assert.ok(status.textContent.includes(SAVED_FOLDER));
 assert.ok(status.textContent.includes('Konyha.xMix'));
 assert.ok(status.textContent.includes('2 xPrg'));
 assert.ok(!/ZIP/.test(status.textContent));
 assert.equal(button.disabled,false);
});
test('a Mentés másként megszakítása nem ír fájlt',async()=>{
 const {f,calls,status}=harness({cancelled:true});
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,['generate','choose']);
 assert.ok(status.textContent.includes('megszakítottad'));
});
test('hibás nesting/hiányzó adat esetén meg sem nyílik a Mentés másként ablak',async()=>{
 const {f,calls,status,button}=harness({buildError:'Az anyag színét a Bútor adatai oldalon add meg.'});
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,['generate']);
 assert.equal(calls.requests.length,0);
 assert.ok(status.textContent.includes('Az anyag színét'));
 assert.equal(button.disabled,false);
});
test('az írási hiba nem hoz hamis sikerjelzést',async()=>{
 const {f,status}=harness({writeError:'A célmappa írásvédett'});
 await f.saveXprgToSelectedFolder();
 assert.ok(status.textContent.includes('A célmappa írásvédett'));
 assert.ok(!status.textContent.includes('Elmentve'));
});
test('Windows EXE nélkül nincs félrevezető böngészős mentés',async()=>{
 const {f,calls,status}=harness({missingBridge:true});
 await f.saveXprgToSelectedFolder();
 assert.deepEqual(calls.events,[]);
 assert.ok(status.textContent.includes('Gatterka.exe'));
});
test('a mentés gombja rögtön állapotot mutat és nem indít párhuzamos mentést',async()=>{
 const {f,status,button}=harness();
 const promise=f.saveXprgToSelectedFolder();
 assert.equal(button.disabled,true);
 assert.match(status.textContent,/Mentés másként ablak megnyitása/);
 await promise;
 assert.equal(button.disabled,false);
});
