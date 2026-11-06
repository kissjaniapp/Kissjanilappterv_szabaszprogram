'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');

test('Anyagadatbázis gomb a bútorválasztóból is megnyitható',()=>{
  const start=html.indexOf('function projectLibraryView(){');
  const end=html.indexOf('function showNotice(',start);
  assert.match(html.slice(start,end),/data-action="materials-page"/);
  assert.match(html,/projectScreen==='library'&&state\.active!=='materials'/);
});

test('A 3MF import hibás mélységértéke nem írja felül a katalógus vastagságát',()=>{
  const start=html.indexOf('  function materialForPart(');
  const end=html.indexOf('  function materialOptions(',start);
  const fn=vm.runInNewContext('('+html.slice(start,end).trim()+')',{
    materialCatalog:[{id:'lap18',color:'Freya',thickness:18},{id:'rtg12',color:'RTG',thickness:12}]
  });
  assert.equal(fn({threeMfGenerated:true,threeMfThickness:117.2},{t:18,materialColor:'Freya'}).thickness,18);
  assert.equal(fn({threeMfGenerated:true,threeMfThickness:117.2},{t:18,materialColor:'Freya',materialId:'lap18'}).thickness,18);
  assert.equal(fn({threeMfGenerated:true,threeMfThickness:12},{t:18,materialColor:'RTG'}).thickness,12);
});

test('Katalógusos 12/15/36 mm bútorlapokhoz korlátlan automatikus nagytábla nyitható',()=>{
  const start=html.indexOf('  const STANDARD_BOARD=');
  const end=html.indexOf('  // Gyártási sorrend:',start);
  const state={trim:12,kerf:5,boards:[],selectedRemnantIds:[]};
  const materialCatalog=[
    {id:'rtg12',color:'RTG',thickness:12,boardA:'',boardB:''},
    {id:'hexa15',color:'Hexa',thickness:15,boardA:'',boardB:''},
    {id:'vastag36',color:'Freya',thickness:36,boardA:3000,boardB:2000}
  ];
  const makeStripPlan=vm.runInNewContext('(function(){'+html.slice(start,end)+';return makeStripPlan;})()',{
    state,remnantCatalog:[],materialCatalog,Math,Number,String
  });
  const rows=materialCatalog.map((m,i)=>({
    part:{id:'p'+i,name:'P'+i},furniture:{name:'Bútor',materialColor:m.color},
    qty:1,a:900,b:200,originalA:900,originalB:200,thickness:m.thickness,
    materialColor:m.color,rot:false,edge:'0-0',edgeThickness:2,mill:false,millDepth:0
  }));
  const out=makeStripPlan(0,{rows,total:rows.length,errors:[]},'auto');
  assert.equal(out.failed.length,0);
  assert.ok(out.bins.some(x=>x.thickness===12&&x.a===2800&&x.b===2070&&x.automatic));
  assert.ok(out.bins.some(x=>x.thickness===15&&x.a===2800&&x.b===2070&&x.automatic));
  assert.ok(out.bins.some(x=>x.thickness===36&&x.a===3000&&x.b===2000&&x.automatic));
});
