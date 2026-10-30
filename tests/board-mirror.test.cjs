'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('function svgBoardSize(');
const to=html.indexOf('\n  function trimmingSteps(',from);
assert.ok(from>0&&to>from,'Hiányzik az SVG szabásrajz');
function drawing(feed='x'){
 const state={cutDirection:feed},result={cutAxis:feed};
 const fns=vm.runInNewContext('(function(){'+html.slice(from,to)+
   ';return {svgBoard,svgBoardSize};})()',{
     state,result,
     colors:['#dcebdd'],
     h:x=>String(x),
     nfmt:x=>String(x)
   });
 return fns;
}
const board=()=>({
 name:'Feya',a:1000,b:600,trim:10,used:20000,
 placements:[{x:100,y:50,realW:200,realH:100,part:{
   a:200,b:100,originalA:200,originalB:100,
   name:'Teszt',edge:'0-0',edgeThickness:2,mill:false
 },turned:false}],
 cuts:[{x1:100,y1:50,x2:300,y2:50,axis:'x',length:200}],
 machine:null
});
test('a szabásrajz tükröződik a függőleges tengelyen, a betűk nem fordulnak meg',()=>{
 const b=board();
 const {svgBoard,svgBoardSize}=drawing('x');
 const dims=svgBoardSize(b);
 assert.equal(dims.boardWidth,1000);
 assert.equal(dims.boardHeight,600);
 const svg=svgBoard(b);
 // x'=width-(x+szélesség), a külső 80 mm margóval
 assert.match(svg,/<rect x="780" y="130" width="200" height="100" fill="#dcebdd"/);
 assert.match(svg,/>Teszt<\/text>/);
 assert.match(svg,/1\. VÁGÁS ←/);
 assert.doesNotMatch(svg,/>tseT</);
});
test('Y beállításban az elforgatott rajz ugyanúgy a függőleges tengelyre tükröződik',()=>{
 const b=board();
 const svg=drawing('y').svgBoard(b);
 // az elforgatott tábla szélessége 600, a placement vízszintes
 // koordinátáját tükrözés után eredeti y=50 határozza meg.
 assert.match(svg,/<rect x="130" y="240" width="100" height="200" fill="#dcebdd"/);
 assert.match(svg,/KEZDŐVÁGÁS FELÜLRŐL ↓/);
});
test('a tükrözés csak az SVG-t érinti, a szabásméret adatot nem módosítja',()=>{
 const b=board(),original=JSON.stringify(b);
 drawing('x').svgBoard(b);
 drawing('y').svgBoard(b);
 assert.equal(JSON.stringify(b),original);
});
