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
    assert.equal(bin.placements.length,bin.machine.strips.reduce((n,s)=>n+s.items.reduce((count,entry)=>count+(entry.lanes?entry.lanes.reduce((n,lane)=>n+lane.items.length,0):1),0),0));
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

test('Helykitöltő: az első csík szabad helyére későbbi, beférő darabot választ',()=>{
 const parts={rows:[row('Nagy',1800,600,1),row('Közepes',1200,600,1),
  row('Kitöltő',900,400,1)],errors:[],total:3};
 const previous=state.layoutMode;state.layoutMode='fill';
 try{
  const result=pack(0,parts,'x');
  assert.equal(result.failed.length,0);
  assert.equal(result.bins.length,1);
  const strips=result.bins[0].machine.strips;
  assert.deepEqual(Array.from(strips[0].items,p=>p.item.name),['Nagy','Kitöltő']);
  assert.equal(strips[1].items[0].item.name,'Közepes');
  validateNoOverlap(result);
 }finally{state.layoutMode=previous;}
});
test('Helykitöltő: minden darab pontosan egyszer, szálirány és vágásrés megtartva',()=>{
 const previous=state.layoutMode;state.layoutMode='fill';
 try{
  for(const axis of ['x','y','auto'])for(const mode of [0,6,12,24,42]){
   const result=pack(mode,model(),axis);
   assert.equal(result.failed.length,0);
   const placements=result.bins.flatMap(b=>b.placements);
   assert.equal(placements.length,14);
   assert.equal(placements.filter(p=>p.part.name==='él').length,8);
   assert.equal(placements.filter(p=>p.part.name==='fenék').length,5);
   for(const bin of result.bins)for(const p of bin.placements){
    assert.equal(p.turned,false);
    assert.ok(p.x>=0&&p.y>=0&&p.x+p.realW<=bin.a+.001&&p.y+p.realH<=bin.b+.001);
   }
   validateNoOverlap(result);
  }
 }finally{state.layoutMode=previous;}
});

test('Helykitöltő minden sort a legnagyobbal kezd és a legnagyobb beférővel tölt fel',()=>{
 const previous=state.layoutMode;state.layoutMode='fill';
 try{
  const parts={rows:[row('Első',1800,600,1),row('Második',1600,550,1),
   row('Harmadik',1400,500,1),row('Kitöltő A',900,400,1),
   row('Kitöltő B',1000,300,1),row('Kitöltő C',1100,250,1)],total:6,errors:[]};
  for(const mode of [0,1,2,3,4,5,42]){
   const plan=pack(mode,parts,'x');
   assert.equal(plan.failed.length,0);assert.equal(plan.bins.length,1);
   assert.deepEqual(Array.from(plan.bins[0].machine.strips,st=>Array.from(st.items,p=>p.item.name)),
    [['Első','Kitöltő A'],['Második','Kitöltő B'],['Harmadik','Kitöltő C']]);
   validateNoOverlap(plan);
  }
 }finally{state.layoutMode=previous;}
});
test('Helykitöltő kezdődarabja terület szerinti legnagyobb, nem a legszélesebb',()=>{
 const previous=state.layoutMode;state.layoutMode='fill';
 try{
  const parts={rows:[row('Nagy terület',1000,800,1),row('Széles kisebb',500,1200,1)],total:2,errors:[]};
  for(const mode of [0,1,2,3,4,5]){
   const plan=pack(mode,parts,'x');
   assert.equal(plan.bins[0].machine.strips[0].items[0].item.name,'Nagy terület');
   assert.equal(plan.bins.flatMap(b=>b.placements).length,2);
   validateNoOverlap(plan);
  }
 }finally{state.layoutMode=previous;}
});
