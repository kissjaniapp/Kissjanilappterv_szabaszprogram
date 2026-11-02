'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('  const STANDARD_BOARD=');
const end=html.indexOf('  // Gyártási sorrend:',start);
assert.ok(start>0&&end>start);
const sheet=(id,a,b,thickness,color)=>({id,name:id,a,b,thickness,materialColor:color,qty:1});
const row=(name,a,b,thickness,color)=>({part:{id:name,name},furniture:{name:'Szekrény',materialColor:color},qty:1,
 a,b,originalA:a,originalB:b,thickness,materialColor:color,rot:false,edge:'0-0',
 edgeThickness:2,mill:false,millDepth:0});
function solve(boards,rows,selected=[],remnants=[]){
 const state={trim:12,kerf:5,boards,selectedRemnantIds:selected};
 const plan=vm.runInNewContext('(function(){'+html.slice(start,end)+';return makeStripPlan;})()',
   {state,remnantCatalog:remnants,Math,Number,String});
 return plan(0,{rows,total:rows.length,errors:[]},'auto');
}
test('egy tábla nem kever két különböző színt, akkor sem, ha azonos a vastagság',()=>{
 const out=solve([sheet('egy',2800,2070,18,'')],[
   row('A',900,200,18,'Freya'),row('B',900,200,18,'Tölgy')
 ]);
 assert.equal(out.failed.length,0);
 assert.equal(out.bins.length,2);
 for(const bin of out.bins){
  const colors=[...new Set(bin.machine.strips.flatMap(x=>x.items.map(p=>p.item.materialColor)))];
  assert.equal(colors.length,1);
  assert.equal(colors[0],bin.materialColor);
 }
});
test('38 munkalap, 12 RTG és 15 Hexa RTG csak azonos vastagságú készletre kerül',()=>{
 const boards=[sheet('munkalap',2800,2070,38,'Munkalap'),
  sheet('rtg',2800,2070,12,'RTG'),sheet('hexa',2800,2070,15,'Hexa RTG')];
 const out=solve(boards,[row('M',900,200,38,'Munkalap'),
 row('R',900,200,12,'RTG'),row('H',900,200,15,'Hexa RTG')]);
 assert.equal(out.failed.length,0);
 assert.equal(out.bins.length,3);
 assert.deepEqual([...new Set(Array.from(out.bins,x=>x.thickness))].sort((a,b)=>a-b),[12,15,38]);
});
test('csak bepipált maradék kerülhet a nestingbe, és az előnézet nem csökkenti a készletet',()=>{
 const remnant=sheet('maradek1',700,500,18,'Freya');
 const input=[row('kis',300,200,18,'Freya')];
 const without=solve([],input,[],[remnant]);
 assert.ok(without.bins.every(b=>b.id!=='maradek1'));
 const selected=solve([],input,['maradek1'],[remnant]);
 assert.equal(selected.failed.length,0);
 assert.equal(selected.bins[0].id,'maradek1');
 assert.equal(remnant.qty,1);
});
test('a gépi gyártási sorrendet és a natív mentési függvényt nem helyettesíti új kód',()=>{
 assert.match(html,/function buildProductionSequence\(bins\)/);
 assert.match(html,/async function saveXprgToSelectedFolder\(\)/);
 assert.match(html,/function buildOfflineXprgProject\(/);
 assert.match(html,/const machineMode=true;/);
});
