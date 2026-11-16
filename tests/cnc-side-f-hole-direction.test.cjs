'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const auto=require('../machine/cnc-auto.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const packed=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(packed,'Hiányzik a bútorszerkesztő');
const html=JSON.parse(packed[1]);
const snippet=html.slice(html.indexOf('function cncSupportRegions(p,boards,which){'),
 html.indexOf('function getStructuredParts(p){'));
function cabinet(drilling='local'){
 return {w:1000,h:1500,d:450,t:18,sideH:1500,innerW:964,bodyBottomOffset:0,
  hasTop:true,hasBottom:true,top:'between',bottom:'between',drilling,
  holes:3,raster:32,supportInset:50,front:0,rabbet:false,hasLegs:false,
  falseBottom:false,fCount:1,n:2};
}
function fixture(){
 const f={kind:'f',key:'f-divider-1',name:'F-osztó 1',index:0,
  x1:491,x2:509,y0:0,y1:450,z1:18,z2:1482,a:1464,b:450};
 const shelf=(key,z,x1,x2)=>({kind:'shelf',key,name:key,index:z,
   x1,x2,y0:10,y1:390,z1:z,z2:z+18,a:x2-x1,b:380,
   angle:0,undercutDegrees:0});
 return [f,
  shelf('bal-lent',240,18,491),shelf('bal-fent',1100,18,491),
  shelf('jobb-lent',240,509,982),shelf('jobb-fent',1100,509,982)];
}
function generate(drilling='local'){
 const boards=fixture(),context={fixedDividerPieces:()=>boards,baseShelfBack:()=>0};
 vm.createContext(context);vm.runInContext(snippet,context);
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
  {key:'f-divider-1'},{key:'top'},{key:'bottom'}];
 context.buildCncInstancesForParts(cabinet(drilling),records);
 return Object.fromEntries(records.flatMap(record=>record.cncInstances||[])
   .map(entry=>[entry.key,entry]));
}
test('Oldallapok XBO: a felső nullpont miatt a magas polc X-e kisebb, nem tükröződik',()=>{
 const x=generate();
 for(const side of ['side-left','side-right']){
  const entry=x[side],holes=entry.operations.filter(op=>op.macro==='XBO');
  assert.deepEqual(Array.from(holes,op=>op.X),[1230.5,1230.5,370.5,370.5]);
  assert.deepEqual(Array.from(holes,op=>op.Y),[60,340,60,340]);
  assert.ok(holes.every(op=>op.R===3&&op.x===32));
  assert.ok(entry.operations.some(op=>op.macro==='LAPA'&&op.X===9));
  assert.ok(entry.operations.some(op=>op.macro==='LAPA'&&op.X===1491));
  assert.match(auto.compileEntry(entry),/XBO X=370\.5 Y=60/);
 }
 assert.equal(x['side-left'].side,'LK');
 assert.equal(x['side-right'].side,'IJ');
});
test('F-osztó XBO: az alsó X=0 origóból felfelé, elölről mért Y mindkét lapon',()=>{
 const e=generate()['f-divider-1'];
 assert.deepEqual(Array.from(e.issues),[]);
 const primary=e.operations.filter(o=>o.macro==='XBO'&&o.face==='primary');
 const reverse=e.operations.filter(o=>o.macro==='XBO'&&o.face==='reverse');
 assert.deepEqual(Array.from(primary,op=>op.X),[187.5,187.5,1047.5,1047.5]);
 assert.deepEqual(Array.from(reverse,op=>op.X),[187.5,187.5,1047.5,1047.5]);
 assert.ok(primary.every(op=>op.Y===60||op.Y===340));
 const code=auto.compileEntry(e);
 assert.ok(code.includes('XMSG Q=1 N="FORDIT"'));
 assert.match(code,/XBO X=187\.5 Y=60/);
 assert.match(code,/XBO X=1047\.5 Y=340/);
});
test('F-osztó fix polc LAPA iránya és két élének makrója az ALSÓ origó szerint készül',()=>{
 const e=generate('fixed')['f-divider-1'];
 assert.deepEqual(Array.from(e.operations.filter(op=>op.macro==='LAPA'),op=>op.X),[
  231,1091,231,1091]);
 assert.ok(e.operations.some(op=>op.macro==='ELF2'));
 assert.ok(e.operations.some(op=>op.macro==='ELF3'));
 assert.ok(e.operations.filter(op=>op.macro==='LAPA').some(op=>op.face==='reverse'));
});
test('Teljes polcfuratsor XBO: a saját lap hosszából számolt sor',()=>{
 const entries=generate('full');
 for(const key of ['side-left','side-right','f-divider-1']){
  const entry=entries[key];
  assert.equal(entry.operations.some(op=>op.macro==='REF'||op.macro==='POLC'),false);
  const rows=entry.operations.filter(op=>op.macro==='XBO');
  assert.ok(rows.length>=2);
  for(const row of rows){assert.equal(row.X,150);assert.equal(row.R,(entry.dx-300)/row.x);}
 }
});
