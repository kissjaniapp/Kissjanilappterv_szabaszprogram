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
const formulaEngine=vm.runInNewContext('(function(){\n'+html.slice(calcA,calcB)+'\n'+
  html.slice(helperA,helperB)+'\nreturn {calc,isFormulaText,partDimensionPreview,partDimensionInput};\n})()',{
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
test('az élzárás és az 1 mm előmarás utáni szabásméret jelenik meg',()=>{
 const p=part();
 // A két X él a D=600 mm-es keresztméretből összesen 2 mm-t vesz le.
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'598');
 const input=formulaEngine.partDimensionInput(p,furniture,'b','Második méret');
 assert.match(input,/class="expr-cell has-formula"/);
 assert.match(input,/>598<\/output>/);
 p.mill=false;
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'596');
 p.edgeThickness=0.4;
 assert.equal(formulaEngine.partDimensionPreview(p,furniture,'b'),'599,2');
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
