'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('  const STANDARD_BOARD=');
const b=html.indexOf('  // Gyártási sorrend:',a);
assert.ok(a>=0&&b>a,'Nem található a gépi csíkkiosztó algoritmus');
const state={trim:10,kerf:5,boards:[]};
const pack=vm.runInNewContext('(function(){\n'+html.slice(a,b)+'\nreturn makeStripPlan;\n})()', {state});

function row(name,aa,bb,qty){
  return {part:{name,id:name},furniture:{name:'Konyha',materialColor:'Feya',
    destination:'Rendelés'},qty,a:aa,b:bb,originalA:aa,originalB:bb,
    thickness:18,rot:false,edge:'0-0',edgeThickness:2,mill:false};
}
function model(){
  // A referenciaábrához hasonló probléma: 8 keskeny élanyag egy 964 mm
  // széles csíkot foglal el, a maradék hosszába még 5 db 564x204-es fenék fér.
  return {rows:[
    row('él',964,98,8),
    row('fenék',564,204,5),
    row('tető',480,502,1)
  ],errors:[],total:14};
}
function validateNoOverlap(plan){
  for(const bin of plan.bins){
    assert.equal(bin.placements.length,bin.machine.strips.reduce((n,s)=>n+s.items.length,0));
    for(let i=0;i<bin.placements.length;i++)for(let j=i+1;j<bin.placements.length;j++){
      const p=bin.placements[i],q=bin.placements[j];
      const overlapping=p.x<q.x+q.realW-0.0001&&q.x<p.x+p.realW-0.0001&&
        p.y<q.y+q.realH-0.0001&&q.y<p.y+p.realH-0.0001;
      assert.ok(!overlapping,'Két alkatrész ütközik: '+p.part.name+' és '+q.part.name);
    }
  }
}
test('a meglévő 964 mm-es csík szabad hosszába kerülnek a fenék alkatrészek',()=>{
  const before=pack(0,model(),'y');
  const improved=pack(42,model(),'y');
  assert.equal(before.failed.length,0);
  assert.equal(improved.failed.length,0);
  assert.equal(improved.bins.length,1);
  assert.equal(improved.bins[0].placements.length,14);
  assert.ok(improved.bins[0].machine.strips.length<=before.bins[0].machine.strips.length,
    'A javított stratégia több csíkot használ.');
  const firstStrip=improved.bins[0].machine.strips[0];
  assert.equal(firstStrip.items.filter(p=>p.item.name==='él').length,8);
  assert.equal(firstStrip.items.filter(p=>p.item.name==='fenék').length,5);
  assert.ok(improved.bins[0].machine.feedUsed<before.bins[0].machine.feedUsed);
  validateNoOverlap(improved);
});
test('tábla, szálirány, kerf és alkatrészpozíciók konzisztensen megmaradnak',()=>{
  for(const mode of [0,6,12,18,24,30,36,42]){
    const result=pack(mode,model(),'y');
    assert.equal(result.failed.length,0,'Nem fért fel a munkadarab a '+mode+'. módban');
    assert.ok(result.bins.length>=1);
    assert.equal(result.bins.reduce((n,bin)=>n+bin.placements.length,0),14);
    for(const bin of result.bins){
      for(const p of bin.placements){
        assert.ok(p.x>=-0.001&&p.y>=-0.001);
        assert.ok(p.x+p.realW<=bin.a+0.001&&p.y+p.realH<=bin.b+0.001);
        assert.equal(p.turned,false,'Szálirány-kötött alkatrész megfordult');
      }
    }
    validateNoOverlap(result);
  }
});
