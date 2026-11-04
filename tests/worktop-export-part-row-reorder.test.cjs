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
// A jóváhagyott új munkalapos KÉTMENETES próba:
// először P/RY/MINDEN Y=darabhossz; csak utána az egyes darabok
// RX=0 / X=teljes szélesség / opcionális U / F visszakérése.
// Gépen NEM hitelesített. A bútorlap korábbi exportja FIX.
for(const width of [600,900]){
  test('38 mm munkalap '+width+': minden Y az első menetben, utána RX/X/F',()=>{
    const {bin,xml,commands}=generated(part(1000,width));
    const physical=bin.cuts.slice().sort((a,b)=>a.order-b.order);
    assert.equal(bin.machine.feed,'x');
    assert.equal(bin.machine.topAligned,true);
    assert.equal(bin.machine.strips.length,1);
    assert.equal(bin.machine.strips[0].width,width);
    assert.equal(bin.worktopEdgeTrim,10);
    assert.match(xml,new RegExp('Lunghezza="'+width+'[.]00" Larghezza="4100[.]00"'));
    assert.match(xml,/Swap="1"/);
    assert.deepEqual(Array.from(commands,c=>c.type),[
      'P','RY','Y','Y','Y','RX','X','F','RX','X','F','RX','X','F']);
    assert.equal(commands[0].dim,width);
    assert.equal(commands[1].dim,Number((4100-physical[0].x1).toFixed(2)));
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='Y'),c=>c.dim),
      [1000,1000,1000]);
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='X'),c=>c.dim),
      [width,width,width]);
    assert.deepEqual(Array.from(commands.filter(c=>c.type==='RX'),c=>c.dim),
      [0,0,0]);
    assert.equal(commands.filter(c=>c.type==='F').length,3);
    assert.equal(commands.filter(c=>c.type==='U').length,0,
      'gyári szélességű kész darabnál csak egy X visszavágás van');
    assert.ok(physical.every(c=>(
      c.stage==='cross'||c.stage==='cross-head-trim')&&c.axis==='y'&&c.length===width));
  });
}
test('jóváhagyott 2 × 964 × 600 minta: először két Y, majd két RX/X/F',()=>{
  const {bin,xml,commands}=generated(part(964,600,2),'auto',12);
  assert.equal(bin.a,4100);assert.equal(bin.b,600);
  assert.deepEqual(Array.from(bin.cuts,c=>c.x1),[1952.5,983.5,14.5]);
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',600],['RY',2147.5],
    ['Y',964],['Y',964],
    ['RX',0],['X',600],['F',0],
    ['RX',0],['X',600],['F',0]
  ]);
  assert.match(xml,/Lunghezza="600[.]00" Larghezza="4100[.]00"/);
  assert.match(xml,/Swap="1"/);
  assert.doesNotMatch(xml,/<Cut T="U"/);
});
test('999 × 600 munkalapnál első valós vágás és gépi visszakérés',()=>{
  const {bin,commands}=generated(part(999,600,1),'auto',12);
  assert.deepEqual(Array.from(bin.cuts,c=>c.x1),[1018.5,14.5]);
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',600],['RY',3081.5],['Y',999],['RX',0],['X',600],['F',0]
  ]);
});
test('600 vagy 900 széles munkalap egyetlen 600 mm hosszú darabbal',()=>{
  for(const width of [600,900]){
    const {bin,commands}=generated(part(600,width,1));
    assert.deepEqual(Array.from(commands,c=>c.type),
      ['P','RY','Y','RX','X','F']);
    assert.equal(commands[0].dim,width);
    assert.equal(commands[1].dim,3482.5);
    assert.equal(commands[2].dim,600);
    assert.equal(commands[4].dim,width);
    assert.equal(bin.cuts.length,2);
    assert.equal(bin.placements[0].x,15);
  }
});
test('0 és 12 mm szélezésnél a valódi első maradékvágás az RY',()=>{
  for(const trim of [12,0]){
    const {bin,commands}=generated(part(600,600,1),'auto',trim);
    assert.deepEqual(Array.from(commands,c=>c.type),
      ['P','RY','Y','RX','X','F']);
    assert.equal(bin.worktopEdgeTrim,trim);
    assert.equal(commands[1].dim,Number((bin.a-bin.cuts[0].x1).toFixed(2)));
    assert.equal(commands[2].dim,600);
  }
});
test('550 mm-es kész szélesség: először teljes 600 mm keresztvágás, utána U=550',()=>{
  const {bin,xml,commands}=generated(part(964,550,2),'auto',12);
  assert.equal(bin.a,4100);
  assert.equal(bin.b,600);
  assert.ok(bin.cuts.some(c=>c.stage==='rip'));
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',600],['RY',2147.5],['Y',964],['Y',964],
    ['RX',0],['X',600],['U',550],['F',0],
    ['RX',0],['X',600],['U',550],['F',0]
  ]);
  assert.match(xml,/Swap="1"/);
});
test('900 mm gyári szélesség, 850 mm kész szélesség: szükséges az U',()=>{
  const {bin,commands}=generated(part(964,850,1),'auto',12);
  assert.equal(bin.b,900);
  assert.deepEqual(Array.from(commands,c=>[c.type,c.dim]),[
    ['P',900],['RY',3116.5],['Y',964],
    ['RX',0],['X',900],['U',850],['F',0]
  ]);
});
test('több alkatrész esetén az összes Y a legelső RX előtt készül',()=>{
  const {bin,commands}=generated(part(600,600,3));
  const firstRX=commands.findIndex(c=>c.type==='RX');
  assert.equal(commands.slice(0,firstRX).filter(c=>c.type==='Y').length,3);
  assert.deepEqual(Array.from(commands.filter(c=>c.type==='X'),c=>c.dim),[600,600,600]);
  assert.equal(commands.filter(c=>c.type==='F').length,3);
  assert.equal(bin.cuts.length,4);
  assert.deepEqual(Array.from(bin.placements,p=>p.x),[1225,620,15]);
});
test('egyedi 3600×750 munkalapból 2 × 900×700: P=750 és U=700',()=>{
  const catalog=[{id:'m38',color:'Kő',thickness:38,boardA:3600,boardB:750}];
  const source=vm.runInNewContext('(function(){'+nestingSource+
    ';return {makeStripPlan,validWorktop38Stock,validWorktop38Part};})()',{
      state:{trim:12,kerf:5,boards:[],selectedRemnantIds:[]},
      remnantCatalog:[],materialCatalog:catalog
    });
  const row={...part(900,700,2),materialId:'m38',materialColor:'Kő'};
  const result=source.makeStripPlan(0,{rows:[row],errors:[],total:2},'auto');
  assert.equal(result.failed.length,0);
  assert.equal(result.bins.length,1);
  const bin=result.bins[0];
  assert.equal(bin.a,3600);assert.equal(bin.b,750);
  assert.ok(source.validWorktop38Stock({
    a:3600,b:750,thickness:38,materialId:'m38',materialColor:'Kő'
  }));
  assert.ok(source.validWorktop38Part({
    a:900,b:700,thickness:38,materialId:'m38',materialColor:'Kő'
  }));
  assert.ok(bin.cuts.filter(c=>c.stage==='cross').every(c=>c.length===750));
  assert.equal(bin.cuts.filter(c=>c.stage==='rip').length,2);
  buildProductionSequence(result.bins);
  const xml=buildOfflineXprgProject([bin],'Teszt','Kő',5,'03/11/2026')
    .files.find(([name])=>name.endsWith('.xPrg'))[1];
  assert.match(xml,/Lunghezza="750[.]00" Larghezza="3600[.]00"/);
  assert.match(xml,/Swap="1"/);
  const commands=Array.from(xml.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)"/g),
    m=>[m[1],Number(m[2])]);
  assert.deepEqual(commands,[['P',750],['RY',1775.5],
    ['Y',900],['Y',900],
    ['RX',0],['X',750],['U',700],['F',0],
    ['RX',0],['X',750],['U',700],['F',0]]);
});
test('nagy munkalaplista esetén legfeljebb 99 gépi parancs egy xPrg-ben',()=>{
  const row=part(200,600,250);
  const solver=vm.runInNewContext('(function(){'+nestingSource+
    ';return makeStripPlan;})()',{
      state:{trim:10,kerf:5,boards:[],selectedRemnantIds:[]},
      remnantCatalog:[]
    });
  const result=solver(0,{rows:[row],errors:[],total:250},'auto');
  assert.equal(result.failed.length,0);
  assert.ok(result.bins.length>3);
  const project=buildOfflineXprgProject(result.bins,'Teszt','Fehér',5,'03/11/2026');
  for(const [,xml] of project.files.filter(([name])=>name.endsWith('.xPrg'))){
    const commands=xml.match(/<Cut T="/g)||[];
    assert.ok(commands.length<=99,'egy munkalap xPrg sem lehet 99 parancsnál hosszabb');
    assert.match(xml,/Swap="1"/);
  }
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
