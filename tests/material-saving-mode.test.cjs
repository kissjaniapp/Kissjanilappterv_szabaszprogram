'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function computeNesting(){');
const end=html.indexOf('\n  const colors=',begin);
assert.ok(begin>=0&&end>begin,'Hiányzik a nesting számoló');
const compute=vm.runInNewContext('('+html.slice(begin,end).trim()+')',{
  // A teszt nem módosít tényleges gépi kimenetet.
  Math,Number,Array,console
});
test('a gazdaságos üzemmód külön szerepel, a korábbi megmarad',()=>{
  assert.match(html,/value="economy"/);
  assert.match(html,/value="machine"/);
  assert.match(html,/value="auto"/);
  assert.match(html,/value="rows"/);
  assert.match(html,/value="mosaic"/);
  assert.match(html,/largestReusableArea/);
});
test('a nagy összefüggő maradékot megőrző változatot választja a gazdaságos keresés',()=>{
  const state={layoutMode:'economy',trim:10,kerf:5,cutDirection:'x'};
  let attempts=0;
  const makeStripPlan=mode=>{
    attempts++;
    const freeWidth=mode>=48?900:20;
    return {failed:[],items:[{}],usedArea:100000,
      sheetArea:2800*2070,
      bins:[{a:2800,b:2070,cuts:[],
        machine:{feedSize:2000,feedUsed:2000-freeWidth,crossSize:2750,
          strips:[{width:100,usedLength:2750}]}}]};
  };
  const ctx={state,getParts:()=>({total:1,errors:[]}),
    makeStripPlan,makePlan:()=>{throw Error('Nem gépi terv');},
    buildProductionSequence:()=>({machineExecutable:false})};
  const run=vm.runInNewContext('('+html.slice(begin,end).trim()+')',ctx);
  const result=run();
  assert.equal(attempts,96);
  assert.equal(result.layoutDescription,'Anyagtakarékos, teljes átvágásos csíkterv');
  assert.ok(result.largestReusableArea>2000000);
  assert.equal(result.production.machineExecutable,false);
});
test('a régi gépi mód továbbra is 48 próba, nem 96',()=>{
  const state={layoutMode:'machine',trim:10,kerf:5,cutDirection:'x'};
  let attempts=0;
  const run=vm.runInNewContext('('+html.slice(begin,end).trim()+')',{
    state,getParts:()=>({total:1,errors:[]}),
    makeStripPlan:()=>{attempts++;return {failed:[],items:[{}],usedArea:1,
      sheetArea:2800*2070,bins:[{a:2800,b:2070,cuts:[],
      machine:{feedSize:2000,feedUsed:1000,crossSize:2780,strips:[]}}]};},
    makePlan:()=>{throw Error('Gépi mód');},
    buildProductionSequence:()=>({machineExecutable:false}),
    Math,Array,Number
  });
  run();
  assert.equal(attempts,48);
});
