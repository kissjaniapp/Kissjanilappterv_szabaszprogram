'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const auto=require('../machine/cnc-auto.cjs');

// F-OSZTO: a BAL oldali furatsor készül ELŐSZÖR,
// utána X tengelyes fordítás (FORDIT_X), végül a JOBB lapoldal.
// A korábban jóváhagyott 15 mm-es Y-eltolás és G-kód változatlan.
// A felhasználó F-OSZTO_MELETTE_FIX_POLC_TALAKOZAS.zip mintái:
// BAL_OLDALI_POLC: ELF3 Y=0 y=400 G=1 / ELF2 Y=0 y=400 G=1
// JOBB_OLDALI_POLC: ELF3 Y=15 y=DY-30 G=2 / ELF2 Y=0 y=400 G=1
// F-OSZTO: LAPA X=DX/2 Y=0 y=400 G=1, FORDIT_X,
//          LAPA X=DX/2 Y=15 y=400-30 G=1
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function sourceModel(){
 const token='const GATTERKA_CABINET_INLINE_HTML=';
 const i=source.indexOf(token),first=source.indexOf('"',i);
 const end=source.indexOf('function syncCabinetDesignerTheme()',first);
 const last=source.lastIndexOf('";',end);
 assert.ok(first>=0&&last>first,'Beágyazott bútortervező hiányzik');
 const html=JSON.parse(source.slice(first,last+1));
 const start=html.indexOf('function cncSupportRegions(');
 const stop=html.indexOf('function getStructuredParts(p){',start);
 assert.ok(start>=0&&stop>start);
 const ctx={fixedDividerPieces:()=>[],baseShelfBack:()=>4};
 vm.createContext(ctx);
 vm.runInContext(html.slice(start,stop),ctx);
 return ctx;
}
function scene(n,kind='v'){
 const t=18,depth=400,width=600+n*650;
 const centers=Array.from({length:n},(_,i)=>600+i*650);
 const f=centers.map((x,i)=>({
   key:'f-divider-'+(i+1),name:'F-osztó '+(i+1),
   kind:'f',index:i,x1:x-t/2,x2:x+t/2,
   y0:0,y1:depth,z1:18,z2:1482,a:1464,b:depth
 }));
 const joins=[t,...centers.flatMap(x=>[x-t/2,x+t/2]),width-t];
 const sections=[];
 for(let i=0;i<joins.length-1;i+=2){
  const j=i/2;
  sections.push({
   key:kind+'-1-section-'+(j+1),name:kind==='v'?'V-osztó '+(j+1):'Polc '+(j+1),
   kind,index:0,x1:joins[i],x2:joins[i+1],
   y0:0,y1:depth,z1:500,z2:518,a:joins[i+1]-joins[i],b:depth,
   angle:0,undercutDegrees:0
  });
 }
 const p={w:width,h:1500,d:depth,t,innerW:width-2*t,sideH:1500,
   hasTop:false,hasBottom:false,bodyBottomOffset:0,
   drilling:'fixed',fCount:n,vCount:kind==='v'?1:0,n:kind==='shelf'?1:0,
   fullBack:false,rabbet:true,rabbetWidth:4
 };
 return {p,boards:[...f,...sections],f,sections};
}
function generated(n,kind='v'){
 const {p,boards,f,sections}=scene(n,kind);
 const ctx=sourceModel();ctx.fixedDividerPieces=()=>boards;
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
   ...f.map(x=>({key:x.key})),...sections.map(x=>({key:x.key}))];
 ctx.buildCncInstancesForParts(p,records);
 const byKey=new Map(records.flatMap(r=>r.cncInstances||[]).map(e=>[e.key,e]));
 return {byKey,sections,f,p};
}
function program(entry,mode='excenter'){return auto.compileEntry(entry,{assemblyJoint:mode});}
test('egy F-osztó: bal V-polc 1/1 normál, jobb V-polc 2/1 eltolt, az osztó IJ',()=>{
 const {byKey,sections,f}=generated(1);
 const left=program(byKey.get(sections[0].key));
 const right=program(byKey.get(sections[1].key));
 const divider=program(byKey.get(f[0].key));
 assert.match(left,/ELF3 Y=0 A=0 y=400 G=1/);
 assert.match(left,/ELF2 Y=0 A=0 y=400 G=1/);
 assert.match(right,/ELF3 Y=15 A=0 y=370 G=2/);
 assert.match(right,/ELF2 Y=0 A=0 y=400 G=1/);
 assert.match(divider,/^-?H DX=1464 DY=400 DZ=18 -IL C=0 T=16973825 /);
 assert.match(divider,/LAPA X=491 Y=0 A=0 y=400 G=1/);
 assert.match(divider,/XMSG Q=1 N="FORDIT_X"/);
 assert.match(divider,/LAPA X=491 Y=15 A=0 y=370 G=1/);
 // Az F-osztó BAL lapoldala készül előbb, utána FORDIT_X és JOBB oldal.
 const rightAfter=divider.indexOf('LAPA X=491 Y=15 A=0 y=370 G=1');
 const flipped=divider.indexOf('XMSG Q=1 N="FORDIT_X"');
 const leftFirst=divider.indexOf('LAPA X=491 Y=0 A=0 y=400 G=1');
 assert.ok(leftFirst>=0&&flipped>leftFirst&&rightAfter>flipped,
   'Az F-osztó bal oldalát kell először fúrni, FORDIT_X után a jobbat');
});
test('két F-osztó: középső polc mindkét éle ELF G=2; osztók IJ és LK',()=>{
 const {byKey,sections,f}=generated(2);
 const [left,middle,right]=sections.map(x=>program(byKey.get(x.key)));
 const [first,second]=f.map(x=>program(byKey.get(x.key)));
 assert.match(left,/ELF3 Y=0 A=0 y=400 G=1/);
 assert.match(left,/ELF2 Y=0 A=0 y=400 G=1/);
 assert.match(middle,/ELF3 Y=15 A=0 y=370 G=2/);
 assert.match(middle,/ELF2 Y=15 A=0 y=370 G=2/);
 assert.match(right,/ELF3 Y=15 A=0 y=370 G=2/);
 assert.match(right,/ELF2 Y=0 A=0 y=400 G=1/);
 assert.match(first,/-IL C=0/);
 assert.match(second,/-LI C=0/);
 assert.match(first,/LAPA X=491 Y=0 A=0 y=400 G=1/);
 assert.match(first,/LAPA X=491 Y=15 A=0 y=370 G=1/);
 assert.equal((second.match(/LAPA X=491 Y=15 A=0 y=370 G=1/g)||[]).length,2);
});
test('három F-osztó: a két köztes szakasz G=2/G=2, szélső lapcsatlakozás G=1',()=>{
 const {byKey,sections,f}=generated(3);
 const codes=sections.map(s=>{
  const p=program(byKey.get(s.key));
  const left=p.match(/ELF3 Y=\d+ A=0 y=\d+ G=(\d)/)?.[1];
  const right=p.match(/ELF2 Y=\d+ A=0 y=\d+ G=(\d)/)?.[1];
  return [left,right];
 });
 assert.deepEqual(codes,[['1','1'],['2','2'],['2','2'],['2','1']]);
 assert.deepEqual(f.map(x=>byKey.get(x.key).side),['IJ','LK','IJ']);
});
test('a fix polc ugyanazt a mintát kapja, mint a V-osztó',()=>{
 const {byKey,sections}=generated(2,'shelf');
 const center=program(byKey.get(sections[1].key));
 assert.match(center,/ELF3 Y=15 A=0 y=370 G=2/);
 assert.match(center,/ELF2 Y=15 A=0 y=370 G=2/);
});
test('eltolt F-G2 csak excenteres kötéshez engedélyezett, normál kötéseknél nincs felülírás',()=>{
 const {byKey,sections}=generated(1);
 const outer=byKey.get(sections[0].key),inner=byKey.get(sections[1].key);
 assert.match(program(outer,'tipli'),/ELF3 Y=0 A=0 y=400 G=0/);
 assert.throws(()=>program(inner,'tipli'),/csak excenteres/);
 assert.throws(()=>program(inner,'csavar'),/csak excenteres/);
 assert.throws(()=>program(inner,'hosszuExcenter'),/csak excenteres/);
});
test('elfutó vagy túl keskeny F-csatlakozás nem ad ki ellenőrizetlen megmunkálást',()=>{
 const {p,boards,sections}=scene(1);
 // A keskeny frontális átfedés nem alkalmas Y=15, y=DY-30-ra.
 const f=boards.find(x=>x.kind==='f');
 f.y0=385;f.y1=400;
 const ctx=sourceModel();ctx.fixedDividerPieces=()=>boards;
 const records=[{key:sections[1].key}];ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.match(entry.issues.join(' '),/legalább 30 mm/);
 assert.throws(()=>program(entry),/legalább 30 mm/);
});
