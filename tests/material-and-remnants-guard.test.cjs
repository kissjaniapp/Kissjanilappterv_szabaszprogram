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
test('a 4100×600 munkalap, a 12 RTG és 15 Hexa RTG csak megfelelő készletre kerül',()=>{
 const boards=[sheet('munkalap',4100,600,38,'Munkalap'),
  sheet('rtg',2800,2070,12,'RTG'),sheet('hexa',2800,2070,15,'Hexa RTG')];
 const out=solve(boards,[row('M',900,600,38,'Munkalap'),
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
test('Bevonni jelölés kötelező: a maradék előbb részt vesz, a többi darabhoz teljes tábla engedett',()=>{
 const small=sheet('kis-maradek',1200,650,18,'Freya');
 const full=sheet('teljes',2800,2070,18,'Freya');
 const wanted=[row('A',400,200,18,'Freya'),row('B',1800,700,18,'Freya')];
 const together=solve([full],wanted,['kis-maradek'],[small]);
 assert.equal(together.failed.length,0);
 assert.ok(together.bins.some(b=>b.id==='kis-maradek'&&b.isRemnant&&b.placements.length>0));
 assert.ok(together.bins.some(b=>b.id==='teljes'&&b.placements.length>0),
  'a maradék felhasználása után normál bútorlap is bevonható');
 const fallback=solve([],wanted,[],[]);
 assert.equal(fallback.failed.length,0);
 assert.ok(fallback.bins.some(b=>b.automatic));
});
test('Két kijelölt maradékhoz a program mindkét maradékon tényleges alkatrészt helyez el',()=>{
 const r1=sheet('R1',1200,650,18,'Freya');
 const r2=sheet('R2',1500,700,18,'Freya');
 const out=solve([],[row('A',400,200,18,'Freya'),row('B',400,200,18,'Freya')],
  ['R1','R2'],[r1,r2]);
 assert.equal(out.failed.length,0);
 assert.equal(out.bins.length,2);
 assert.deepEqual(Array.from(out.bins,b=>b.id),['R1','R2']);
 assert.ok(out.bins.every(b=>b.isRemnant&&b.placements.length===1));
});
test('Anyagadatbázisban és Anyagkészletnél Bevonni látszik; nincs csak-maradék kapcsoló',()=>{
 assert.match(html,/const rem='<div class="panel top-gap">/);
 assert.match(html,/data-scope="remnant-selection"/);
 assert.match(html,/Kötelező maradékfelhasználás/);
 assert.match(html,/return onlyMaterials\?mat\+rem:rem/);
 assert.doesNotMatch(html,/data-scope="remnant-only"/);
 assert.doesNotMatch(html,/state\.onlySelectedRemnants=!!el\.checked/);
 assert.doesNotMatch(html,/onlySelectedRemnants:false/);
});
test('Bevonni-nem-felhasználható maradék hibát jelent, nem hallgatólagos kihagyást',()=>{
 const begin=html.indexOf('function computeNesting(){');
 const end=html.indexOf('\n  const colors=',begin);
 assert.ok(begin>=0&&end>begin);
 const source=html.slice(begin,end);
 const state={trim:12,kerf:5,selectedRemnantIds:['R1'],boards:[],layoutMode:'auto'};
 const remnant=sheet('R1',1200,650,18,'Fekete');
 const makeStripPlan=()=>({bins:[],failed:[],items:[],sheetArea:0,usedArea:0});
 const compute=vm.runInNewContext('('+source.trim()+')',{
   state,remnantCatalog:[remnant],getParts:()=>({
     rows:[{qty:1,a:400,b:200,thickness:18,materialColor:'Freya'}],
     errors:[],total:1}),
   makeStripPlan,buildProductionSequence:()=>({}),Math,Number,Array
 });
 const out=compute();
 assert.match(out.error,/Bevonni jelölés kötelező/);
 assert.match(out.error,/R1/);
});
test('Régi, megszűnt csak-maradék kapcsoló mentésből automatikusan eltűnik',()=>{
 assert.match(html,/delete state\.onlySelectedRemnants/);
 assert.match(html,/delete data\.onlySelectedRemnants/);
 assert.match(html,/selectedRemnantIds:\[\]/);
});
test('Munkalap szabás nincs: a 38 mm régi program nem kerülhet gépi mentésbe',()=>{
 const begin=html.indexOf('function computeNesting(){');
 const end=html.indexOf('\n  const colors=',begin);
 const source=html.slice(begin,end);
 const state={trim:12,kerf:5,selectedRemnantIds:[],boards:[]};
 const compute=vm.runInNewContext('('+source.trim()+')',{
   state,remnantCatalog:[],getParts:()=>({
     rows:[{qty:1,a:964,b:600,thickness:38,materialColor:'Munkalap'}],
     errors:[],total:1}),Math,Number,Array
 });
 const out=compute();
 assert.match(out.error,/munkalapok szabását megszüntettük/i);
 assert.doesNotMatch(html,/id:'work38',name:'Munkalap'/);
});
test('a gépi gyártási sorrendet és a natív mentési függvényt nem helyettesíti új kód',()=>{
 assert.match(html,/function buildProductionSequence\(bins\)/);
 assert.match(html,/async function saveXprgToSelectedFolder\(\)/);
 assert.match(html,/function buildOfflineXprgProject\(/);
 assert.match(html,/const machineMode=true;/);
});
