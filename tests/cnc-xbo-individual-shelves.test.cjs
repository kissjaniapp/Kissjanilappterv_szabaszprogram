'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const auto=require('../machine/cnc-auto.cjs'),core=require('../machine/cnc-xxl.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const packed=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(packed,'A beágyazott Gatterka-bútortervező hiányzik');
const html=JSON.parse(packed[1]);
const first=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
assert.ok(first);
const start=first.indexOf('function cncSupportRegions(p,boards,which){'),
  end=first.indexOf('function getStructuredParts(p){',start);
assert.ok(start>=0&&end>start);
function setup(boards){
 const context={fixedDividerPieces:()=>boards,baseShelfBack:()=>4};
 vm.createContext(context);vm.runInContext(first.slice(start,end),context);return context;
}
function cabinet(overrides={}){
 return {w:1000,h:1500,d:450,t:18,n:1,holes:3,raster:32,supportInset:50,
  drilling:'local',distribution:'manual',hasTop:true,hasBottom:true,
  top:'between',bottom:'between',innerW:964,innerH:1464,
  bodyBottomOffset:0,sideH:1500,front:0,backType:'none',rabbet:false,
  fullBack:false,fullBackSetback:0,cncGapBottom:0,cncGapTop:0,cncGapDivider:0,
  ...overrides};
}
function shelf(z1=600,extra={}){
 return {kind:'shelf',index:0,key:'shelf-1',name:'Polc 1',x1:18,x2:982,
  y0:10,y1:390,z1,z2:z1+18,a:964,b:380,angle:0,undercutDegrees:0,...extra};
}
function records(){return [
 {key:'side-left',sourceKeys:['side-left','side-right']},{key:'shelf-1'}];
}
test('Egyedi polc: két XBO sor oldalanként a pontos rajzi 59/eltolás helyén',()=>{
 const board=shelf(),p=cabinet(),ctx=setup([board]),r=records();
 ctx.buildCncInstancesForParts(p,r);
 const [left,right]=r[0].cncInstances;
 for(const side of [left,right]){
  const xbo=side.operations.filter(o=>o.macro==='XBO');
  assert.equal(xbo.length,2);
  assert.deepEqual(Array.from(xbo.map(o=>o.Y)),[60,340]);
  assert.equal(xbo[0].X,565.5,'az alsó CNC nullponttól a legalsó furatig');
  assert.equal(xbo[0].R,3);assert.equal(xbo[0].x,32);
  assert.deepEqual(Array.from(xbo.map(o=>[o.z,o.V,o.y,o.D,o.N,o.F])),
   [[13,1,0,5,'P',1],[13,1,0,5,'P',1]]);
  assert.equal(side.operations.some(o=>o.macro==='REF'||o.macro==='POLC'),false);
  const generated=auto.compileEntry(side,{assemblyJoint:'excenter'});
  assert.match(generated,/XBO X=565\.5 Y=60 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1/);
  assert.match(generated,/XBO X=565\.5 Y=340 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1/);
 }
 const coord=ctx.cncShelfHoleGroup(p,board);
 assert.equal(coord.bottom,565.5,'polc alja − 2.5 − 32');
 assert.equal(coord.top,629.5);
});
test('A Gatterka furatszám és raszter felülírja az XBO 3/32 mintáját',()=>{
 const p=cabinet({holes:5,raster:40}),ctx=setup([shelf()]),r=records();
 ctx.buildCncInstancesForParts(p,r);
 const xbo=r[0].cncInstances[0].operations.filter(q=>q.macro==='XBO');
 assert.equal(xbo.length,2);
 assert.equal(xbo[0].R,5);assert.equal(xbo[0].x,40);
 assert.equal(xbo[0].X,517.5);
 assert.match(auto.compileEntry(r[0].cncInstances[0]),/XBO X=517\.5 Y=60 z=13 V=1 R=5 x=40 y=0 D=5 N=P F=1/);
});
test('Végig furatsor: a korábbi REF/POLC páros tovább él, nem keletkezik XBO',()=>{
 const p=cabinet({drilling:'full',distribution:'equal'}),ctx=setup([shelf()]),r=records();
 ctx.buildCncInstancesForParts(p,r);
 const left=r[0].cncInstances[0],macros=left.operations.map(q=>q.macro);
 assert.equal(macros.filter(s=>s==='XBO').length,0);
 assert.equal(macros.filter(s=>s==='REF').length,2);
 assert.equal(macros.filter(s=>s==='POLC').length,2);
 assert.match(auto.compileEntry(left),/POLC Y=/);
});
test('A csak beállítható, nem egyenlő polcköz is kap XBO-t, nincs POLC Q hiba',()=>{
 const p=cabinet({distribution:'manual'}),ctx=setup([shelf(731)]),r=records();
 ctx.buildCncInstancesForParts(p,r);
 const left=r[0].cncInstances[0];
 assert.equal(left.issues.length,0);
 assert.equal(left.operations.filter(op=>op.macro==='XBO').length,2);
 assert.equal(left.operations.find(op=>op.macro==='XBO').X,696.5);
});
test('Külön első/hátsó polcvisszaállásból származik az XBO Y',()=>{
 const p=cabinet(),ctx=setup([shelf(600,{y0:35,y1:355})]),r=records();
 ctx.buildCncInstancesForParts(p,r);
 const ops=r[0].cncInstances[0].operations.filter(op=>op.macro==='XBO');
 assert.deepEqual(Array.from(ops,o=>o.Y),[85,305]);
});
test('Érvénytelen furatmagasság, túl kicsi polcmélység és V-osztó ütközés tiltva',()=>{
 const cases=[
  [shelf(30),[],/túllépné/],
  [shelf(600,{y0:190,y1:240}),[],/furatsora/],
  [shelf(600),[{kind:'v',x1:18,x2:982,z1:592,z2:610}],/V-osztó/]
 ];
 for(const [s,extra,msg] of cases){
  const p=cabinet(),ctx=setup([s,...extra]),r=records();
  ctx.buildCncInstancesForParts(p,r);
  assert.match(r[0].cncInstances[0].issues.join(' '),msg);
  assert.throws(()=>auto.compileEntry(r[0].cncInstances[0]));
 }
});
test('XBO szigorú X/Y/Z/R/X-raszter határellenőrzés',()=>{
 const spec={dx:1500,dy:450,dz:18,side:'IJ'};
 const good='XBO X=870.5 Y=60 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1';
 assert.match(core.compileXxl({...spec,commands:good}),/XBO X=870\.5 Y=60 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1/);
 for(const bad of [
  good.replace('X=870.5','X=1470'),
  good.replace('Y=60','Y=451'),
  good.replace('R=3','R=0'),
  good.replace('x=32','x=0'),
  good.replace('z=13','z=14'),
  good.replace('N=P','N=Q'),
  good.replace('D=5','D=6'),
  good.replace('V=1','V=2'),
  good.replace(' F=1',''),
  good+' F=1'
 ])assert.throws(()=>core.compileXxl({...spec,commands:bad}),/XBO/);
 assert.throws(()=>core.compileXxl({...spec,dz:12,commands:good}),/XBO/);
});
test('Windows beágyazott és gépi CNC-fordítók szövege azonos',()=>{
 for(const [name,file] of [['GatterkaCnc=api','cnc-xxl.cjs'],['GatterkaCncAuto=api','cnc-auto.cjs']]){
  const pos=source.indexOf(name),a=source.lastIndexOf('<script>',pos),b=source.indexOf('</script>',pos);
  assert.ok(pos>0&&a>0&&b>pos);
  assert.equal(source.slice(a+'<script>'.length,b).trim(),
   fs.readFileSync(path.join(__dirname,'../machine/',file),'utf8').trim());
 }
});
test('Az oldalnézet az XBO-val közös furatcsoport-geometriát rajzolja',()=>{
 const draw=first.slice(first.indexOf('function drawing(p,levels){'),first.indexOf('let viewYaw=',first.indexOf('function drawing(p,levels){')));
 assert.match(draw,/const group=cncShelfHoleGroup\(p,shelf\)/);
 assert.match(draw,/height=group\.bottom\+j\*group\.step/);
 assert.match(draw,/group\.Y\[0\]/);
 assert.match(draw,/group\.Y\[1\]/);
});
