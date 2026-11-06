'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('  function threeMfResolvedGroups(');
const end=html.indexOf('  function threeMfImportPreview(',start);
assert.ok(start>=0&&end>start);
const f={
  id:'cabinet',w:1000,ht:720,d:502,t:18,
  parts:[{id:'part1',cabinetDesignKey:'3mf-1',name:'Oldal',
    a:'W-36',b:'D',threeMfThickness:18,q:'2'}],
  threeMfImport:{
    groups:[{name:'Oldal',dimensions:[964,502,18],indices:[0]}],
    parts:[{originMm:[5,7,9],axisBoundsMm:[964,502,18],
      previewTriangles:[[5,7,9,969,7,9,5,509,9]],dimensions:[964,502,18]}]
  }
};
const functions=vm.runInNewContext('(function(){'+html.slice(start,end)+
  ';return {threeMfResolvedGroups};})()',{
  materialForPart:()=>({thickness:18}),
  effectiveShelves:()=>0,effectiveDivider:()=>0,
  calcPartFormula:(expr,vars)=>Number(expr)||Function('W','H','D','T','S','O',
    'return '+expr)(vars.W,vars.H,vars.D,vars.T,vars.S,vars.O)
});
test('3MF méretei az Alkatrészek fül képletével értékelődnek, nem NaN',()=>{
  assert.equal(functions.threeMfResolvedGroups(f)[0].dimensions.join(','),'964,502,18');
  f.w=1100;
  assert.equal(functions.threeMfResolvedGroups(f)[0].dimensions[0],1064);
});
test('3MF eredeti geometria képlet és bútorméret változásakor is érintetlen',()=>{
  f.w=1100;
  assert.equal(functions.threeMfResolvedGroups(f)[0].dimensions[0],1064);
  assert.equal(f.threeMfImport.parts[0].axisBoundsMm[0],964);
  assert.equal(f.threeMfImport.parts[0].previewTriangles[0][3],969);
  const renderer=html.slice(html.indexOf('function mountThreeMfViews(){'),
    html.indexOf('function threeMfCombinedCuttingGroups('));
  assert.match(renderer,/const effectiveParts=model\.parts;/);
  assert.doesNotMatch(renderer,/threeMfEffectiveGeometry/);
});
test('hibás képletnél az eredeti 3MF geometria és méret megmarad',()=>{
  f.parts[0].a='ÉRVÉNYTELEN';
  const row=functions.threeMfResolvedGroups(f)[0];
  assert.equal(row.valid,false);
  assert.equal(f.threeMfImport.parts[0].axisBoundsMm[0],964);
});
test('3MF mérettáblázat frissítése az élő képletfrissítéshez van kapcsolva',()=>{
  assert.match(html,/data-3mf-dimension-rows/);
  assert.match(html,/refreshThreeMfDimensionRows\(dxfFurniture\)/);
});
