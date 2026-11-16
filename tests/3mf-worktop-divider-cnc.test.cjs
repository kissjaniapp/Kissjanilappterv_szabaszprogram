'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const auto=require('../machine/cnc-auto.cjs');
const app=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const packed=app.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
const html=JSON.parse(packed[1]);
const designer=html.slice(html.indexOf('function cncSupportRegions(p,boards,which){'),html.indexOf('function getStructuredParts(p){'));
function furniture(specs,excludeWorktop=false){
 const shapes=specs.map(([name,lo,size])=>({name,originMm:lo,axisBoundsMm:size,
  dimensions:[...size].sort((a,b)=>b-a),isRectangular:true}));
 return {name:'CNC minta',parts:shapes.flatMap((shape,i)=>excludeWorktop&&shape.dimensions[2]===38?[]:[{
  id:'id'+i,name:shape.name,cabinetDesignKey:'3mf-'+(i+1),threeMfGenerated:true,
  a:String(shape.dimensions[0]),b:String(shape.dimensions[1]),q:'1',threeMfThickness:shape.dimensions[2]}]),
  threeMfImport:{parts:shapes,groups:shapes.map((s,i)=>({name:s.name,dimensions:s.dimensions,indices:[i],isRectangular:true}))}};
}
const produce=f=>auto.makeAutoPrograms(f,f.parts.map(p=>p.id));
const file=(result,name)=>result.files.find(f=>f.part.startsWith(name+' / '));
const shape=(name,x,y,z,w,d,h)=>[name,[x,y,z],[w,d,h]];
test('a szabásból kihagyott 38-as munkalap és az alatta álló lap is fúrandó, a lista változatlan',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38),shape('F-osztó',491,20,0,18,550,900)],true);
 const original=JSON.stringify(f),out=produce(f);
 assert.equal(JSON.stringify(f),original,'a CNC nem írhatja vissza a munkalapot a szabászlistába');
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));assert.equal(out.files.length,2);
 assert.match(file(out,'Munkalap').content,/H DX=1000 DY=600 DZ=38 /);
 assert.match(file(out,'Munkalap').content,/LAPA X=500 Y=20 A=0 y=550 G=1/);
 assert.match(file(out,'F-osztó').content,/ELF2 Y=0 A=0 y=550 G=1/);
});
test('a CNC önállóan is előállítja a munkalap programját, szabászati rekord nélkül',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38)],true),out=produce(f);
 assert.equal(out.files.length,1);assert.equal(out.files[0].noMachining,true);
 assert.match(out.files[0].content,/DZ=38 /);assert.match(out.files[0].content,/VEGE/);
 assert.equal(f.parts.length,0);
});
test('munkalap alatt több oldal/F-osztó: minden tényleges lapél-csatlakozás mindkét programon szerepel',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38),
  shape('Bal oldal',0,0,0,18,600,900),shape('Jobb oldal',982,0,0,18,600,900),
  shape('F-osztó',491,10,0,18,570,900)],true),out=produce(f);
 assert.equal(out.files.length,4);assert.equal(out.contacts.length,3);
 const top=file(out,'Munkalap');assert.equal((top.content.match(/LAPA /g)||[]).length,3);
 assert.match(file(out,'Bal oldal').content,/-IL C=0|\-IJ C=0/);
 assert.match(file(out,'Jobb oldal').content,/-LI C=0|\-LK C=0/);
 for(const name of ['Bal oldal','Jobb oldal','F-osztó'])assert.match(file(out,name).content,/ELF2 /);
});
test('törölt vagy SCN-ben elrejtett munkalap nem támad fel és nem fúrja a szomszédját',()=>{
 for(const hidden of [false,true]){
  const f=furniture([shape('Munkalap',0,0,900,1000,600,38),shape('F-osztó',491,0,0,18,600,900)],true);
  if(hidden)f.scnImport={hiddenGroupIndices:[0]};else f.deletedPartKeys=['3mf-1'];
  const out=produce(f);assert.equal(out.files.length,1);assert.equal(out.contacts.length,0);
  assert.equal(out.files[0].noMachining,true);
 }
});
test('a munkalaphoz simuló teli lapfelület nem válik kitalált kötésfurattá',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38),shape('Tető',0,0,882,1000,600,18)],true);
 const out=produce(f);assert.equal(out.files.length,2);assert.equal(out.contacts.length,0);
 assert.ok(out.files.every(f=>f.noMachining));
});
function scene(){
 const depth=450;
 const f={kind:'f',key:'f-divider-1',name:'F-osztó',index:0,
  x1:491,x2:509,y0:0,y1:depth,z1:18,z2:1482,a:1464,b:depth};
 const h=(key,name,x1,x2)=>({key,name,kind:'v',index:0,x1,x2,y0:0,y1:depth,z1:500,z2:518,a:x2-x1,b:depth,angle:0,undercutDegrees:0});
 const boards=[f,h('v-left','V-osztó bal',18,491),h('v-right','V-osztó jobb',509,982)];
 const p={w:1000,h:1500,d:depth,t:18,innerW:964,sideH:1500,bodyBottomOffset:0,
  hasTop:true,hasBottom:true,top:'between',bottom:'between',drilling:'fixed',
  fullBack:false,rabbet:false,hasLegs:false,falseBottom:false,fCount:1,vCount:1,n:0};
 const specs=[shape('Bal oldal',0,0,0,18,depth,1500),shape('Jobb oldal',982,0,0,18,depth,1500),
  shape('Tető',18,0,1482,964,depth,18),shape('Fenék',18,0,0,964,depth,18),
  ...boards.map(b=>shape(b.name,b.x1,b.y0,b.z1,b.x2-b.x1,b.y1-b.y0,b.z2-b.z1))];
 return {boards,p,specs};
}
test('3MF F/V, oldalak, tető/fenék: azonos makrók és koordináták a bevált bútortervezővel',()=>{
 const {boards,p,specs}=scene();
 const ctx={fixedDividerPieces:()=>boards,baseShelfBack:()=>0};vm.createContext(ctx);vm.runInContext(designer,ctx);
 const keys=['side-left','side-right','top','bottom',...boards.map(b=>b.key)];
 const records=keys.map(key=>({key}));ctx.buildCncInstancesForParts(p,records);
 const expected=records.map(r=>r.cncInstances[0]);
 const f=furniture(specs),drafts=auto.threeMfContactDrafts(f,f.parts.map(p=>p.id));
 const out=produce(f);assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 for(let i=0;i<specs.length;i++){
  const actual=drafts.byPart.get('id'+i)[0],wanted=expected[i];
  assert.deepEqual([actual.dx,actual.dy,actual.dz,actual.side],[wanted.dx,wanted.dy,wanted.dz,wanted.side],specs[i][0]);
  const operations=e=>Array.from(e.operations,op=>JSON.stringify({macro:op.macro,face:op.face,
   X:op.X,Y:op.Y,x:op.x,y:op.y,shiftedF:op.shiftedF,gOverride:op.gOverride})).sort();
  assert.deepEqual(operations(actual),operations(wanted),specs[i][0]);
 }
 assert.match(file(out,'V-osztó jobb').content,/ELF3 Y=15 A=0 y=420 G=2/);
 assert.match(file(out,'F-osztó').content,/XMSG Q=1 N="FORDIT"/);
});
test('F-osztó a végigmenő V-osztón áll: V lapfurat és F alsó élfurat is készül',()=>{
 const f=furniture([shape('V-osztó',18,0,500,964,600,18),shape('F-osztó',491,0,518,18,600,300)]);
 const out=produce(f);assert.equal(out.contacts.length,1);assert.equal(out.blocked.length,0);
 assert.match(file(out,'V-osztó').content,/LAPA X=482 Y=0 A=0 y=600 G=1/);
 assert.match(file(out,'F-osztó').content,/H DX=300 DY=600 DZ=18 /);
 assert.match(file(out,'F-osztó').content,/ELF3 Y=0 A=0 y=600 G=1/);
});
test('keskeny V-osztó: CNC X a szélesség, nem a hosszabb mélység; a kötés nem cserél makrót',()=>{
 const f=furniture([shape('F-osztó',491,0,18,18,600,1464),shape('V-osztó',18,0,500,473,600,18)]);
 const out=produce(f);assert.equal(out.blocked.length,0);
 assert.match(file(out,'V-osztó').content,/H DX=473 DY=600 DZ=18 /);
 assert.match(file(out,'V-osztó').content,/ELF2 Y=0 A=0 y=600 G=1/);
 assert.match(file(out,'F-osztó').content,/LAPA X=491 Y=0 A=0 y=600 G=1/);
});
test('azonos sorba vont két fizikai test egymással való találkozása sem marad ki',()=>{
 const f=furniture([shape('Lap',0,0,0,600,400,18),shape('Lap',0,0,18,18,400,600)]);
 f.parts=f.parts.slice(0,1);f.parts[0].q='2';
 f.threeMfImport.groups=[{name:'Lap',dimensions:[600,400,18],indices:[0,1],isRectangular:true}];
 const out=produce(f);assert.equal(out.files.length,2);assert.equal(out.contacts.length,1);
 assert.ok(out.files.every(f=>!f.noMachining));
});
test('névtelen Body testeknél is a szerkezeti hely adja az F/V kötést és az alsó CNC-nullpontot',()=>{
 const {specs}=scene(),f=furniture(specs.map((s,i)=>['Body'+(i+1),s[1],s[2]])),out=produce(f);
 assert.equal(out.files.length,7);assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 assert.match(file(out,'Body5').content,/LAPA X=491 Y=0 A=0 y=450 G=1/);
 assert.match(file(out,'Body5').content,/LAPA X=491 Y=15 A=0 y=420 G=1/);
 assert.match(file(out,'Body7').content,/ELF3 Y=15 A=0 y=420 G=2/);
 assert.match(file(out,'Body2').content,/-LI /);
});
test('Y felfelé exportált névvel azonosított bútor: a CNC-méretek és az F/V makrók változatlanok',()=>{
 const {specs}=scene();
 const rotated=specs.map(([name,lo,size])=>[name,[lo[0],lo[2],lo[1]],[size[0],size[2],size[1]]]);
 const base=produce(furniture(specs)),other=produce(furniture(rotated));
 assert.equal(other.blocked.length,0,JSON.stringify(other.blocked));
 for(const [name] of specs)assert.equal(file(other,name).content,file(base,name).content,name);
});
test('két F-osztó közötti V mindkét élén a bútortervező G=2 és 15 mm eltolása van',()=>{
 const f=furniture([shape('F-osztó 1',400,0,18,18,450,1464),shape('F-osztó 2',800,0,18,18,450,1464),
  shape('V-osztó közép',418,0,500,382,450,18)]),out=produce(f);
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 assert.match(file(out,'V-osztó közép').content,/ELF3 Y=15 A=0 y=420 G=2/);
 assert.match(file(out,'V-osztó közép').content,/ELF2 Y=15 A=0 y=420 G=2/);
 assert.match(file(out,'F-osztó 2').content,/-LI /);
});
test('kézzel letiltott, létező munkalaprekordot a CNC-sem kapcsolhat vissza',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38),shape('F-osztó',491,0,0,18,600,900)]);
 const out=auto.makeAutoPrograms(f,['id1']);assert.equal(out.files.length,1);assert.equal(out.contacts.length,0);
});
test('hiányos 3MF test mellett a többi érvényes munkalap-furat és program megmarad',()=>{
 const f=furniture([shape('Munkalap',0,0,900,1000,600,38),shape('F-osztó',491,0,0,18,600,900),
  shape('Hibás',0,0,0,18,600,900)],true);
 f.threeMfImport.parts[2]=null;
 const out=produce(f);assert.equal(out.files.length,2);assert.ok(out.blocked.some(e=>e.part==='Hibás'));
 assert.match(file(out,'Munkalap').content,/LAPA X=500 /);
});
