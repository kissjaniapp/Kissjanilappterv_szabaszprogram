'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=source.indexOf('window.gatterkaSaveAutoCncAs=async function(files,report=');
const end=source.indexOf('  function savePage(){',start);
assert.ok(start>0&&end>start,'Hiányzik a natív CNC Mentés másként útvonal');
const script=source.slice(start,end);
function harness({cancelled=false,bridge=true}={}){
 const calls=[];
 const windows={};
 const sandbox={
  nativeBridge:bridge?{url:'http://127.0.0.1:33000',token:'token'}:null,
  window:windows,
  requestNativeMachine:async(action,payload)=>{
   calls.push({action,payload});
   if(action==='choose-cnc-save-as')
     return cancelled?{cancelled:true}:{cancelled:false,xxlPath:'C:\\CNC\\elso.xxl'};
   if(action==='write-cnc-files')
     return {firstPath:'C:\\CNC\\elso.xxl',folder:'C:\\CNC',
       programs:payload.programs.map(p=>'C:\\CNC\\'+p.name),
       reportPath:payload.report?'C:\\CNC\\ELLENORIZENDO_KIMARADT.txt':''};
   throw Error('Ismeretlen native művelet: '+action);
  }
 };
 vm.runInNewContext(script,sandbox);
 return {save:windows.gatterkaSaveAutoCncAs,calls};
}
const files=[
 {filename:'Oldal_bal_side-left.xxl',content:'H DX=600 DY=400 DZ=18 -IJ\r\nLAPA X=50 Y=0 A=0 y=390 G=1\r\nVEGE\r\n'},
 {filename:'Oldal_jobb_side-right.xxl',content:'H DX=600 DY=400 DZ=18 -LK\r\nLAPA X=50 Y=0 A=0 y=390 G=1\r\nVEGE\r\n'}
];
test('CNC Mentés másként ugyanazon Windows natív hídon választ, majd ténylegesen fájlba ír',async()=>{
 const {save,calls}=harness();
 const result=await save(files,'');
 assert.equal(result.programs.length,2);
 assert.deepEqual(calls.map(c=>c.action),['choose-cnc-save-as','write-cnc-files']);
 assert.equal(calls[0].payload.defaultName,files[0].filename);
 assert.equal(calls[1].payload.programs.length,2);
 assert.equal(calls[1].payload.programs[1].content,files[1].content);
 assert.equal(calls[1].payload.report,'');
});
test('részleges mentés a felismert hibákat külön jelentésben adja a Go-nak',async()=>{
 const {save,calls}=harness();
 const report='GATTERKA – RESZLEGES\nF-osztó ellenőrizendő';
 await save(files,report);
 assert.equal(calls[1].payload.report,report);
});
test('mentési ablak megszakításakor semmilyen CNC-fájl írása nem indul',async()=>{
 const {save,calls}=harness({cancelled:true});
 const result=await save(files);
 assert.equal(result.cancelled,true);
 assert.deepEqual(calls.map(x=>x.action),['choose-cnc-save-as']);
});
test('Gatterka.exe hiányában nem állíthatja a program, hogy fájlt mentett',async()=>{
 const {save,calls}=harness({bridge:false});
 await assert.rejects(()=>save(files),/Gatterka.exe/);
 assert.equal(calls.length,0);
});
test('üres CNC-programlistához nem nyílik meg a Windows Mentés másként',async()=>{
 const {save,calls}=harness();
 await assert.rejects(()=>save([]),/Nincs hitelesített/);
 assert.equal(calls.length,0);
});
