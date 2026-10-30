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
function harness({cancelled=false,formError='',missingBridge=false,popupBlocked=false,noConnection=false}={}){
 const calls={forms:[],notices:[],opened:0,closed:0,progress:[]};
 const bridge=missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)};
 const state={active:'save',layoutMode:'machine',projectName:'Teszt',
   kerf:5,furnitures:[],xmixMachineRoot:root};
 const button={disabled:false};
 const status={hidden:true,className:'',textContent:''};
 const listeners=new Set();
 let popup=null;
 function signal(msg){
   if(!popup)return;
   queueMicrotask(()=>{
     for(const fn of [...listeners])fn({source:popup,origin:bridge.url,data:msg});
   });
 }
 const win={
  addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn)},
  removeEventListener:(type,fn)=>{if(type==='message')listeners.delete(fn)},
  open(url,name,features){
   calls.opened++;
   if(popupBlocked)return null;
   assert.equal(url,'about:blank');
   const obj={
    name,features,closed:false,
    document:{title:'',body:{textContent:''}},
    focus(){},
    close(){calls.closed++;this.closed=true},
    location:{replace(uri){
      calls.progress.push(uri);
      if(!noConnection){
       signal({type:'gatterka-ready',id:name});
      }
    }}
   };
   popup=obj;
   return popup;
  }
 };
 const doc={
  body:{appendChild(){}},
  querySelector:()=>button,
  getElementById:()=>status,
  createElement(tag){
   if(tag==='form')return{
    tag,style:{},fields:[],appendChild(x){this.fields.push(x)},
    remove(){},
    submit(){
     const fields=Object.fromEntries(this.fields.map(x=>[x.name,x.value]));
     calls.forms.push({action:this.action,target:this.target,fields});
     assert.equal(this.target,popup.name);
     assert.ok(calls.progress[0].includes('/native/ready'));
     signal({type:'gatterka-form-result',id:fields.id,ok:!formError,
      value:{path:String.raw`D:\Gyartas\Munka\2026-10-30\2026_10_30_Teszt`,
       programs:2,cancelled},error:formError});
    }
   };
   if(tag==='input')return {tag};
   throw Error('Unexpected element '+tag);
  }
 };
 const sandbox={
  document:doc,window:win,setTimeout,clearTimeout,setInterval,clearInterval,
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
  fetch:()=>{throw Error('Régi fetch mentési megoldás nem használható')}
 };
 const api=vm.runInNewContext('(function(){'+js+
   ';return {machineRootPath,machineExportBundle,saveXprgToSelectedFolder};})()',sandbox);
 return {api,calls,state,status,button,bridge};
}
test('a mentés látható, felső szintű ablakot nyit, majd egyetlen POST-tal ment',async()=>{
 const {api,calls,status,button,bridge}=harness();
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.opened,1);
 assert.equal(calls.progress.length,1);
 assert.ok(calls.progress[0].startsWith(bridge.url+'/native/ready#'));
 assert.equal(calls.forms.length,1);
 const form=calls.forms[0];
 assert.equal(form.action,bridge.url+'/native/pick-save');
 assert.equal(form.fields.token,bridge.token);
 assert.equal(JSON.parse(form.fields.request).files.length,3);
 assert.equal(calls.closed,1);
 assert.equal(button.disabled,false);
 assert.ok(status.textContent.includes('Sikeres gépi mentés'));
});
test('a mappaválasztás megszakítása nem jelent sikert',async()=>{
 const {api,status}=harness({cancelled:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(status.hidden,true);
});
test('a Windows mentő hibáját a Mentés oldalon mutatja',async()=>{
 const {api,status,button}=harness({formError:'Nincs írási jogosultság'});
 await api.saveXprgToSelectedFolder();
 assert.equal(button.disabled,false);
 assert.ok(status.textContent.includes('Nincs írási jogosultság'));
 assert.ok(status.className.includes('error'));
});
test('a letiltott felugró ablak azonnal érthető hibát ad',async()=>{
 const {api,status,calls}=harness({popupBlocked:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,0);
 assert.ok(status.textContent.includes('felugró ablakot'));
});
test('külön HTML-ként megnyitva nem ír hamis gépi programokat',async()=>{
 const {api,status,calls}=harness({missingBridge:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,0);
 assert.ok(status.textContent.includes('Gatterka.exe'));
});
test('a gépi mentés mellett nem jelenik meg a korábbi ZIP-gomb',()=>{
 const a=html.indexOf('function saveView()'),b=html.indexOf('function render(){',a);
 const panel=html.slice(a,b);
 assert.match(panel,/data-action="save-xprg-folder"/);
 assert.doesNotMatch(panel,/data-action="download-xprg-project"/);
 assert.match(panel,/id="machine-save-status"/);
 assert.doesNotMatch(panel,/xmix-machine-root|Kiválasztott célmappa/);
});
