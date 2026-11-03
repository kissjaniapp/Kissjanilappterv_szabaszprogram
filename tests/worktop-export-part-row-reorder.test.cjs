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
function generated(row,feed='auto'){
  const plan=makeStripPlan(0,{rows:[row],errors:[],total:row.qty},feed);
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
  test('38 mm munkalap '+width+': a térkép valódi keresztvágásai mennek az XPRG-be',()=>{
    const {bin,xml,commands}=generated(part(1000,width));
    const physical=bin.cuts.filter(c=>c.stage==='cross-head-trim'||c.stage==='cross');
    const cross=physical.filter(c=>c.stage==='cross');
    const first=physical.find(c=>c.stage==='cross-head-trim');
    assert.ok(first,'az alsó, 1. munkalapvágás szerepel');
    assert.equal(bin.machine.strips.length,1);
    assert.match(xml,new RegExp('Lunghezza="'+width+'[.]00" Larghezza="4100[.]00"'));
    assert.equal(commands[0].type,'P');
    assert.equal(commands[0].dim,width);
    assert.equal(commands[1].type,'RY');
    assert.equal(commands[1].dim,Number(bin.machine.strips[0].firstTrimDistance.toFixed(2)));
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='Y'),c=>c.dim),
      Array.from(cross,c=>Number(c.pieceSize.toFixed(2))),
      'egy Y parancs pontosan egy tényleges rajzi CROSS vágás');
    assert.equal(commands.filter(c=>c.type==='Y').length+Number(!!first),physical.length);
    assert.equal(commands.filter(c=>c.type==='F').length,3);
    assert.ok(commands.every(c=>['P','RY','Y','F'].includes(c.type)),
      'munkalapnál nem lehet képzeletbeli RX/X/U vagy külön Y csíkvágás');
  });
}
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
