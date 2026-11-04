'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const calcA=html.indexOf('function calc(formula,vars){');
const calcB=html.indexOf('\n  function getParts(){',calcA);
const helperA=html.indexOf('function isFormulaText(');
const helperB=html.indexOf('\n  // Gépeléskor nem rajzoljuk újra',helperA);
assert.ok(calcA>=0&&calcB>calcA&&helperA>0&&helperB>helperA,'Képletkezelő vagy élő megjelenítő hiányzik');
const matA=html.indexOf('function materialForPart(part,f){');
const matB=html.indexOf('\n  function materialOptions(',matA);
const shelfA=html.indexOf('function effectiveShelves(f){');
const shelfB=html.indexOf('\n  function effectiveDivider(f){',shelfA);
const dividerA=html.indexOf('function effectiveDivider(f){');
const dividerB=html.indexOf('\n  // A régi adatokat',dividerA);
assert.ok(matA>0&&matB>matA&&shelfA>0&&shelfB>shelfA&&dividerA>0&&dividerB>dividerA);
const formulaEngine=vm.runInNewContext('(function(){\n'+
  'const materialCatalog=[];\n'+
  html.slice(matA,matB)+'\n'+html.slice(shelfA,shelfB)+'\n'+
  html.slice(dividerA,dividerB)+'\n'+
  html.slice(calcA,calcB)+'\n'+
  'function dimensionUnderline(part,axis){const edge=String(part.edge||"0-0"),filing=part.filingSides||{};const i=axis==="a"?0:2;return Math.max(Number(edge[i]||0),i===0?Number(!!filing.x1)+Number(!!filing.x2):Number(!!filing.y1)+Number(!!filing.y2));}\n'+
  html.slice(helperA,helperB)+
  '\nreturn {calc,isFormulaText,partDimensionPreview,partDimensionInput};\n})()',{
    h:x=>String(x??'').replace(/"/g,'&quot;'),
    nfmt:x=>Number(x).toLocaleString('hu-HU',{maximumFractionDigits:1}),
    pnum:x=>Number(String(x).replace(',','.'))
  });
const furniture={w:1000,ht:910,d:600,t:18,s:0,qty:1};
function part(){return {id:'resz-1',name:'oldal',a:'W-18',b:'D',q:'6',edge:'2-0',edgeThickness:2,mill:true};}
test('W-18 képlet fölül marad, alatta 982 mm szám látszik',()=>{
 const p=part();
 assert.equal(formulaEngine.calc(p.a,{W:1000,H:910,D:600,T:18,S:0}),982);
 assert.equal(formulaEngine.isFormulaText('W-18'),true);
 assert.equal(formulaEngine.isFormulaText('600-2'),true);
 assert.equal(formulaEngine.isFormulaText('600'),false);
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'a'),'982');
 const htmlInput=formulaEngine.partDimensionInput(p,furniture,'a','Első méret szálirányban');
 assert.match(htmlInput,/class="expr-cell has-formula"/);
 assert.match(htmlInput,/data-key="a" value="W-18"/);
 assert.match(htmlInput,/>982<\/output>/);
});
test('az alkatrészek oldalán mindig a készméret jelenik meg, függetlenül az ABS-től',()=>{
 const p=part();
 // A D=600 a készméret. A szabáshoz a getParts később számol levonást.
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'600');
 const input=formulaEngine.partDimensionInput(p,furniture,'b','Második méret');
 assert.match(input,/class="expr-cell has-formula"/);
 assert.match(input,/>600<\/output>/);
 p.mill=false;
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'600');
 p.edgeThickness=0.4;
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'600');
});
test('a változó átírásakor változik az eredmény, a tárolt képlet nem',()=>{
 const p=part();
 const another={...furniture,w:1250};
 assert.equal(formulaEngine.partDimensionPreview(p,another,'a').replace(/\s/g,''),'1232');
 assert.equal(p.a,'W-18');
});
test('hiányos képlet nem írja felül a képlet szövegét és nem mutat hibás számot',()=>{
 const p=part();p.a='W-';
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'a'),'–');
 const source=formulaEngine.partDimensionInput(p,furniture,'a','Méret');
 assert.match(source,/value="W-"/);
 assert.match(source,/class="expr-result invalid"/);
});
test('közvetlen szám továbbra is rendesen szerkeszthető',()=>{
 const p=part();p.a='980';
 const source=formulaEngine.partDimensionInput(p,furniture,'a','Méret');
 assert.match(source,/class="expr-cell "/);
 assert.match(source,/value="980"/);
 assert.doesNotMatch(source,/class="expr-cell has-formula"/);
});

test('aláhúzás: 0 nincs, 1 egyszeres, 2 kétszeres, X és Y független',()=>{
 const p=part();
 p.edge='0-0';p.filingSides={};
 for(const axis of ['a','b']){
   const bare=formulaEngine.partDimensionInput(p,furniture,axis,'Méret');
   assert.match(bare,/text-decoration:none/);
 }
 for(const [edge,expectedX,expectedY] of [['1-0','solid','none'],['0-2','none','double'],['2-1','double','solid']]){
   p.edge=edge;
   const x=formulaEngine.partDimensionInput(p,furniture,'a','X');
   const y=formulaEngine.partDimensionInput(p,furniture,'b','Y');
   assert.match(x,new RegExp('text-decoration-style:'+ (expectedX==='none'?'solid':expectedX)));
   assert.match(y,new RegExp('text-decoration-style:'+ (expectedY==='none'?'solid':expectedY)));
   assert.equal(x.includes('text-decoration:underline'),expectedX!=='none');
   assert.equal(y.includes('text-decoration:underline'),expectedY!=='none');
   assert.match(x,/class="expr" style="text-decoration:none/);
   assert.match(y,/class="expr" style="text-decoration:none/);
 }
});
