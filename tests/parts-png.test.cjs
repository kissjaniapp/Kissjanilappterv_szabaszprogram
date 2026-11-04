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
const fcStart=html.indexOf('  function filingCode(sides,a,b){');
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
 assert.equal(filingCode({x1:true},200,400),'1Rresz');
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

test('Matrica a JELENLEGI alkatrész reszelésjelölését olvassa, régi szabásterv mellett is',()=>{
 const lStart=html.indexOf('  function labelSvgContent(');
 const lEnd=html.indexOf('  const labelPaper=',lStart);
 assert.ok(lStart>=0&&lEnd>lStart);
 const state={furnitures:[{id:'f1',parts:[{
   id:'p1',filingSides:{x1:true,x2:false,y1:true,y2:true}
 }]}]};
 const makeLabel=vm.runInNewContext('(function(){'+filingSource+dimensionSource+
   html.slice(lStart,lEnd)+';return labelSvgContent;})()',{
     state,
     h:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
     nfmt:Number
   });
 // A már meglevő gépi elhelyezés / matricaadat nem tartalmazza a filingSides mezőt.
 const oldPlacement={part:{
   uid:'p1',name:'Polc',source:'Konyha',destination:'Műhely',
   materialColor:'Freya',originalA:964,originalB:600,edge:'1-0',
   edgeThickness:2,mill:true,millDepth:1
 }};
 const show=()=>makeLabel({placement:oldPlacement},0,0,48.5,25.4);
 const mixed=show();
 assert.match(mixed,/>1Hresz-2Rresz<\/text>/);
 assert.ok(mixed.indexOf('>1-0</text>')<mixed.indexOf('>1Hresz-2Rresz</text>'),
   'reszelés a matricán az élzárás után, annak alatti sorban');
 state.furnitures[0].parts[0].filingSides={x1:false,x2:false,y1:true,y2:true};
 assert.match(show(),/>2Rresz<\/text>/,
   'a matrica a frissített alkatrészjelölést mutatja új bin generálása nélkül');
 state.furnitures[0].parts[0].filingSides={x1:false,x2:false,y1:false,y2:false};
 assert.doesNotMatch(show(),/Hresz|Rresz/,
   'kikapcsolt reszelés nem maradhat a korábbi matricaállapotból');
});
test('Matricán a reszelés szövege az élzárás alatt jelenik meg, közös kódolással',()=>{
 const lStart=html.indexOf('  function labelSvgContent(');
 const lEnd=html.indexOf('  const labelPaper=',lStart);
 assert.ok(lStart>=0&&lEnd>lStart);
 const label=vm.runInNewContext('(function(){'+filingSource+dimensionSource+
   html.slice(lStart,lEnd)+';return labelSvgContent;})()',{
     h:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
     nfmt:Number
   });
 const text=label({placement:{part:{
   name:'Oldallap',source:'Szekrény',destination:'Műhely',
   materialColor:'Freya',originalA:910,originalB:600,
   edge:'1-1',filingSides:{x1:true,y1:true,y2:true},edgeThickness:2
 }}},0,0,48.5,25.4);
 assert.match(text,/>1Hresz-2Rresz<\/text>/);
 assert.ok(text.indexOf('1-1')<text.indexOf('1Hresz-2Rresz'),
  'a reszelésnek az élzárási jelölés után kell állnia');
});
