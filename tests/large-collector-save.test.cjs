'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('  function computeNesting(){');
const end=html.indexOf('  const colors=',start);
assert.ok(start>0&&end>start,'A szabásterv számítója hiányzik');
const code=html.slice(start,end);
function largePlan(total){
  let tries=0;
  const state={kerf:5,trim:12,layoutMode:'machine',cutDirection:'auto',selectedRemnantIds:[]};
  const ctx={
    state,getParts:()=>({rows:[{qty:total,thickness:18,materialColor:'Freya'}],total,errors:[]}),
    remnantCatalog:[],Number,Math,
    makeStripPlan:()=>{
      tries++;
      return {bins:[{a:2800,b:2070,thickness:18,materialColor:'Freya',
        machine:{feed:'x',strips:[{width:100,usedLength:100,items:[]}]},
        placements:[{id:1}],cuts:[]}],failed:[],usedArea:100000,
        sheetArea:2800*2070,items:Array.from({length:total},(_,i)=>i)};
    },
    buildProductionSequence:()=>({ok:true})
  };
  const compute=vm.runInNewContext('(function(){'+code+';return computeNesting;})()',ctx);
  return {result:compute(),tries};
}
test('a 700 alkatrészes mesterséges projektlimit megszűnt',()=>{
  for(const n of [701,800,1500,2100]){
    const {result,tries}=largePlan(n);
    assert.ok(!result.error,'Nem szabható mesterséges 700-as limit: '+result.error);
    assert.equal(result.items.length,n);
    assert.ok(tries>0&&tries<=8,'Nagy munkán is kezelhető próbaszám kell');
  }
});
test('a 99 parancsos fizikai gépi határ nem módosult',()=>{
  assert.match(html,/const MAX_SAFE_XPRG_COMMANDS=99/);
  assert.match(html,/if\(cuts\.length>99\)/);
});
