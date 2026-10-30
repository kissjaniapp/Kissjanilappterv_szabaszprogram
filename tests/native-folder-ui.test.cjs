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
const js=html.slice(start,end);
const root=String.raw`C:\Gatterka`;

class FixedDate extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({cancelled=false,formError='',missingBridge=false}={}){
 const calls={forms:[],notices:[],removed:[]};
 const bridge=missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)};
 const state={active:'save',layoutMode:'machine',projectName:'Teszt',
   kerf:5,furnitures:[],xmixMachineRoot:root};
 const button={disabled:false};
 const status={hidden:true,className:'',textContent:''};
 const frames=[];
 const listeners=new Set();
 const win={
  addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn)},
  removeEventListener:(type,fn)=>{if(type==='message')listeners.delete(fn)}
 };
 const doc={
  body:{appendChild(el){if(el.tag==='iframe')frames.push(el);}},
  querySelector:()=>button,
  getElementById:()=>status,
  createElement(tag){
   if(tag==='iframe')return {
    tag,name:'',style:{},dataset:{},contentWindow:{},setAttribute(){},
    remove(){calls.removed.push('frame');}
   };
   if(tag==='form')return{
    tag,style:{},fields:[],appendChild(x){this.fields.push(x)},
    remove(){calls.removed.push('form')},
    submit(){
     const fields=Object.fromEntries(this.fields.map(x=>[x.name,x.value]));
     calls.forms.push({action:this.action,target:this.target,fields});
     const frame=frames.find(f=>f.name===this.target);
     queueMicrotask(()=>{
      const reply={type:'gatterka-form-result',id:fields.id,ok:!formError,
       value:{path:String.raw`D:\Gyartas\Munka\2026-10-30\2026_10_30_Teszt`,
         programs:2,cancelled},error:formError};
      for(const fn of [...listeners])fn({source:frame.contentWindow,origin:bridge.url,data:reply});
     });
    }
   };
   if(tag==='input')return {tag};
   throw Error('Unexpected element '+tag);
  }
 };
 const sandbox={
  document:doc,window:win,setTimeout,clearTimeout,
  nativeBridge:bridge,defaultXmixMachineRoot:root,state,
  save:()=>{},result:{machineReady:true,error:null,bins:[{machine:{strips:[{}]}}],failed:[]},
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,location,_mode,dest)=>{
   const cabinet='2026_10_30_'+dest;
   return {cabinetFolder:cabinet,names:['a.xPrg','b.xPrg'],files:[
    [cabinet+'/test.xMix','<xMix><RigheMix><RigaMix File="'+location+'a.xPrg" /><RigaMix File="'+location+'b.xPrg" /></RigheMix></xMix>'],
    [cabinet+'/xPrg/a.xPrg','<SchemaDoc></SchemaDoc>'],
    [cabinet+'/xPrg/b.xPrg','<SchemaDoc></SchemaDoc>']
   ]};
  },
  showNotice:x=>calls.notices.push(x),Date:FixedDate,
  fetch:()=>{throw Error('Régi fetch útvonal nem használható a mentéshez!')}
 };
 const api=vm.runInNewContext('(function(){'+js+
   ';return {machineRootPath,machineExportBundle,saveXprgToSelectedFolder};})()',sandbox);
 return {api,calls,state,status,button,bridge};
}
test('a Mentés pontosan egy űrlap POST-ot küld a natív pick-save végpontra',async()=>{
 const {api,calls,status,button,bridge}=harness();
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,1);
 const form=calls.forms[0];
 assert.equal(form.action,bridge.url+'/native/pick-save');
 assert.equal(form.fields.token,bridge.token);
 const request=JSON.parse(form.fields.request);
 assert.equal(request.cabinetFolder,'2026_10_30_Teszt');
 assert.equal(request.files.length,3);
 assert.ok(request.files[0].content.includes('xPrg'));
 assert.equal(button.disabled,false);
 assert.equal(status.hidden,false);
 assert.ok(status.textContent.includes('Sikeres gépi mentés'));
 assert.ok(status.textContent.includes('D:'));
 assert.deepEqual(calls.removed,['form','frame']);
});
test('a mappaválasztó megszakítása nem jelent sikeres mentést',async()=>{
 const {api,calls,status,button}=harness({cancelled:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,1);
 assert.equal(status.hidden,true);
 assert.equal(button.disabled,false);
});
test('a natív mentési hiba látható üzenetet ad és újra engedi a mentést',async()=>{
 const {api,status,button}=harness({formError:'Nincs írási jogosultság'});
 await api.saveXprgToSelectedFolder();
 assert.equal(button.disabled,false);
 assert.ok(status.textContent.includes('Nincs írási jogosultság'));
 assert.ok(status.className.includes('error'));
});
test('külön HTML-ként megnyitva nem ír hamis gépi programokat',async()=>{
 const {api,status,calls}=harness({missingBridge:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,0);
 assert.ok(status.textContent.includes('Gatterka.exe'));
});
test('a célmappa nem szerepel a program felületén',()=>{
 const a=html.indexOf('function saveView()'),b=html.indexOf('function render(){',a);
 const panel=html.slice(a,b);
 assert.match(panel,/data-action="save-xprg-folder"/);
 assert.doesNotMatch(panel,/data-action="download-xprg-project"/);
 assert.match(panel,/id="machine-save-status"/);
 assert.doesNotMatch(panel,/xmix-machine-root|Kiválasztott célmappa/);
});
