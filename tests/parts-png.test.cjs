'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('function buildPartsPngPages(');
const b=html.indexOf('\n  async function saveFileToDisk(',a);
assert.ok(a>=0&&b>a,'PNG alkatrészlista generáló nem található');

function mockDocument(){
  const canvases=[];
  return {
    canvases,
    createElement(tag){
      assert.equal(tag,'canvas');
      const text=[];
      const ctx={
        fillRect(){},
        fillText(str,x,y){text.push({str:String(str),x,y});},
        measureText(str){return {width:String(str).length*13}}
      };
      const canvas={width:0,height:0,text,getContext(type){assert.equal(type,'2d');return ctx;}};
      canvases.push(canvas);return canvas;
    }
  };
}
const fcStart=html.indexOf('  function sidesFromCode(code){');
const fcEnd=html.indexOf('  let loaded=null;',fcStart);
assert.ok(fcStart>=0&&fcEnd>fcStart,'Hiányzik a reszeléskód');
const filingSource=html.slice(fcStart,fcEnd);
const dimensionSource="function dimensionUnderline(part,axis){const edge=String(part.edge||'0-0'),flags=part.filingSides||{};const i=axis==='a'?0:2;return Number(edge[i]||0)>0||(i===0?!!(flags.x1||flags.x2):!!(flags.y1||flags.y2));}";
const render=vm.runInNewContext('(function(){'+filingSource+
  ';return '+html.slice(a,b).trim()+';})()');
const filingCode=vm.runInNewContext('(function(){'+filingSource+';return filingCode;})()');
function part(i){
  return {skipped:false,error:null,qty:2,
    part:{name:'Oldallap '+i,edgeSides:{x1:true,y2:true},
      filingSides:{x1:true,x2:false,y1:true,y2:true}},
    furniture:{materialColor:'Feya',destination:'Kiskunfélegyháza'},
    originalA:910,originalB:600,edge:'1-1',edgeThickness:2,mill:true,millDepth:1
  };
}
test('PNG fejlécében az anyag és gyártási célhely; sorban készméret és élzárás',()=>{
  const doc=mockDocument(),pages=render({errors:[],rows:[part(1)]},doc);
  assert.equal(pages.length,1);
  assert.equal(pages[0].width,1600);
  const text=pages[0].text.map(x=>x.str).join('\n');
  for(const expected of ['ALKATRÉSZLISTA','Feya','Kiskunfélegyháza',
    'Oldallap 1','910 × 600','1-1','Reszelés','1Hresz-2Rresz','Összesen: 2 db'])
    assert.ok(text.includes(expected),'Nem jelenik meg: '+expected);
});
test('többoldalas PNG: nem vágja le a 100 sornál hosszabb alkatrészlistát',()=>{
  const doc=mockDocument(),rows=Array.from({length:240},(_,i)=>part(i+1));
  const pages=render({errors:[],rows},doc);
  assert.equal(pages.length,3);
  assert.equal(pages[0].height,350+100*70+100);
  assert.equal(pages[2].height,350+40*70+100);
  assert.ok(pages[2].text.some(x=>x.str.includes('Oldallap 240')));
  assert.ok(pages[2].text.some(x=>x.str==='3 / 3. oldal'));
});
test('hibás vagy üres alkatrészlistából nem ment félkész képet',()=>{
  const doc=mockDocument();
  assert.throws(()=>render({errors:['Hibás hossz'],rows:[part(1)]},doc),/Hibás hossz/);
  assert.throws(()=>render({errors:[],rows:[]},doc),/Nincs exportálható alkatrész/);
});

test('az X1/X2/Y1/Y2 élhely-jelölések nem szerepelnek a PNG szövegeiben',()=>{
 const doc=mockDocument();
 const rows=[part(1),part(2)];
 rows[0].part.edgeSides={x1:true,x2:true,y1:true,y2:true};
 render({errors:[],rows},doc);
 const text=doc.canvases.flatMap(c=>c.text.map(x=>x.str));
 for(const marker of ['X1','X2','Y1','Y2']){
  assert.ok(!text.some(s=>new RegExp('^'+marker+'(?:,|$)').test(s)),
    'A PNG-ben tiltott kód szerepel: '+marker);
 }
 assert.ok(text.includes('1-1'));
 assert.ok(text.includes('1Hresz-2Rresz'));
 assert.ok(!text.some(s=>s.includes('1-1 · 2 mm')),
   'a Műhely példány élzárási kódja csak 1-1 lehet');
});

test('Reszelés beírása számmal, kiírása Hresz és Rresz jelöléssel',()=>{
 assert.equal(filingCode({x1:true},200,400),'1Hresz');
 assert.equal(filingCode({y1:true,y2:true},964,600),'2Rresz');
 assert.equal(filingCode({x1:true,y1:true,y2:true},964,600),'1Hresz-2Rresz');
 assert.equal(filingCode({x1:true,x2:true,y1:true,y2:true},964,600),'2Hresz-2Rresz');
 assert.equal(filingCode({},964,600),'');
});
test('Műhely példány PNG fejléc és fájlnév: kizárólag elkészült alkatrészek',()=>{
 const doc=mockDocument(),pages=render({errors:[],rows:[part(1)]},doc,true);
 assert.equal(pages.length,1);
 const words=pages[0].text.map(x=>x.str);
 assert.ok(words.includes('MŰHELY PÉLDÁNY'));
 assert.ok(words.includes('1-1'));
 assert.ok(words.includes('1Hresz-2Rresz'));
 assert.match(html,/data-action="download-workshop-copy-png"/);
 assert.match(html,/Műhely példány\.png/);
 assert.match(html,/Műhely példány\.zip/);
});

// A matricatesztek az új, méretenkénti segédfüggvényt is betöltik.
function makeLabelRenderer(state){
  const lStart=html.indexOf('  function labelAxisDetails(');
  const lEnd=html.indexOf('  const labelPaper=',lStart);
  assert.ok(lStart>=0&&lEnd>lStart,'A kétoszlopos matricageneráló elérhető');
  return vm.runInNewContext('(function(){'+filingSource+html.slice(lStart,lEnd)+
    ';return labelSvgContent;})()',{
      state,
      h:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
      nfmt:value=>String(value)
    });
}
test('Matrica a jelenlegi alkatrész reszelésjelölését olvassa régi szabásterv mellett is',()=>{
 const state={furnitures:[{parts:[{
   id:'p1',filingSides:{x1:true,x2:false,y1:true,y2:true}
 }]}]};
 const makeLabel=makeLabelRenderer(state);
 const oldPlacement={part:{
   uid:'p1',name:'Polc',source:'Konyha',destination:'Műhely',
   materialColor:'Freya',originalA:964,originalB:600,edge:'1-2',
   edgeThickness:2,mill:true,millDepth:1
 }};
 const show=()=>makeLabel({placement:oldPlacement},0,0,48.5,25.4);
 let svg=show();
 assert.match(svg,/>1Hresz<\/text>/);
 assert.match(svg,/>2Rresz<\/text>/);
 assert.match(svg,/>1H 2mm ABS<\/text>/);
 assert.match(svg,/>2R 2mm ABS<\/text>/);
 state.furnitures[0].parts[0].filingSides={x1:false,x2:false,y1:true,y2:true};
 svg=show();
 assert.doesNotMatch(svg,/1Hresz/);
 assert.match(svg,/>2Rresz<\/text>/);
 state.furnitures[0].parts[0].filingSides={x1:false,x2:false,y1:false,y2:false};
 assert.doesNotMatch(show(),/Hresz|Rresz/);
});
test('Matricán a reszelés a saját mérete és ABS felirata alatt jelenik meg',()=>{
 const label=makeLabelRenderer({furnitures:[]});
 const base={name:'Oldallap',source:'Szekrény',destination:'Műhely',
   materialColor:'Freya',originalA:964,originalB:502,
   edge:'1-2',filingSides:{x1:false,y1:true,y2:true},edgeThickness:2};
 let svg=label({placement:{part:base}},0,0,48.5,25.4);
 assert.match(svg,/>1H 2mm ABS<\/text>/);
 assert.match(svg,/>2R 2mm ABS<\/text>/);
 assert.match(svg,/>2Rresz<\/text>/);
 assert.doesNotMatch(svg,/1Hresz/);
 assert.ok(svg.indexOf('2R 2mm ABS')<svg.indexOf('2Rresz'));
 // Hibásan régi mentésből érkező reszelés sem szerepelhet 0,4 mm-es élen.
 svg=label({placement:{part:{...base,
   edgeSides:{x1:true,x2:false,y1:true,y2:true},
   edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4}
 }}},0,0,48.5,25.4);
 assert.match(svg,/>2R 0,4mm ABS<\/text>/);
 assert.doesNotMatch(svg,/2Rresz/);
});
