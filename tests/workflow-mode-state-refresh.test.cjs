'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const section=(begin,end)=>{
 const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'Nem található állapotkezelő: '+begin);
 return source.slice(a,b);
};
const switcher=section('  function switchFurnitureWorkflowParts(f,previous,next){','  function modeChoiceView(){');
const snapshot=section('  function applyCabinetDesignerSnapshot(f,design){','  window.gatterkaCabinetDirectSave=');
function setup(){
 const context={};
 vm.createContext(context);
 vm.runInContext(
  'let result={stale:true},currentMode="design";'+
  'function designWorkflowMode(){return currentMode;}'+
  'function syncCabinetDesignerParts(f,rows){f.parts=rows.map(x=>({...x}));}'+
  'function syncCustomParameterParts(){}'+
  switcher+'\n'+snapshot+'\n'+
  'this.mode=(f,from,to)=>{switchFurnitureWorkflowParts(f,from,to);currentMode=to;};'+
  'this.edit=applyCabinetDesignerSnapshot;'+
  'this.working=()=>result;',context);
 return context;
}
const identifiers=f=>Array.from(f.parts,x=>x.id);

test('3MF -> bútortervező -> 3MF -> bútortervező: nincs régi alkatrész és adatvesztés',()=>{
 const c=setup(),f={
   parts:[{id:'3mf-left',threeMfGenerated:true},{id:'3mf-right',threeMfGenerated:true}],
   threeMfImport:{parts:[{name:'body'}]},
   cabinetDesign:{parts:[{id:'cabinet-top'}]},
   customParameters:[],s:0
 };
 c.mode(f,'parts','design');
 assert.deepEqual(identifiers(f),['cabinet-top']);
 c.edit(f,{parts:[{id:'cabinet-top'},{id:'cabinet-added'}],inputs:{count:0}});
 assert.deepEqual(identifiers(f),['cabinet-top','cabinet-added']);
 assert.equal(c.working(),null,'Elavult szabástervet újra kell számolni');
 c.mode(f,'design','parts');
 assert.deepEqual(identifiers(f),['3mf-left','3mf-right']);
 c.mode(f,'parts','design');
 assert.deepEqual(identifiers(f),['cabinet-top','cabinet-added']);
});
test('Kézi alkatrészmód külön megmarad, a 3MF nem keveredik a CNC-adatokkal',()=>{
 const c=setup(),f={parts:[{id:'3mf-a',threeMfGenerated:true,cncInstances:[{key:'3mf-a'}]}]};
 c.mode(f,'parts','manual');
 assert.deepEqual(identifiers(f),[]);
 f.parts.push({id:'manual-a'});
 c.mode(f,'manual','parts');
 assert.deepEqual(identifiers(f),['3mf-a']);
 assert.deepEqual(Array.from(f.parts[0].cncInstances,x=>x.key),['3mf-a']);
 c.mode(f,'parts','manual');
 assert.deepEqual(identifiers(f),['manual-a']);
});
test('Módváltás és a bútortervező mentése azonnal frissíti a közös aktív listát',()=>{
 assert.match(source,/if\(previous!==next\)for\(const furniture of state\.furnitures\)/);
 assert.match(source,/if\(designWorkflowMode\(\)==='design'&&Array\.isArray\(design\.parts\)\)/);
 assert.match(source,/syncCabinetDesignerParts\(f,design\.parts\);\s*result=null;/);
 assert.match(source,/window\.gatterkaBuildAutoCnc=function\(options\)/);
 assert.match(source,/const rows=getParts\(\)\.rows\.filter/);
});
test('A bevált CNC export és a fenék/tető/pótfenék feldolgozása érintetlen',()=>{
 assert.match(source,/op\(lower,'LAPA'/);
 assert.match(source,/op\(upper,'LAPA'/);
 assert.match(source,/op\(lower,'ELF3'/);
 assert.match(source,/op\(upper,'ELF2'/);
 assert.match(source,/const target=p\.falseBottom/);
 assert.match(source,/window\.gatterkaSaveAutoCncAs=async function/);
});
