'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');

function designerHtml(){
 const token='const GATTERKA_CABINET_INLINE_HTML=';
 const k=app.indexOf(token);
 assert.ok(k>=0,'A beépített bútorrajzoló hiányzik');
 const a=app.indexOf('"',k);
 const e=app.indexOf('function syncCabinetDesignerTheme()',a);
 assert.ok(e>a,'A beágyazott HTML végét nem találjuk');
 const b=app.lastIndexOf('";',e);
 assert.ok(b>a,'Az idézőjel vége hiányzik');
 return JSON.parse(app.slice(a,b+1));
}
function geometry(angle=25,overrides={},layout={}){
 const html=designerHtml();
 const from=html.indexOf('function baseShelfBack(p){');
 const to=html.indexOf('function read(){',from);
 const piecesFrom=html.indexOf('function fixedDividerPieces(p){');
 const piecesTo=html.indexOf('function getStructuredParts(p){',piecesFrom);
 const partsTo=html.indexOf('let currentParts=[];',piecesTo);
 assert.ok(from>=0&&to>from&&piecesFrom>=0&&piecesTo>piecesFrom&&partsTo>piecesTo);
 const ctx={
  shelfBackOverrides:[overrides.back??null],
  shelfDepthOverrides:[overrides.depth??null],
  shelfFrontOverrides:[overrides.front??null],
  shelfAngles:[angle],
  clamp:(x,min,max)=>Math.max(min,Math.min(max,x)),
  horizontalLayout:()=>layout.rows||[
   {kind:'shelf',index:0,level:140},
   {kind:'v',index:0,level:280}
  ],
  fPositions:()=>[],
  fStarts:[],fEnds:[],
  fmt:v=>Number(v.toFixed(1)).toString()
 };
 vm.createContext(ctx);
 vm.runInContext(html.slice(from,to)+'\n'+html.slice(piecesFrom,partsTo),ctx);
 const p={
  w:1000,h:1500,d:400,t:18,n:1,vCount:1,fCount:0,
  front:0,vSetback:25,fSetback:0,bodyBottomOffset:0,
  hasTop:true,hasBottom:true,top:'between',bottom:'between',
  falseBottom:false,innerW:964,innerH:1464,sideH:1500,
  backType:'rabbet',fullBack:false,rabbet:true,rabbetWidth:4,
  hdfThickness:4,hdfW:989,hdfH:1480,
  fullBackSetback:0,drilling:'fixed',dividerThrough:'f',
  ...overrides.panel
 };
 return {ctx,p,html};
}

test('döntött polc a falcos HDF belső síkjához ér, egyedi korábbi mélységet is felülírja',()=>{
 const {ctx,p}=geometry(25,{back:70,depth:240,front:20});
 assert.equal(ctx.baseShelfBack(p),4);
 assert.equal(ctx.shelfBackAt(p,0),4);
 assert.equal(ctx.shelfDepthAt(p,0),376);
 assert.ok(Math.abs(ctx.shelfLongEdgeAt(p,0)-376/Math.cos(25*Math.PI/180))<1e-7);
 const shapes=ctx.fixedDividerPieces(p);
 const shelf=shapes.find(x=>x.kind==='shelf'),divider=shapes.find(x=>x.kind==='v');
 assert.equal(shelf.y1,396);
 assert.equal(shelf.y0,20);
 assert.ok(Math.abs(shelf.b-ctx.shelfLongEdgeAt(p,0))<1e-7);
 assert.equal(shelf.undercutDegrees,25);
 assert.equal(shelf.drilling,'fixed');
 assert.equal(divider.y1,396,'A V-osztó is ugyanaddig a belső síkig fut');
 assert.equal(divider.drilling,'fixed');
});

test('teli hátlap esetén a lapvastagság és a hátsó visszaállás együtt csökkenti a hátsó határt',()=>{
 const {ctx,p}=geometry(-15,{panel:{fullBack:true,rabbet:false,fullBackSetback:22}});
 assert.equal(ctx.baseShelfBack(p),40);
 assert.equal(ctx.shelfBackAt(p,0),40);
 const shapes=ctx.fixedDividerPieces(p);
 assert.equal(shapes.find(x=>x.kind==='shelf').y1,360);
 assert.equal(shapes.find(x=>x.kind==='v').y1,360);
 assert.equal(shapes.find(x=>x.kind==='shelf').undercutDegrees,15);
});

test('falcos HDF-nél a 4 mm fizikai hátfalon nem mehet át a polc',()=>{
 const {ctx,p}=geometry(10,{panel:{rabbetWidth:2}});
 assert.equal(ctx.baseShelfBack(p),4);
 assert.equal(ctx.fixedDividerPieces(p).find(x=>x.kind==='shelf').y1,396);
});
test('vízszintes polcnál a felhasználó egyedi mélysége továbbra is működik',()=>{
 const {ctx,p}=geometry(0,{front:15,depth:290,back:75});
 assert.equal(ctx.shelfDepthAt(p,0),290);
 assert.equal(ctx.shelfBackAt(p,0),95);
 const shelf=ctx.fixedDividerPieces(p).find(x=>x.kind==='shelf');
 assert.equal(shelf.b,290);
 assert.equal(shelf.undercutDegrees,0);
});
test('a strukturált alkatrészlistába ugyanaz a ferde hosszméret és alávágás kerül',()=>{
 const {ctx,p}=geometry(25);
 const shelf=ctx.fixedDividerPieces(p).find(x=>x.kind==='shelf');
 const rows=ctx.getStructuredParts(p);
 const row=rows.find(x=>x.key===shelf.key);
 assert.ok(row);
 assert.equal(row.b,Math.round(shelf.b*10)/10);
 assert.equal(row.shelfTiltDegrees,25);
 assert.equal(row.shelfBevelDegrees,25);
 assert.equal(row.fixedDrilling,true);
 assert.match(row.remark,/alávágás: 25°/);
 const divider=rows.find(x=>x.name.startsWith('V-osztó'));
 assert.equal(divider.fixedDrilling,true);
});
test('ha polc dől, a fúrás automatikusan fixre vált, a szerkezeti panelek továbbra is egy forrásból frissülnek',()=>{
 const html=designerHtml();
 assert.match(html,/Math\.abs\(shelfAngleAt\(i\)\)>0\.001\)\.some\(Boolean\)/);
 assert.match(html,/input\[name="drilling"\]\[value="fixed"\]/);
 assert.match(html,/const fixedPieces=fixedDividerPieces\(p\)/);
 assert.match(html,/for\(const piece of fixedDividerPieces\(p\)\)/);
});
test('Gatterka alkatrészek, összesítő PNG és matrica is megkapja az alávágási szöget',()=>{
 assert.match(app,/generated\.shelfBevelDegrees=Math\.abs\(Number\(row\.shelfBevelDegrees\)/);
 assert.match(app,/Number\(part\.shelfBevelDegrees\)>0\.001/);
 assert.match(app,/Alávágás: '\+format\(Math\.abs\(r\.part\.shelfBevelDegrees\)\)/);
 assert.match(app,/const undercutText=undercut>0\.001\?'Alávágás: '/);
 assert.match(app,/undercutText\?line\(fit\(undercutText/);
});
