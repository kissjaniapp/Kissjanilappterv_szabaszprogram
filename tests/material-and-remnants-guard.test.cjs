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
function solve(boards,rows,selected=[],remnants=[],onlyRemnants=false){
 const state={trim:12,kerf:5,boards,selectedRemnantIds:selected,
   onlySelectedRemnants:onlyRemnants};
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
test('Két maradék-üzemmód: bevonáskor a kijelölt maradék előnyt élvez, de teljes tábla engedett',()=>{
 const small=sheet('kis-maradek',1200,650,18,'Freya');
 const full=sheet('teljes',2800,2070,18,'Freya');
 const wanted=[row('A',400,200,18,'Freya')];
 const together=solve([full],wanted,['kis-maradek'],[small],false);
 assert.equal(together.failed.length,0);
 assert.equal(together.bins[0].id,'kis-maradek');
 assert.equal(together.bins[0].isRemnant,true);
 const fallback=solve([],wanted,[],[],false);
 assert.equal(fallback.failed.length,0);
 assert.equal(fallback.bins[0].automatic,true);
 assert.equal(fallback.bins[0].id,'standard');
});
test('Csak maradék módban a kézi teljes tábla és az automatikus bútorlap is kizárt',()=>{
 const small=sheet('kis-maradek',1200,650,18,'Freya');
 const full=sheet('teljes',2800,2070,18,'Freya');
 const present=solve([full],[row('A',400,200,18,'Freya')],
   ['kis-maradek'],[small],true);
 assert.equal(present.failed.length,0);
 assert.deepEqual(Array.from(present.bins,b=>b.id),['kis-maradek']);
 assert.ok(present.bins.every(b=>b.isRemnant&&!b.automatic));
 const missing=solve([full],[row('A',400,200,18,'Freya')],[],[small],true);
 assert.equal(missing.failed.length,1);
 assert.equal(missing.bins.length,0,'Bevonni jelölő nélkül semmilyen teljes tábla nem lehet');
 const insufficient=solve([full],[row('Nagy',1600,500,18,'Freya')],
   ['kis-maradek'],[small],true);
 assert.equal(insufficient.failed.length,1);
 assert.equal(insufficient.bins.length,0,
   'nem szabad automatikus tábla után nyúlni, ha a maradék túl kicsi');
});
test('Csak maradék módban munkalapból is rövidebb, de teljes szélességű 38 mm maradék választható',()=>{
 const remnant=sheet('munkalap-maradek',2100,600,38,'Munkalap');
 const whole=sheet('eredeti',4100,600,38,'Munkalap');
 const wanted=[row('M',964,600,38,'Munkalap')];
 const out=solve([whole],wanted,['munkalap-maradek'],[remnant],true);
 assert.equal(out.failed.length,0);
 assert.equal(out.bins.length,1);
 const bin=out.bins[0];
 assert.equal(bin.id,'munkalap-maradek');
 assert.equal(bin.isRemnant,true);
 assert.equal(bin.a,2100);assert.equal(bin.b,600);
 assert.ok(bin.cuts.every(c=>(c.stage==='cross'||c.stage==='cross-head-trim')&&c.length===600));
 assert.ok(!bin.cuts.some(c=>c.stage==='strip'||c.stage==='rip'));
});
test('Anyagadatbázisban és Anyagkészletnél is elérhető a két jelölés, a mód elmentődik',()=>{
 assert.match(html,/const rem='<div class="panel top-gap">/);
 assert.match(html,/data-scope="remnant-only"/);
 assert.match(html,/data-scope="remnant-selection"/);
 assert.match(html,/return onlyMaterials\?mat\+rem:rem/);
 assert.match(html,/selectedRemnantIds:\[\],onlySelectedRemnants:false/);
 assert.match(html,/state\.onlySelectedRemnants=!!el\.checked/);
 assert.match(html,/state\.onlySelectedRemnants\?\[\]:\(state\.boards\|\|\[\]\)/);
});
test('Kijelölés nélküli csak-maradék kérésnél egyértelmű hiba, nem rejtett alaptábla',()=>{
 const begin=html.indexOf('function computeNesting(){');
 const end=html.indexOf('\n  const colors=',begin);
 assert.ok(begin>=0&&end>begin);
 const source=html.slice(begin,end);
 const state={trim:12,kerf:5,onlySelectedRemnants:true,
   selectedRemnantIds:[],boards:[],layoutMode:'auto'};
 const compute=vm.runInNewContext('('+source.trim()+')',{
   state,remnantCatalog:[sheet('kihagyott',1100,600,18,'Freya')],
   getParts:()=>({rows:[{qty:1,a:400,b:200,thickness:18}],
     errors:[],total:1}),Math,Number,Array
 });
 const out=compute();
 assert.match(out.error,/nincs kijelölve egyetlen használható maradék/);
});

test('a gépi gyártási sorrendet és a natív mentési függvényt nem helyettesíti új kód',()=>{
 assert.match(html,/function buildProductionSequence\(bins\)/);
 assert.match(html,/async function saveXprgToSelectedFolder\(\)/);
 assert.match(html,/function buildOfflineXprgProject\(/);
 assert.match(html,/const machineMode=true;/);
});
