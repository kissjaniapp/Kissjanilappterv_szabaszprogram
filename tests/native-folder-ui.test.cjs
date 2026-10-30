'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('function rememberMachineRoot(');
const end=html.indexOf('\n  function downloadCutList(',start);
assert.ok(start>=0&&end>start,'Hiányzik a natív XMIX mentés');
const js=html.slice(start,end);
const root=String.raw`C:\Gatterka`;
class FixedDate extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({cancelled=false,formError='',missingBridge=false,noConnection=false}={}){
 const calls={forms:[],notices:[],frames:[],removed:[],openedWindows:0};
 const bridge=missingBridge?null:{url:'http://127.0.0.1:31825',token:'A'.repeat(43)};
 const state={active:'save',layoutMode:'machine',projectName:'Teszt',
   kerf:5,furnitures:[],xmixMachineRoot:root};
 const button={disabled:false};
 const status={hidden:true,className:'',textContent:''};
 const listeners=new Set();
 let frame=null;
 function signal(msg){
  queueMicrotask(()=>{for(const fn of [...listeners])fn({
   source:frame.contentWindow,origin:bridge.url,data:msg
  })});
 }
 const win={
  addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn)},
  removeEventListener:(type,fn)=>{if(type==='message')listeners.delete(fn)},
  open(){calls.openedWindows++;throw Error('Edge-es felugró ablak nem engedélyezett')}
 };
 const doc={
  body:{appendChild(el){if(el.tag==='iframe'){frame=el;calls.frames.push(el)}}},
  querySelector:()=>button,
  getElementById:()=>status,
  createElement(tag){
   if(tag==='iframe'){
    const item={
      tag,name:'',style:{},contentWindow:{},setAttribute(){},
      remove(){calls.removed.push('frame')},
      set src(url){
       calls.ready=url;
       if(!noConnection)signal({type:'gatterka-ready',id:item.name});
      }
    };
    return item;
   }
   if(tag==='form')return{
    tag,style:{},fields:[],appendChild(x){this.fields.push(x)},
    remove(){calls.removed.push('form')},
    submit(){
     const fields=Object.fromEntries(this.fields.map(x=>[x.name,x.value]));
     calls.forms.push({action:this.action,target:this.target,fields});
     signal({type:'gatterka-form-result',id:fields.id,ok:!formError,
      value:{path:String.raw`D:\Gyartas\Munka\Teszt.xMix`,
       programs:2,cancelled},error:formError});
    }
   };
   if(tag==='input')return {tag};
   throw Error('Unexpected element '+tag);
  }
 };
 const setTimeoutFast=(fn,delay)=>delay===8000&&noConnection?setTimeout(fn,0):setTimeout(fn,delay);
 const sandbox={
  document:doc,window:win,setTimeout:setTimeoutFast,clearTimeout,
  nativeBridge:bridge,defaultXmixMachineRoot:root,state,
  save:()=>{},result:{machineReady:true,error:null,bins:[{machine:{strips:[{}]}}],failed:[]},
  getFurniture:()=>({name:'Teszt',destination:'Teszt',materialColor:'Freya'}),
  buildOfflineXprgProject:(_bins,_project,_color,_kerf,_date,location,_mode,dest)=>{
   const cabinet='2026_10_30_'+dest;
   return {cabinetFolder:cabinet,files:[
     [cabinet+'/test.xMix','<xMix><RigheMix><RigaMix File="'+location+'a.xPrg" /><RigaMix File="'+location+'b.xPrg" /></RigheMix></xMix>'],
     [cabinet+'/xPrg/a.xPrg','<SchemaDoc></SchemaDoc>'],
     [cabinet+'/xPrg/b.xPrg','<SchemaDoc></SchemaDoc>']
   ]};
  },
  showNotice:x=>calls.notices.push(x),Date:FixedDate
 };
 const api=vm.runInNewContext('(function(){'+js+
   ';return {machineRootPath,machineExportBundle,saveXprgToSelectedFolder};})()',sandbox);
 return {api,calls,status,button,bridge};
}
test('csak a Windows Mentés másként nyílik meg, nincs külön Edge segédablak',async()=>{
 const {api,calls,status,button,bridge}=harness();
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.openedWindows,0);
 assert.equal(calls.frames.length,1);
 assert.ok(calls.ready.startsWith(bridge.url+'/native/ready#'));
 assert.equal(calls.forms.length,1);
 assert.equal(calls.forms[0].action,bridge.url+'/native/pick-save');
 assert.equal(calls.forms[0].fields.token,bridge.token);
 assert.equal(JSON.parse(calls.forms[0].fields.request).files.length,3);
 assert.equal(button.disabled,false);
 assert.ok(status.textContent.includes('Sikeres gépi mentés'));
 assert.deepEqual(calls.removed,['form','frame']);
});
test('a Mégse gombra nem történik gépi mentés',async()=>{
 const {api,status}=harness({cancelled:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(status.hidden,true);
});
test('a Windows hibaüzenete látható',async()=>{
 const {api,status}=harness({formError:'Nincs írási jogosultság'});
 await api.saveXprgToSelectedFolder();
 assert.ok(status.textContent.includes('Nincs írási jogosultság'));
 assert.ok(status.className.includes('error'));
});
test('a nem induló mentőszolgáltatás rövid idő után hibát ad',async()=>{
 const {api,status,button}=harness({noConnection:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(button.disabled,false);
 assert.ok(status.textContent.includes('nem elérhető'));
});
test('index.htm külön megnyitása nem ment titokban',async()=>{
 const {api,calls,status}=harness({missingBridge:true});
 await api.saveXprgToSelectedFolder();
 assert.equal(calls.forms.length,0);
 assert.ok(status.textContent.includes('Gatterka.exe'));
});
test('a Mentés oldalon egyetlen gépi mentési gomb van, ZIP gomb nélkül',()=>{
 const a=html.indexOf('function saveView()'),b=html.indexOf('function render(){',a);
 const panel=html.slice(a,b);
 assert.match(panel,/data-action="save-xprg-folder"/);
 assert.doesNotMatch(panel,/data-action="download-xprg-project"/);
 assert.match(panel,/Mentés másként/);
 assert.doesNotMatch(panel,/xmix-machine-root|Kiválasztott célmappa/);
});
