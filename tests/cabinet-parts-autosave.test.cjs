'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const match=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'A beágyazott szerkesztő megtalálható');
const designer=JSON.parse(match[1]);

test('a kézi testreszabásmentés gomb megszűnt, a beállítások automatikusan mentődnek',()=>{
  assert.doesNotMatch(source,/data-action="save-furniture-customization"/);
  assert.match(source,/document\.addEventListener\('input',autoSaveFurnitureEdits\)/);
  assert.match(source,/document\.addEventListener\('change',autoSaveFurnitureEdits\)/);
  assert.match(source,/queueMicrotask\(\(\)=>/);
  assert.match(source,/captureVisibleFurnitureEdits\(\)/);
});

test('a 3D tervező azonnal szinkronizál és oldalváltás előtt átadja az alkatrészeket',()=>{
  assert.match(designer,/window\.GatterkaCabinetBridge=\{snapshot\}/);
  assert.match(designer,/window\.parent\.gatterkaCabinetDirectSave\?\.\(window,data\)/);
  assert.match(designer,/gatterka-designer-save/);
  assert.match(source,/window\.gatterkaCabinetDirectSave=function\(source,design\)/);
  assert.match(source,/frame\.contentWindow!==source/);
  assert.match(source,/captureCabinetDesignerBeforePageChange\(\);\s*\/\/ Korábbi/);
  assert.match(source,/applyCabinetDesignerSnapshot\(f,event\.data\.design\)/);
});

test('a szerkezeti alkatrészek bekerülnek a szerkeszthető listába, a bizonytalan hátfal gépi vágása tiltott',()=>{
  const start=source.indexOf('  function syncCabinetDesignerParts(f,records){');
  const end=source.indexOf('  function cabinetDesignerDims(f){',start);
  assert.ok(start>=0&&end>start);
  const snippet=source.slice(start,end);
  const ctx={
    uuid:(()=>{let i=0;return ()=>'new-'+(++i);})(),
    sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
    result:null
  };
  vm.runInNewContext(snippet,ctx);
  const furniture={parts:[]};
  const parts=[
    {key:'side-left',name:'Bal oldallap',a:910,b:600,qty:1,ready:true},
    {key:'side-right',name:'Jobb oldallap',a:910,b:600,qty:1,ready:true},
    {key:'top',name:'Tető',a:964,b:600,qty:1,ready:true},
    {key:'back-rabbet',name:'Falcos hátlap',a:964,b:874,qty:1,ready:false}
  ];
  ctx.syncCabinetDesignerParts(furniture,parts);
  assert.equal(furniture.parts.length,4);
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='top').a,'964');
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='back-rabbet').dxfUnverified,true);
  furniture.parts[0].edge='2-0';
  ctx.syncCabinetDesignerParts(furniture,[...parts.slice(0,2),{...parts[2],a:952},parts[3]]);
  assert.equal(furniture.parts.length,4,'Egy alkatrész sem duplázódhat');
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='top').a,'952');
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='side-left').edge,'2-0');
});
