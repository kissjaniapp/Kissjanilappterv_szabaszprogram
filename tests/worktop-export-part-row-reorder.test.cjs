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
for(const width of [600,900]){
  test('38 mm munkalap '+width+': ugyanaz a kétmenetes P/RY/Y/RX/X/F mint bútorlapnál',()=>{
    const {bin,xml,commands}=generated(part(1000,width));
    const strip=bin.machine.strips[0];
    assert.equal(strip.width,width);
    assert.equal(bin.worktopEdgeTrim,10);
    assert.equal(bin.machine.topAligned,true);
    assert.equal(bin.machine.feed,'x','a vágási gépállás FIX, nem változtatjuk meg az export miatt');
    assert.equal(strip.firstCutRule,'top-aligned-bottom');
    assert.match(xml,new RegExp('Lunghezza="4100[.]00" Larghezza="'+width+'[.]00"'));
    assert.deepEqual(Array.from(commands,c=>c.type),
      ['P','RY','Y','RX','X','F','X','F','X','F'],
      'a munkalap sem kaphat külön RY/Y algoritmust');
    assert.equal(commands[0].dim,4100,'a munkalap P mérete is a bútorlap feed=x tájolásához igazodik');
    assert.equal(commands[1].dim,0,'a gyári 600/900 mm szélesség szélezés nélküli');
    assert.equal(commands[2].dim,width,'az Y a munkalap változatlan teljes szélessége');
    assert.equal(commands[3].dim,Number(strip.firstTrimDistance.toFixed(2)),
      'a visszaforgatott csík alsó első vágása az RX');
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='X'),c=>c.dim),
      [1000,1000,1000],'a második menetben készméretes X darabolás');
    assert.equal(commands.filter(c=>c.type==='F').length,3);
    assert.equal(bin.cuts.filter(c=>c.stage==='cross-head-trim').length,1);
    assert.equal(bin.cuts.filter(c=>c.stage==='cross').length,3);
    assert.ok(bin.cuts.every(c=>c.axis==='y'&&c.length===width));
    assert.ok(!commands.some(c=>c.type==='U'));
    assert.ok(!bin.cuts.some(c=>c.stage==='strip'||c.stage==='rip'));
    assert.equal(commands.length,bin.machine.commandCount);
  });
}
test('600 mm munkalapdarab: a gép bútorlapos csíkozás + visszaforgatott X parancsaival dolgozik',()=>{
  for(const width of [600,900]){
    const {bin,commands}=generated(part(600,width,1));
    assert.deepEqual(Array.from(commands,c=>c.type),['P','RY','Y','RX','X','F']);
    assert.equal(commands[0].dim,4100,'a munkalap P mérete is a bútorlap feed=x tájolásához igazodik');
    assert.equal(commands[1].dim,0);
    assert.equal(commands[2].dim,width);
    assert.equal(commands[3].dim,3482.5);
    assert.equal(commands[4].dim,600);
    assert.equal(bin.cuts.length,2);
    assert.equal(bin.cuts[0].stage,'cross-head-trim');
    assert.equal(bin.cuts[1].stage,'cross');
    assert.equal(bin.cuts[0].x1-bin.cuts[1].x1,605);
    assert.equal(bin.placements[0].w,600);
    assert.equal(bin.placements[0].x,15,'a 10 mm végszélezés és 5 mm rés a kész darabon kívül van');
  }
});
test('12 mm szélezés csak a munkalap végszélezésében szerepel, teljes szélessége megmarad',()=>{
  const {bin,commands}=generated(part(600,600,1),'auto',12);
  assert.equal(bin.worktopEdgeTrim,12);
  assert.equal(bin.trim,0);
  assert.equal(commands[0].dim,4100);
  assert.equal(commands[1].dim,0);
  assert.equal(commands[2].dim,600);
  assert.equal(commands[3].dim,3480.5);
  assert.equal(commands[4].dim,600);
  assert.equal(bin.placements[0].x,17);
});
test('0 mm szélezés: nincs kitalált munkalap-specifikus Y darabolás',()=>{
  const {bin,commands}=generated(part(600,600,1),'auto',0);
  assert.deepEqual(Array.from(commands,c=>c.type),['P','RY','Y','RX','X','F']);
  assert.equal(bin.worktopEdgeTrim,0);
  assert.equal(bin.placements[0].x,5);
  assert.equal(bin.cuts.length,2);
});
test('több azonos munkalap-alkatrész: minden X készméret külön szerepel',()=>{
  const {bin,commands}=generated(part(600,600,3));
  assert.deepEqual(Array.from(commands.filter(c=>c.type==='X'),c=>c.dim),[600,600,600]);
  assert.equal(bin.cuts.length,4);
  assert.deepEqual(Array.from(bin.placements,p=>p.x),[1225,620,15]);
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
