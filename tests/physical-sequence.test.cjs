'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('  const STANDARD_BOARD=');
const end=html.indexOf('  // Gyártási sorrend:',begin);
const makeStripPlan=vm.runInNewContext('(function(){'+String.fromCharCode(10)+html.slice(begin,end)+String.fromCharCode(10)+'return makeStripPlan;'+String.fromCharCode(10)+'})()',{
  state:{trim:12,kerf:5,boards:[{id:'tabla',name:'Feya',a:2070,b:2800,thickness:18,qty:1}]}
});
const scheduleStart=html.indexOf('function buildProductionSequence(bins){');
const scheduleEnd=html.indexOf('function computeNesting(){',scheduleStart);
const schedule=vm.runInNewContext('('+html.slice(scheduleStart,scheduleEnd)+')');
function plan(){
  const parts={errors:[],total:3,rows:[{part:{id:'A',name:'Elem'},furniture:{name:'Feya',materialColor:'Feya'},qty:3,a:964,b:200,originalA:964,originalB:200,thickness:18,rot:false,edge:'0-0',edgeThickness:2,mill:false}]};
  return makeStripPlan(0,parts,'x');
}
const at=c=>c.axis==='y'?c.x1:c.y1;
test('2800 mm-ről indul: szélezés 2788, két 200-as csík 2583 és 2378',()=>{
  const result=plan();assert.equal(result.failed.length,0);assert.equal(result.bins.length,1);
  const board=result.bins[0];
  assert.deepEqual(Array.from(board.machine.strips,x=>x.items.length),[2,1]);
  assert.deepEqual(Array.from(board.cuts.filter(c=>['head-trim','strip'].includes(c.stage)),at),[2788,2583,2378]);
  assert.deepEqual(Array.from(board.cuts.filter(c=>c.stripIndex===1&&['cross-head-trim','cross'].includes(c.stage)),at),[2058,1089,120]);
  assert.deepEqual(Array.from(board.cuts.filter(c=>c.stripIndex===2&&['cross-head-trim','cross'].includes(c.stage)),at),[2058,1089]);
});
test('a gyártási számozás valóban a gép visszafelé vágó sorrendjét követi',()=>{
  const board=plan().bins[0];const out=schedule([board]);assert.equal(out.totalCuts,8);
  const cuts=Array.from(board.cuts).sort((a,b)=>a.boardOrder-b.boardOrder);
  assert.deepEqual(cuts.map(at),[2788,2583,2378,2058,1089,120,2058,1089]);
  assert.deepEqual(cuts.map(c=>c.boardOrder),[1,2,3,4,5,6,7,8]);
  assert.equal(out.machineExecutable,false);
});
test('a gazdaságos módban is elérhető az ellenőrző projekt export',()=>{
  assert.ok(html.includes("['machine','economy'].includes(state.layoutMode)"));
  assert.ok(!html.includes('const cutOrderPanel='));
  assert.ok(html.includes('kerf:5,trim:12,cutDirection'));
  assert.ok(html.includes('class="label">Anyagigény</div>'));

});
