'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=source.indexOf('function calc(formula,vars){');
const end=source.indexOf('\n  function intro(',start);
assert.ok(start>0&&end>start,'A 14:05-ös képlet- és alkatrészszámítás hiányzik.');
function fixture({millDepth=1,mill=true,edgeThickness=2,edge='2-0'}={}){
 const part={id:'p1',name:'964 x 200',a:'964',b:'200',q:'2',edge,edgeThickness,mill,millDepth,grainRequired:true};
 const f={name:'Minta',w:1000,ht:910,d:600,t:18,s:0,qty:1,parts:[part]};
 const state={furnitures:[f]};
 const sandbox={state,pnum:v=>Number(String(v).replace(',','.')),Number,Math};
 const out=vm.runInNewContext('(function(){'+source.slice(start,end)+';return {getParts};})()',sandbox);
 return {part,f,list:out.getParts()};
}
test('14:05 vágási alap: 964x200 darabok 1 mm előmarással helyesen kompenzálva',()=>{
 const {list}=fixture();
 assert.equal(list.total,2);
 assert.equal(list.rows[0].a,964);
 assert.equal(list.rows[0].b,198);
 assert.equal(list.rows[0].millDepth,1);
});
test('állítható 0,5 és 1,5 mm marás a szabási méretbe is bekerül',()=>{
 for(const [depth,expected] of [[0.5,197],[1.5,199],[0,196],[2,200]]){
  const {list}=fixture({millDepth:depth});
  assert.equal(list.errors.length,0);
  assert.equal(list.rows[0].b,expected);
  assert.equal(list.rows[0].millDepth,depth);
 }
});
test('ha kikapcsoljuk a marást, a teljes 2 mm élvastagsággal számol',()=>{
 const {list}=fixture({millDepth:1.8,mill:false});
 assert.equal(list.rows[0].b,196);
 assert.equal(list.rows[0].millDepth,0);
});
test('0,4 mm élzárónál nem végez előmarás-kompenzálást',()=>{
 const {list}=fixture({edgeThickness:0.4,mill:true,millDepth:1.5});
 assert.equal(list.rows[0].b,199.2);
 assert.equal(list.rows[0].mill,false);
 assert.equal(list.rows[0].millDepth,0);
});
test('0–2 mm tartományon kívüli vagy hibás mélységet elutasít',()=>{
 for(const depth of [-0.5,2.5,'abc']){
  const {list}=fixture({millDepth:depth});
  assert.equal(list.rows[0].qty,0);
  assert.match(list.errors[0],/0–2 mm/);
 }
});
test('régi projektek 1 mm alapértéke és az eredeti 14:05 Szabásterv megmarad',()=>{
 assert.match(source,/part\.millDepth\?\?1/);
 assert.match(source,/function makeStripPlan\(/);
 assert.match(source,/function svgBoard\(/);
 assert.match(source,/function cuttingStepsView\(/);
 assert.match(source,/data-key="millDepth"/);
 assert.match(source,/0–2 mm között/);
 assert.match(source,/\['nesting','04','Szabásterv'/);
 assert.doesNotMatch(source,/data-page="save"/);
});
