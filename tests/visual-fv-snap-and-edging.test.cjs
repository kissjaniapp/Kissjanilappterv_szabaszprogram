'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const token=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(token,'Bútortervező beágyazás hiányzik');
const html=JSON.parse(token[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);
const designer=scripts[0];
function between(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Hiányzó függvény: '+start);
 return source.slice(a,b);
}
const visual=between(designer,'function visualApplyParts(p,base,layout){','const DEFAULTS=');
function geometry(edits={},masksF=[],masksH={}){
 const c={};
 vm.createContext(c);
 vm.runInContext(
  'let visualEdited=true,visualMaskF='+JSON.stringify(masksF)+
  ',visualMaskH='+JSON.stringify(masksH)+
  ',visualPieceEdits='+JSON.stringify(edits)+';\n'+
  'function visualMaskValue(axis,key,index){const row=axis==="f"?visualMaskF[Number(key)]:visualMaskH[String(key)];return !Array.isArray(row)||row[index]!==false;}\n'+
  visual+'\nthis.apply=visualApplyParts;',c);
 return c;
}
function fBoard(key,z1,z2){
 return {key,kind:'f',name:key,index:0,x1:491,x2:509,z1,z2,
  y0:0,y1:450,a:z2-z1,b:450};
}
function vBoard(key,x1,x2){
 return {key,kind:'v',name:key,index:0,x1,x2,z1:391,z2:409,
  y0:0,y1:450,a:x2-x1,b:450};
}
function boards(...parts){
 const result=parts;result.connectionIssues=[];return result;
}
const p={w:1000,h:1500,t:18};
const layout={horizontals:[{kind:'v',index:0,z:400}],f:[{center:500}],
 x0:18,x3:982,z0:18,z3:1482};
test('Eltolt F-darabhoz a két V-szakasz végpontja csatlakozik, méretük újraszámolódik',()=>{
 const scene=geometry({'f-divider-1':{shift:60}});
 const out=scene.apply(p,boards(
  fBoard('f-divider-1',18,1482),
  vBoard('v-divider-1-section-1',18,491),
  vBoard('v-divider-1-section-2',509,982)),layout);
 const left=out.find(b=>b.key==='v-divider-1-section-1'),right=out.find(b=>b.key==='v-divider-1-section-2');
 assert.equal(left.x2,551);
 assert.equal(right.x1,569);
 assert.equal(left.a,533);
 assert.equal(right.a,413);
 assert.equal(out.find(b=>b.kind==='f').x1,551);
 assert.ok(out.connectionIssues.some(x=>/CNC/.test(x)));
});
test('Eltolt vízszintes V-laphoz az alsó/felső F-darab végpontjai igazodnak',()=>{
 const scene=geometry({'v-divider-1':{shift:80}});
 const out=scene.apply(p,boards(
  fBoard('f-divider-1-section-1',18,391),
  fBoard('f-divider-1-section-2',409,1482),
  vBoard('v-divider-1',18,982)),layout);
 assert.equal(out.find(b=>b.key==='f-divider-1-section-1').z2,471);
 assert.equal(out.find(b=>b.key==='f-divider-1-section-2').z1,489);
 assert.equal(out.find(b=>b.key==='f-divider-1-section-1').a,453);
 assert.equal(out.find(b=>b.key==='v-divider-1').z1,471);
});
test('Kézzel visszahúzott önálló V-végpont nem tapad vissza automatikusan az F-hez',()=>{
 const scene=geometry({'f-divider-1':{shift:60},'v-divider-1-section-1':{end:5}});
 const out=scene.apply(p,boards(
  fBoard('f-divider-1',18,1482),
  vBoard('v-divider-1-section-1',18,491)),layout);
 assert.equal(out.find(b=>b.kind==='v').x2,486);
});
test('Kivett F-rész helyére nem talál ki nem létező F-csatlakozást',()=>{
 const masks=[[true,false]],scene=geometry({},masks,{});
 const out=scene.apply(p,boards(
  fBoard('f-divider-1',18,1482),
  vBoard('v-divider-1-section-1',18,491)),layout);
 const divider=out.find(b=>b.kind==='f'),v=out.find(b=>b.kind==='v');
 assert.equal(divider.z2,391);
 assert.equal(v.x2,491);
});
test('A kötést nem takarja fehér kör, csak a mutatóvonal és F/V betű jelöl',()=>{
 const block=between(designer,'// Az átfutást jelző F/V betű','// Az egész sor módban');
 assert.doesNotMatch(block,/<circle/);
 assert.match(block,/stroke-dasharray="3 3"/);
 assert.match(block,/data-vis-joint/);
 assert.match(block,/label===/);
});
function edges(){
 let seq=0;
 const allPartSides=['x1','x2','y1','y2'];
 function sidesFromCode(code){
  const [x,y]=String(code||'0-0').split('-').map(Number);
  return {x1:x>=1,x2:x>=2,y1:y>=1,y2:y>=2};
 }
 function codeFromSides(s){
  return Number(Boolean(s.x1))+Number(Boolean(s.x2))+'-'+
   (Number(Boolean(s.y1))+Number(Boolean(s.y2)));
 }
 function partEdgeThicknesses(part){
  return Object.fromEntries(allPartSides.map(side=>[side,
   part.edgeThicknesses?.[side]??(part.edgeSides?.[side]?(part.edgeThickness??2):0)]));
 }
 const ctx={allPartSides,sidesFromCode,codeFromSides,partEdgeThicknesses,
  materialCatalog:[],hdfMaterial:()=>null,uuid:()=> 'part-'+(++seq),result:null};
 vm.createContext(ctx);
 vm.runInContext(between(source,'function cabinetAutoEdging(part, config){',
  'function cabinetDesignerDims(f){'),ctx);
 return ctx;
}
test('Alap élzárás visszatér a fenék, pótfenék és F/V osztókra is',()=>{
 const e=edges();
 for(const [key,code,filing] of [
  ['bottom','1-0','0-0'],['false-bottom','1-2','0-2'],
  ['f-divider-1','1-0','0-0'],['f-divider-1-cut-2','1-0','0-0'],
  ['v-divider-3-section-1','1-0','0-0'],['shelf-1','1-0','0-0'],
  ['back-full','0-0','0-0']]){
  const part={cabinetDesignKey:key,name:key,edge:'0-0'};
  e.cabinetAutoEdging(part,{inputs:{hasTop:true,hasBottom:true},radios:{top:'between',bottom:'between'}});
  assert.equal(part.edge,code,key);
  assert.equal(e.codeFromSides(part.filingSides),filing,key);
  assert.equal(part.edgeThickness,2,key);
 }
});
test('Egyedileg átírt élzárás és 0,4 mm ABS nem írható felül',()=>{
 const e=edges(),part={cabinetDesignKey:'f-divider-1',name:'F-osztó',
  edge:'0-0'};
 e.cabinetAutoEdging(part,{});
 const prior=part.autoCabinetEdging;
 part.edge='2-0';part.edgeSides=e.sidesFromCode('2-0');
 part.edgeThicknesses={x1:.4,x2:2,y1:0,y2:0};
 part.filingSides=e.sidesFromCode('1-0');
 e.cabinetAutoEdging(part,{});
 assert.equal(part.edge,'2-0');
 assert.equal(part.edgeThicknesses.x1,.4);
 assert.equal(part.autoCabinetEdging,prior);
});
test('Szétbontáskor megőrződnek a kézi élzárási és anyagbeállítások',()=>{
 const e=edges();
 const original={id:'old-part',cabinetDesignKey:'v-divider-1',
  name:'V-osztó',autoCabinetName:'V-osztó',a:'900',b:'450',q:'1',
  materialId:'custom-board',materialColor:'Tölgy',
  edge:'2-0',edgeSides:e.sidesFromCode('2-0'),
  edgeThickness:2,edgeThicknesses:{x1:.4,x2:2,y1:0,y2:0},
  filingSides:e.sidesFromCode('0-1'),
  mill:true,millDepth:1.5,grainRequired:true};
 const furniture={parts:[original],cabinetDesign:{inputs:{},radios:{}}};
 e.syncCabinetDesignerParts(furniture,[
  {key:'v-divider-1',name:'V-osztó 1',a:430,b:450,qty:1},
  {key:'v-divider-1-cut-2',name:'V-osztó 1 · 2. rész',a:412,b:450,qty:1}
 ]);
 const other=furniture.parts.find(p=>p.cabinetDesignKey==='v-divider-1-cut-2');
 assert.ok(other);
 assert.equal(other.materialId,'custom-board');
 assert.equal(other.materialColor,'Tölgy');
 assert.equal(other.edge,'2-0');
 assert.equal(other.edgeThicknesses.x1,.4);
 assert.equal(other.millDepth,1.5);
 assert.equal(e.codeFromSides(other.filingSides),'0-1');
});
test('Eltérő élzárású F/V alkatrészek automatikus összevonása tilos',()=>{
 const e=edges(),parts=[
  {id:'f1',cabinetDesignKey:'f-divider-1',name:'F-osztó',autoCabinetName:'F-osztó',
   edge:'2-0',edgeSides:e.sidesFromCode('2-0')},
  {id:'f2',cabinetDesignKey:'f-divider-2',name:'F-osztó',autoCabinetName:'F-osztó',
   edge:'1-0',edgeSides:e.sidesFromCode('1-0')}
 ];
 const furniture={parts,cabinetDesign:{inputs:{},radios:{}}};
 e.syncCabinetDesignerParts(furniture,[
  {key:'f-divider-1',sourceKeys:['f-divider-1','f-divider-2'],
   name:'F-osztó',a:540,b:450,qty:2}
 ]);
 assert.equal(furniture.parts.length,2);
 assert.ok(furniture.parts.some(p=>p.cabinetDesignKey==='f-divider-1'));
 assert.ok(furniture.parts.some(p=>p.cabinetDesignKey==='f-divider-2'));
});

test('A saját második F-osztó szakasz külön élzárása -cut- utótag után is megmarad',()=>{
 const e=edges();
 const one={id:'first',cabinetDesignKey:'f-divider-1-section-1',name:'F-osztó 1 · 1. rész',autoCabinetName:'F-osztó 1 · 1. rész',
  a:'300',b:'450',q:'1',edge:'1-0',edgeSides:e.sidesFromCode('1-0'),edgeThickness:2};
 const two={id:'second',cabinetDesignKey:'f-divider-1-section-2',name:'F-osztó 1 · 2. rész',autoCabinetName:'F-osztó 1 · 2. rész',
  a:'500',b:'450',q:'1',edge:'2-0',edgeSides:e.sidesFromCode('2-0'),
  edgeThicknesses:{x1:.4,x2:2,y1:0,y2:0},filingSides:e.sidesFromCode('0-1')};
 const furniture={parts:[one,two],cabinetDesign:{inputs:{},radios:{}}};
 e.syncCabinetDesignerParts(furniture,[
  {key:'f-divider-1-section-1',name:'F-osztó 1 · 1. rész',a:300,b:450,qty:1},
  {key:'f-divider-1-section-2-cut-2',name:'F-osztó 1 · 2. rész',a:220,b:450,qty:1}
 ]);
 const cut=furniture.parts.find(p=>p.cabinetDesignKey==='f-divider-1-section-2-cut-2');
 assert.ok(cut);
 assert.equal(cut.edge,'2-0');
 assert.equal(cut.edgeThicknesses.x1,.4);
 assert.equal(e.codeFromSides(cut.filingSides),'0-1');
});

test('Kivett és később visszaállított osztó kézi élzárása a projekttel megmarad',()=>{
 const e=edges();
 const furniture={parts:[{
  id:'old-v',cabinetDesignKey:'v-divider-2',name:'V-osztó 2',autoCabinetName:'V-osztó 2',
  a:'500',b:'400',q:'1',edge:'2-0',edgeSides:e.sidesFromCode('2-0'),
  edgeThickness:2,edgeThicknesses:{x1:.4,x2:2,y1:0,y2:0}
 }],cabinetDesign:{inputs:{},radios:{}}};
 e.syncCabinetDesignerParts(furniture,[]);
 assert.equal(furniture.parts.length,0,'a teljesen kivett osztó nem szabászati alkatrész');
 assert.ok(furniture.cabinetPartSettings['v-divider-2']);
 e.syncCabinetDesignerParts(furniture,[
  {key:'v-divider-2',name:'V-osztó 2',a:490,b:400,qty:1}
 ]);
 assert.equal(furniture.parts.length,1);
 assert.equal(furniture.parts[0].edge,'2-0');
 assert.equal(furniture.parts[0].edgeThicknesses.x1,.4);
});
