'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function section(first,last){
  const a=html.indexOf(first),b=html.indexOf(last,a+first.length);
  assert.ok(a>=0&&b>a,'Hiányzik a kódblokk: '+first);
  return html.slice(a,b);
}
const nestingSource=section('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const scheduleSource=section('function buildProductionSequence(bins){','  function computeNesting(){');
const exportSource=section('  function buildOfflineXprgProject(',
  '  // Az indító teljes Windows-útvonalat ad vissza.');
const makeStripPlan=vm.runInNewContext('(function(){'+nestingSource+
  ';return makeStripPlan;})()',{
    state:{trim:10,kerf:5,boards:[],selectedRemnantIds:[]},remnantCatalog:[]
  });
const buildProductionSequence=vm.runInNewContext('(function(){'+scheduleSource+
  ';return buildProductionSequence;})()');
const buildOfflineXprgProject=vm.runInNewContext('(function(){'+exportSource+
  ';return buildOfflineXprgProject;})()',{
    fileName:s=>String(s).replace(/[^A-Za-z0-9_-]+/g,'_')
  });
function part(a,b,qty=3,thickness=38){
  return {part:{id:'part-'+a+'-'+b,name:'Alkatrész'},
    furniture:{name:'Bútor',materialColor:'Fehér'},qty,a,b,
    originalA:a,originalB:b,thickness,materialColor:'Fehér',
    edge:'0-0',edgeThickness:2,mill:false,millDepth:0,rot:false};
}
function generated(row,feed='auto',trim=10){
  const solver=vm.runInNewContext('(function(){'+nestingSource+
    ';return makeStripPlan;})()',{
      state:{trim,kerf:5,boards:[],selectedRemnantIds:[]},remnantCatalog:[]
    });
  const plan=solver(0,{rows:[row],errors:[],total:row.qty},feed);
  assert.equal(plan.failed.length,0,'Az alkatrésznek fel kell férnie.');
  assert.equal(plan.bins.length,1,'Csak egy táblát várok.');
  buildProductionSequence(plan.bins);
  const bin=plan.bins[0];
  const project=buildOfflineXprgProject([bin],'Teszt','Fehér',5,'03/11/2026');
  const xml=project.files.find(([name])=>name.endsWith('.xPrg'))[1];
  const commands=Array.from(xml.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)"/g),
    m=>({type:m[1],dim:Number(m[2])}));
  return {bin,xml,commands};
}
// Kizárólag a munkalap: P → RY → Y/F, teljes gyári vagy saját szélességgel.
// A gépen korábban hibás Swap=0, Larghezza=4100 változatot
// kizárólag az új kísérleti Swap=1 megoldás váltja fel.
for(const width of [600,900]){
  test('38 mm munkalap '+width+': a szimuláció szerinti P/RY/Y/F export',()=>{
    const {bin,xml,commands}=generated(part(1000,width));
    const physical=bin.cuts.slice().sort((a,b)=>a.order-b.order);
    assert.equal(bin.machine.feed,'x');
    assert.equal(bin.machine.topAligned,true);
    assert.equal(bin.machine.strips.length,1);
    assert.equal(bin.machine.strips[0].width,width);
    assert.equal(bin.worktopEdgeTrim,10);
    assert.match(xml,new RegExp('Lunghezza="'+width+'[.]00" Larghezza="4100[.]00"'));
    assert.match(xml,/Swap="1"/);
    assert.deepEqual(Array.from(commands,c=>c.type),['P','RY','Y','F','Y','F','Y','F']);
    assert.equal(commands[0].dim,width);
    assert.equal(commands[1].dim,Number((4100-physical[0].x1).toFixed(2)));
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='Y'),c=>c.dim),[1000,1000,1000]);
    assert.equal(commands.filter(c=>c.type==='F').length,3);
    assert.ok(physical.every(c=>(
      c.stage==='cross'||c.stage==='cross-head-trim')&&c.axis==='y'&&c.length===width));
    assert.doesNotMatch(xml,/<Cut T="(?:RX|X|U)"/);
  });
}
test('a tulajdonossal egyeztetett 2 × 964 × 600-as szabási minta pontos parancssora',()=>{
  const {bin,xml,commands}=generated(part(964,600,2),'auto',12);
  assert.equal(bin.a,4100);assert.equal(bin.b,600);
  assert.deepEqual(Array.from(bin.cuts,c=>c.x1),[1952.5,983.5,14.5]);
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',600],['RY',2147.5],
    ['Y',964],['F',0],['Y',964],['F',0]
  ]);
  assert.match(xml,/Lunghezza="600[.]00" Larghezza="4100[.]00"/);
  assert.match(xml,/Swap="1"/);
  assert.doesNotMatch(xml,/<Cut T="(?:RX|X|U)"/);
});
test('999 × 600 munkalapnál az eredeti két vágás helye és sorrendje megmarad',()=>{
  const {bin,xml,commands}=generated(part(999,600,1),'auto',12);
  assert.deepEqual(Array.from(bin.cuts,c=>c.x1),[1018.5,14.5]);
  assert.match(xml,/Lunghezza="600[.]00" Larghezza="4100[.]00"/);
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',600],['RY',3081.5],['Y',999],['F',0]
  ]);
});
test('600/900 széles munkalap egyetlen 600-as darabbal, 10 mm ráhagyással',()=>{
  for(const width of [600,900]){
    const {bin,commands}=generated(part(600,width,1));
    assert.deepEqual(Array.from(commands,c=>c.type),['P','RY','Y','F']);
    assert.equal(commands[0].dim,width);
    assert.equal(commands[1].dim,3482.5);
    assert.equal(commands[2].dim,600);
    assert.equal(bin.cuts.length,2);
    assert.equal(bin.placements[0].x,15);
  }
});
test('12 és 0 mm-es szélezésnél is a valódi első maradékvágás az RY',()=>{
  for(const trim of [12,0]){
    const {bin,commands}=generated(part(600,600,1),'auto',trim);
    assert.deepEqual(Array.from(commands,c=>c.type),['P','RY','Y','F']);
    assert.equal(bin.worktopEdgeTrim,trim);
    assert.equal(commands[1].dim,Number((bin.a-bin.cuts[0].x1).toFixed(2)));
    assert.equal(commands[2].dim,600);
  }
});
test('három darab munkalapnál pontosan három Y és F, nincs elforgatás',()=>{
  const {bin,commands}=generated(part(600,600,3));
  assert.deepEqual(Array.from(commands.filter(c=>c.type==='Y'),c=>c.dim),[600,600,600]);
  assert.equal(commands.filter(c=>c.type==='F').length,3);
  assert.equal(bin.cuts.length,4);
  assert.deepEqual(Array.from(bin.placements,p=>p.x),[1225,620,15]);
  assert.doesNotMatch(commands.map(c=>c.type).join(','),/RX|X|U/);
});
test('anyagadatbázisban megadott 3600 × 700 munkalap valóban ezt az alapanyagot használja',()=>{
  const catalog=[{id:'m38',color:'Kő',thickness:38,boardA:3600,boardB:700}];
  const source=vm.runInNewContext('(function(){'+nestingSource+
    ';return {makeStripPlan,validWorktop38Stock,validWorktop38Part};})()',{
      state:{trim:12,kerf:5,boards:[],selectedRemnantIds:[]},
      remnantCatalog:[],materialCatalog:catalog
    });
  const r={...part(900,700,2),materialId:'m38',materialColor:'Kő'};
  const result=source.makeStripPlan(0,{rows:[r],errors:[],total:2},'auto');
  assert.equal(result.failed.length,0);
  assert.equal(result.bins.length,1);
  const bin=result.bins[0];
  assert.equal(bin.a,3600);assert.equal(bin.b,700);
  assert.ok(source.validWorktop38Stock({a:3600,b:700,thickness:38,materialId:'m38',materialColor:'Kő'}));
  assert.ok(source.validWorktop38Part({a:900,b:700,thickness:38,materialId:'m38',materialColor:'Kő'}));
  assert.ok(bin.cuts.every(c=>c.axis==='y'&&c.length===700));
  buildProductionSequence(result.bins);
  const xml=buildOfflineXprgProject([bin],'Teszt','Kő',5,'03/11/2026')
    .files.find(([name])=>name.endsWith('.xPrg'))[1];
  assert.match(xml,/Lunghezza="700[.]00" Larghezza="3600[.]00"/);
  assert.match(xml,/Swap="1"/);
  const program=Array.from(xml.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)"/g),
    m=>[m[1],Number(m[2])]);
  assert.deepEqual(program,[['P',700],['RY',1775.5],
    ['Y',900],['F',0],['Y',900],['F',0]]);
  assert.doesNotMatch(xml,/<Cut T="(?:RX|X|U)"/);
});
test('a normál 18 mm bútorlap gépi RY/Y/RX/X/F kódolása változatlan',()=>{
  const {bin,commands}=generated(part(964,200,3,18),'x');
  assert.equal(commands[0].type,'P');
  assert.equal(commands[1].type,'RY');
  assert.deepEqual(Array.from(commands.filter(c=>c.type==='Y'),c=>c.dim),
    Array.from(bin.machine.strips,c=>Number(c.width.toFixed(2))));
  assert.deepEqual(Array.from(commands.filter(c=>c.type==='X'),c=>c.dim),
    Array.from(bin.machine.strips.flatMap(strip=>strip.items),x=>Number(x.along.toFixed(2))));
  assert.equal(commands.filter(c=>c.type==='RX').length,bin.machine.strips.length);
});
test('alkatrész áthúzás: csak saját bútoron belül és a mentett parts[] sorrendben',()=>{
  const code=section('  function reorderPartWithinFurniture(',
    '  function reorderMaterialCatalog(');
  const state={furnitures:[
    {id:'b1',parts:[{id:'p1',name:'A'},{id:'p2',name:'B'},{id:'p3',name:'C'}]},
    {id:'b2',parts:[{id:'p4',name:'D'},{id:'p5',name:'E'}]}
  ]};
  let saves=0,edits=0;
  const reorder=vm.runInNewContext('(function(){let result=null;let notice="";'+code+
    ';return reorderPartWithinFurniture;})()',{
      state,captureVisibleFurnitureEdits:()=>{edits++;},
      saveFurnitureCustomization:()=>{saves++;return {ok:true};}
    });
  assert.equal(reorder('p1','b1','p3','b1',true),true);
  assert.deepEqual(Array.from(state.furnitures[0].parts,x=>x.id),['p2','p3','p1']);
  assert.equal(saves,1);assert.equal(edits,1);
  assert.equal(reorder('p1','b1','p4','b2',false),false,
    'másik bútorhoz áthúzva nem módosulhat a tulajdonos');
  assert.deepEqual(Array.from(state.furnitures[1].parts,x=>x.id),['p4','p5']);
  assert.equal(reorder('p3','b1','p2','b1',false),true);
  assert.deepEqual(Array.from(state.furnitures[0].parts,x=>x.id),['p3','p2','p1']);
  assert.equal(reorder('p1','b1','p1','b1',false),false);
  assert.equal(saves,2);
  assert.match(html,/class="part-sort-handle" draggable="true"/);
  assert.match(html,/data-part-sort=/);
  assert.match(html,/application\/x-gatterka-part/);
});
